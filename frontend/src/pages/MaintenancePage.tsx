import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { VehicleName } from '@/components/vehicles/VehicleName';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import {
  maintenanceCategoryOptions,
  maintenanceTypeOptions,
  scheduleCategoryLabels,
} from '@/lib/maintenanceTypes';
import type {
  CreateMaintenancePayload,
  MaintenanceCategory,
  MaintenanceQuery,
  MaintenanceType,
  MaintenanceWithVehicle,
  ScheduleEntry,
} from '@/types/maintenance';
import type { Vehicle } from '@/types/vehicle';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : '—';
}

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function formatCurrency(value: string | number): string {
  return currencyFormatter.format(Number(value));
}

function formatKm(value: string | number | null): string {
  return value !== null ? `${Number(value).toFixed(1)} km` : '—';
}

function formatKmRemaining(value: number | null) {
  if (value === null) return '—';
  if (value < 0) {
    return <Badge variant="destructive">{Math.abs(value).toFixed(0)} km atrasado</Badge>;
  }
  return `${value.toFixed(0)} km`;
}

function formatDaysRemaining(value: number | null) {
  if (value === null) return '—';
  if (value < 0) {
    return <Badge variant="destructive">{Math.abs(value)} dia(s) atrasado</Badge>;
  }
  return `${value} dia(s)`;
}

const maintenanceSchema = z.object({
  vehicleId: z.string().min(1, 'Selecione o veículo.'),
  type: z.string().min(1, 'Selecione o tipo.'),
  category: z.string().min(1, 'Selecione a categoria.'),
  km: z.number({ message: 'Informe o KM.' }).min(0, 'O KM não pode ser negativo.'),
  cost: z.number({ message: 'Informe o custo.' }).min(0, 'O custo não pode ser negativo.'),
  description: z.string().min(1, 'Informe a descrição.'),
  scheduledDate: z.string(),
  scheduledKm: z.number().min(0, 'O KM previsto não pode ser negativo.').optional(),
  performedDate: z.string(),
});

type MaintenanceFormValues = z.infer<typeof maintenanceSchema>;

const EMPTY_VALUES: MaintenanceFormValues = {
  vehicleId: '',
  type: '',
  category: '',
  km: 0,
  cost: 0,
  description: '',
  scheduledDate: '',
  scheduledKm: undefined,
  performedDate: '',
};

