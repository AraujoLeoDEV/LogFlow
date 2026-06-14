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
import type { Route } from '@/types/route';
import type { User } from '@/types/user';
import type { Vehicle } from '@/types/vehicle';
import type { CreateDriverPayload, Driver, UpdateDriverPayload } from '@/types/driver';

const schema = z.object({
  name: z.string().min(1, 'Informe o nome.'),
  position: z.string().min(1, 'Informe o cargo/função.'),
  vehicleId: z.string(),
  currentKm: z
    .number({ message: 'Informe o KM atual.' })
    .min(0, 'O KM atual não pode ser negativo.'),
  defaultRouteId: z.string(),
  cnhExpiration: z.string(),
  userId: z.string(),
  active: z.boolean(),
});

type DriverFormValues = z.infer<typeof schema>;

interface DriverFormSheetProps {
  open: boolean;
  driver: Driver | null;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitCreate: (payload: CreateDriverPayload) => void;
  onSubmitUpdate: (id: string, payload: UpdateDriverPayload) => void;
}

const EMPTY_VALUES: DriverFormValues = {
  name: '',
  position: '',
  vehicleId: '',
  currentKm: 0,
  defaultRouteId: '',
  cnhExpiration: '',
  userId: '',
  active: true,
};

function toDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

export function DriverFormSheet({
  open,
  driver,
  isSubmitting,
  onOpenChange,
  onSubmitCreate,
  onSubmitUpdate,
}: DriverFormSheetProps) {
  const isEditing = !!driver;

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/vehicles')).data,
  });

  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => (await api.get<Route[]>('/routes')).data,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<User[]>('/users')).data,
  });

  const driverUsers = (users ?? []).filter(
    (user) => user.role === 'MOTORISTA' && (user.isActive || user.id === driver?.userId),
  );

  const form = useForm<DriverFormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(
        driver
          ? {
              name: driver.name,
              position: driver.position,
              vehicleId: driver.vehicleId ?? '',
              currentKm: Number(driver.currentKm),
              defaultRouteId: driver.defaultRouteId ?? '',
              cnhExpiration: toDateInputValue(driver.cnhExpiration),
              userId: driver.userId ?? '',
              active: driver.active,
            }
          : EMPTY_VALUES,
      );
    }
  }, [open, driver, form]);

  function onSubmit(values: DriverFormValues) {
    const payload = {
      ...values,
      vehicleId: values.vehicleId || undefined,
      defaultRouteId: values.defaultRouteId || undefined,
      cnhExpiration: values.cnhExpiration || undefined,
      userId: values.userId || undefined,
    };

    if (isEditing && driver) {
      onSubmitUpdate(driver.id, payload);
    } else {
      onSubmitCreate(payload);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar motorista' : 'Novo motorista'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados do motorista.'
              : 'Preencha os dados para cadastrar um novo motorista.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo/função</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Veículo vinculado</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      <option value="">Nenhum</option>
                      {vehicles?.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.plate}
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
              name="defaultRouteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rota padrão</FormLabel>
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
              name="cnhExpiration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vencimento da CNH</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuário vinculado (login)</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      <option value="">Nenhum</option>
                      {driverUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </option>
                      ))}
                    </Select>
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
                      Motorista ativo
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
