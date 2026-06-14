import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { fuelTypeOptions } from '@/lib/fuelTypes';
import { VEHICLE_PLATE_MESSAGE, VEHICLE_PLATE_REGEX } from '@/lib/vehiclePlate';
import type { Route } from '@/types/route';
import type { CreateVehiclePayload, UpdateVehiclePayload, Vehicle } from '@/types/vehicle';

const FUEL_TYPE_VALUES = ['GASOLINE', 'ETHANOL', 'DIESEL', 'FLEX', 'GNV'] as const;

const schema = z.object({
  plate: z
    .string()
    .min(1, 'Informe a placa.')
    .refine((value) => VEHICLE_PLATE_REGEX.test(value.toUpperCase().trim()), VEHICLE_PLATE_MESSAGE),
  model: z.string().min(1, 'Informe o modelo do veículo.'),
  fuelType: z.enum(FUEL_TYPE_VALUES, { message: 'Selecione o tipo de combustível.' }),
  tankCapacityLiters: z
    .number({ message: 'Informe a capacidade do tanque.' })
    .positive('A capacidade do tanque deve ser maior que zero.'),
  yearModel: z
    .number({ message: 'Informe o ano/modelo.' })
    .int('O ano/modelo deve ser um número inteiro.')
    .min(1950, 'O ano/modelo informado é inválido.'),
  mainRouteId: z.string(),
  acquisitionValue: z
    .number({ message: 'Informe o valor de aquisição.' })
    .positive('O valor de aquisição deve ser maior que zero.'),
  usefulLifeMonths: z
    .number({ message: 'Informe a vida útil.' })
    .int('A vida útil deve ser um número inteiro.')
    .positive('A vida útil deve ser maior que zero.'),
  residualValue: z
    .number({ message: 'Informe o valor residual.' })
    .min(0, 'O valor residual não pode ser negativo.'),
  currentKm: z
    .number({ message: 'Informe o KM atual.' })
    .min(0, 'O KM atual não pode ser negativo.'),
  licensingExpiration: z.string(),
  insuranceExpiration: z.string(),
  active: z.boolean(),
});

type VehicleFormValues = z.infer<typeof schema>;

interface VehicleFormSheetProps {
  open: boolean;
  vehicle: Vehicle | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitCreate: (payload: CreateVehiclePayload) => void;
  onSubmitUpdate: (id: string, payload: UpdateVehiclePayload) => void;
}

const EMPTY_VALUES: VehicleFormValues = {
  plate: '',
  model: '',
  fuelType: 'FLEX',
  tankCapacityLiters: 0,
  yearModel: new Date().getFullYear(),
  mainRouteId: '',
  acquisitionValue: 0,
  usefulLifeMonths: 0,
  residualValue: 0,
  currentKm: 0,
  licensingExpiration: '',
  insuranceExpiration: '',
  active: true,
};

function toDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

export function VehicleFormSheet({
  open,
  vehicle,
  isSubmitting,
  onOpenChange,
  onSubmitCreate,
  onSubmitUpdate,
}: VehicleFormSheetProps) {
  const isEditing = !!vehicle;

  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => (await api.get<Route[]>('/routes')).data,
  });

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        vehicle
          ? {
              plate: vehicle.plate,
              model: vehicle.model,
              fuelType: vehicle.fuelType,
              tankCapacityLiters: Number(vehicle.tankCapacityLiters),
              yearModel: vehicle.yearModel,
              mainRouteId: vehicle.mainRouteId ?? '',
              acquisitionValue: Number(vehicle.acquisitionValue),
              usefulLifeMonths: vehicle.usefulLifeMonths,
              residualValue: Number(vehicle.residualValue),
              currentKm: Number(vehicle.currentKm),
              licensingExpiration: toDateInputValue(vehicle.licensingExpiration),
              insuranceExpiration: toDateInputValue(vehicle.insuranceExpiration),
              active: vehicle.active,
            }
          : EMPTY_VALUES,
      );
    }
  }, [open, vehicle, form]);

  function onSubmit(values: VehicleFormValues) {
    const payload = {
      ...values,
      plate: values.plate.toUpperCase().trim(),
      mainRouteId: values.mainRouteId || undefined,
      licensingExpiration: values.licensingExpiration || undefined,
      insuranceExpiration: values.insuranceExpiration || undefined,
    };

    if (isEditing && vehicle) {
      onSubmitUpdate(vehicle.id, payload);
    } else {
      onSubmitCreate(payload);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar veículo' : 'Novo veículo'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados do veículo.'
              : 'Preencha os dados para cadastrar um novo veículo.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4"
          >
            <FormField
              control={form.control}
              name="plate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Placa</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                      maxLength={7}
                      placeholder="AAA0A00"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modelo</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: Fiat Strada" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fuelType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de combustível</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {fuelTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tankCapacityLiters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidade do tanque (litros)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="yearModel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ano/modelo</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      min="1950"
                      {...field}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="mainRouteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rota principal</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      <option value="">Nenhuma</option>
                      {routes?.map((route) => (
                        <option key={route.id} value={route.id}>
                          {route.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="acquisitionValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor de aquisição (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="usefulLifeMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vida útil (anos)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      {...field}
                      value={field.value / 12}
                      onChange={(event) =>
                        field.onChange(Math.round(event.target.valueAsNumber * 12))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="residualValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor residual estimado (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currentKm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>KM atual</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      {...field}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="licensingExpiration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vencimento do licenciamento</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="insuranceExpiration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vencimento do seguro</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEditing && (
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) => field.onChange(event.target.checked)}
                        className="size-4 rounded border-input"
                      />
                      Veículo ativo
                    </label>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter className="mt-auto px-0">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