export function MaintenancePage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN', 'COORDENACAO');
  const canViewHistory = hasRole('ADMIN', 'COORDENACAO', 'FINANCEIRO');

  const [filters, setFilters] = useState<MaintenanceQuery>({});

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/vehicles')).data,
    enabled: canManage,
  });

  const { data: schedule, isLoading: isLoadingSchedule } = useQuery({
    queryKey: ['maintenance', 'schedule'],
    queryFn: async () => (await api.get<ScheduleEntry[]>('/maintenance/schedule')).data,
    enabled: canManage,
  });

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['maintenance', 'history', filters],
    queryFn: async () =>
      (await api.get<MaintenanceWithVehicle[]>('/maintenance', { params: filters })).data,
    enabled: canViewHistory,
  });

  const invalidateMaintenance = () => {
    queryClient.invalidateQueries({ queryKey: ['maintenance'] });
    queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  };

  const form = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: EMPTY_VALUES,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateMaintenancePayload) => api.post('/maintenance', payload),
    onSuccess: () => {
      toast.success('Manutenção registrada com sucesso.');
      form.reset(EMPTY_VALUES);
      invalidateMaintenance();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível registrar a manutenção.'));
    },
  });

  const activeVehicles = (vehicles ?? []).filter((vehicle) => vehicle.active);

  function onSubmit(values: MaintenanceFormValues) {
    createMutation.mutate({
      vehicleId: values.vehicleId,
      type: values.type as MaintenanceType,
      category: values.category as MaintenanceCategory,
      km: values.km,
      cost: values.cost,
      description: values.description,
      scheduledDate: values.scheduledDate || undefined,
      scheduledKm: values.scheduledKm,
      performedDate: values.performedDate || undefined,
    });
  }

  function handleFilterChange<K extends keyof MaintenanceQuery>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (value || undefined) as MaintenanceQuery[K] }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Manutenções</h2>
        <p className="text-sm text-muted-foreground">
          Registre manutenções, acompanhe o histórico e a agenda de próximas revisões da frota.
        </p>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Agenda de manutenções</CardTitle>
            <CardDescription>
              Próximas trocas de óleo, pneus e revisões previstas, ordenadas por proximidade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-2 py-2 font-medium">Veículo</th>
                  <th className="px-2 py-2 font-medium">Item</th>
                  <th className="px-2 py-2 font-medium">KM previsto</th>
                  <th className="px-2 py-2 font-medium">KM restante</th>
                  <th className="px-2 py-2 font-medium">Data prevista</th>
                  <th className="px-2 py-2 font-medium">Dias restantes</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingSchedule && (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoadingSchedule && schedule?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                      Nenhuma manutenção prevista.
                    </td>
                  </tr>
                )}
                {schedule?.map((entry, index) => (
                  <tr
                    key={`${entry.vehicleId}-${entry.category}-${index}`}
                    className="border-b last:border-0"
                  >
                    <td className="px-2 py-2 font-medium">
                      <VehicleName vehicle={entry} />
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {scheduleCategoryLabels[entry.category]}
                    </td>
                    <td className="px-2 py-2">{formatKm(entry.nextKm)}</td>
                    <td className="px-2 py-2">{formatKmRemaining(entry.kmRemaining)}</td>
                    <td className="px-2 py-2">{formatDate(entry.nextDate)}</td>
                    <td className="px-2 py-2">{formatDaysRemaining(entry.daysRemaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar manutenção</CardTitle>
            <CardDescription>
              Informe o veículo, o tipo e a categoria da manutenção. Ao preencher a data de
              realização, as próximas previsões do veículo são recalculadas automaticamente conforme
              a categoria.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Veículo</FormLabel>
                      <FormControl>
                        <Select {...field} required>
                          <option value="">Selecione...</option>
                          {activeVehicles.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.model} ({vehicle.plate})
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
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <FormControl>
                        <Select {...field} required>
                          <option value="">Selecione...</option>
                          {maintenanceTypeOptions.map((option) => (
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
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <FormControl>
                        <Select {...field} required>
                          <option value="">Selecione...</option>
                          {maintenanceCategoryOptions.map((option) => (
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
                  name="km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>KM</FormLabel>
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
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custo (R$)</FormLabel>
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Observações técnicas" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="performedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de realização</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data prevista (agendamento)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledKm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>KM previsto (agendamento)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === '' ? undefined : event.target.valueAsNumber,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="sm:col-span-2 lg:col-span-3">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Registrando...' : 'Registrar manutenção'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {canViewHistory && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>Filtre o histórico de manutenções da frota.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {canManage && (
                <div className="grid gap-1.5">
                  <Label>Veículo</Label>
                  <Select
                    value={filters.vehicleId ?? ''}
                    onChange={(event) => handleFilterChange('vehicleId', event.target.value)}
                  >
                    <option value="">Todos</option>
                    {(vehicles ?? []).map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.model} ({vehicle.plate})
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select
                  value={filters.type ?? ''}
                  onChange={(event) => handleFilterChange('type', event.target.value)}
                >
                  <option value="">Todos</option>
                  {maintenanceTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Categoria</Label>
                <Select
                  value={filters.category ?? ''}
                  onChange={(event) => handleFilterChange('category', event.target.value)}
                >
                  <option value="">Todas</option>
                  {maintenanceCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Realizada de</Label>
                <Input
                  type="date"
                  value={filters.from ?? ''}
                  onChange={(event) => handleFilterChange('from', event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Realizada até</Label>
                <Input
                  type="date"
                  value={filters.to ?? ''}
                  onChange={(event) => handleFilterChange('to', event.target.value)}
                />
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-2 py-2 font-medium">Registrado em</th>
                  <th className="px-2 py-2 font-medium">Veículo</th>
                  <th className="px-2 py-2 font-medium">Tipo</th>
                  <th className="px-2 py-2 font-medium">Categoria</th>
                  <th className="px-2 py-2 font-medium">KM</th>
                  <th className="px-2 py-2 font-medium">Custo</th>
                  <th className="px-2 py-2 font-medium">Descrição</th>
                  <th className="px-2 py-2 font-medium">Realizada em</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingHistory && (
                  <tr>
                    <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoadingHistory && history?.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                      Nenhuma manutenção encontrada.
                    </td>
                  </tr>
                )}
                {history?.map((maintenance) => (
                  <tr key={maintenance.id} className="border-b last:border-0">
                    <td className="px-2 py-2 text-muted-foreground">
                      {formatDateTime(maintenance.createdAt)}
                    </td>
                    <td className="px-2 py-2 font-medium">
                      <VehicleName vehicle={maintenance.vehicle} />
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {maintenanceTypeOptions.find((option) => option.value === maintenance.type)
                        ?.label ?? maintenance.type}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {maintenanceCategoryOptions.find(
                        (option) => option.value === maintenance.category,
                      )?.label ?? maintenance.category}
                    </td>
                    <td className="px-2 py-2">{formatKm(maintenance.km)}</td>
                    <td className="px-2 py-2">{formatCurrency(maintenance.cost)}</td>
                    <td className="px-2 py-2 text-muted-foreground">{maintenance.description}</td>
                    <td className="px-2 py-2">{formatDate(maintenance.performedDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
