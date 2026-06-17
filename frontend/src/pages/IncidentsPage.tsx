import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { VehicleName } from '@/components/vehicles/VehicleName';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import {
  incidentCategoryLabels,
  incidentCategoryOptions,
  incidentSeverityLabels,
  incidentSeverityOptions,
  incidentTypeLabels,
  incidentTypeOptions,
} from '@/lib/incidentTypes';
import type {
  CreateIncidentPayload,
  IncidentCategory,
  IncidentIndicators,
  IncidentQuery,
  IncidentSeverity,
  IncidentType,
  IncidentWithRelations,
} from '@/types/incident';
import type { Driver } from '@/types/driver';
import type { PaginatedResult } from '@/types/pagination';
import type { Vehicle } from '@/types/vehicle';

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

function formatCurrency(value: string | number | null): string {
  return value !== null ? currencyFormatter.format(Number(value)) : '—';
}

function formatRate(value: number | null): string {
  return value !== null ? `${value.toFixed(2)} / 1.000 km` : '—';
}

const incidentSchema = z.object({
  vehicleId: z.string().min(1, 'Selecione o veículo.'),
  driverId: z.string(),
  category: z.string().min(1, 'Selecione a categoria.'),
  type: z.string().min(1, 'Selecione o tipo.'),
  severity: z.string().min(1, 'Selecione a gravidade.'),
  responsible: z.string().min(1, 'Informe o responsável.'),
  cost: z.number().min(0, 'O custo não pode ser negativo.').optional(),
  observations: z.string().min(1, 'Informe as observações.'),
  date: z.string().min(1, 'Informe a data da ocorrência.'),
});

type IncidentFormValues = z.infer<typeof incidentSchema>;

const EMPTY_VALUES: IncidentFormValues = {
  vehicleId: '',
  driverId: '',
  category: '',
  type: '',
  severity: '',
  responsible: '',
  cost: undefined,
  observations: '',
  date: '',
};

export function IncidentsPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManageOthers = hasRole('ADMIN', 'COORDENACAO');
  const canRegister = hasRole('ADMIN', 'COORDENACAO', 'MOTORISTA');
  const canViewIndicators = hasRole('ADMIN', 'COORDENACAO');

  const [filters, setFilters] = useState<IncidentQuery>({});
  const [page, setPage] = useState(1);

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/vehicles')).data,
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => (await api.get<Driver[]>('/drivers')).data,
    enabled: canManageOthers,
  });

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['incidents', 'history', filters, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResult<IncidentWithRelations>>('/incidents', {
          params: { ...filters, page },
        })
      ).data,
  });

  const { data: indicators, isLoading: isLoadingIndicators } = useQuery({
    queryKey: ['incidents', 'indicators'],
    queryFn: async () => (await api.get<IncidentIndicators>('/incidents/indicators')).data,
    enabled: canViewIndicators,
  });

  const invalidateIncidents = () => {
    queryClient.invalidateQueries({ queryKey: ['incidents'] });
  };

  const form = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentSchema),
    defaultValues: EMPTY_VALUES,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateIncidentPayload) => api.post('/incidents', payload),
    onSuccess: () => {
      toast.success('Ocorrência registrada com sucesso.');
      form.reset(EMPTY_VALUES);
      invalidateIncidents();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível registrar a ocorrência.'));
    },
  });

  const activeVehicles = (vehicles ?? []).filter((vehicle) => vehicle.active);
  const activeDrivers = (drivers ?? []).filter((driver) => driver.active);

  function onSubmit(values: IncidentFormValues) {
    createMutation.mutate({
      vehicleId: values.vehicleId,
      driverId: values.driverId || undefined,
      category: values.category as IncidentCategory,
      type: values.type as IncidentType,
      severity: values.severity as IncidentSeverity,
      responsible: values.responsible,
      cost: values.cost,
      observations: values.observations,
      date: new Date(values.date).toISOString(),
    });
  }

  function handleFilterChange<K extends keyof IncidentQuery>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (value || undefined) as IncidentQuery[K] }));
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Ocorrências</h2>
        <p className="text-sm text-muted-foreground">
          Registre ocorrências da frota e acompanhe indicadores por motorista e por veículo.
        </p>
      </div>

      {canViewIndicators && (
        <Card>
          <CardHeader>
            <CardTitle>Indicadores</CardTitle>
            <CardDescription>
              Ocorrências por motorista, por veículo e índice de ocorrências por KM rodado.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {isLoadingIndicators && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!isLoadingIndicators && indicators && (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground uppercase">Total de ocorrências</p>
                    <p className="text-lg font-semibold">{indicators.fleetRate.incidentCount}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground uppercase">KM rodado</p>
                    <p className="text-lg font-semibold">
                      {indicators.fleetRate.kmDriven.toFixed(1)} km
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground uppercase">Índice da frota</p>
                    <p className="text-lg font-semibold">
                      {formatRate(indicators.fleetRate.ratePer1000Km)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium">Ocorrências por motorista</p>
                    <table className="w-full text-sm">
                      <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-2 py-2 font-medium">Motorista</th>
                          <th className="px-2 py-2 font-medium">Qtd.</th>
                          <th className="px-2 py-2 font-medium">Custo total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {indicators.byDriver.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-2 py-6 text-center text-muted-foreground">
                              Nenhuma ocorrência registrada.
                            </td>
                          </tr>
                        )}
                        {indicators.byDriver.map((item) => (
                          <tr key={item.driverId} className="border-b last:border-0">
                            <td className="px-2 py-2 font-medium">{item.driverName}</td>
                            <td className="px-2 py-2">{item.count}</td>
                            <td className="px-2 py-2">{formatCurrency(item.totalCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium">Ocorrências por veículo</p>
                    <table className="w-full text-sm">
                      <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-2 py-2 font-medium">Veículo</th>
                          <th className="px-2 py-2 font-medium">Qtd.</th>
                          <th className="px-2 py-2 font-medium">Custo total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {indicators.byVehicle.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-2 py-6 text-center text-muted-foreground">
                              Nenhuma ocorrência registrada.
                            </td>
                          </tr>
                        )}
                        {indicators.byVehicle.map((item) => (
                          <tr key={item.vehicleId} className="border-b last:border-0">
                            <td className="px-2 py-2 font-medium">
                              <VehicleName vehicle={item} />
                            </td>
                            <td className="px-2 py-2">{item.count}</td>
                            <td className="px-2 py-2">{formatCurrency(item.totalCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Índice de ocorrências por KM rodado</p>
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                      <tr>
                        <th className="px-2 py-2 font-medium">Veículo</th>
                        <th className="px-2 py-2 font-medium">Ocorrências</th>
                        <th className="px-2 py-2 font-medium">KM rodado</th>
                        <th className="px-2 py-2 font-medium">Índice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicators.incidentRate.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                            Nenhum dado disponível.
                          </td>
                        </tr>
                      )}
                      {indicators.incidentRate.map((item) => (
                        <tr key={item.vehicleId} className="border-b last:border-0">
                          <td className="px-2 py-2 font-medium">
                            <VehicleName vehicle={item} />
                          </td>
                          <td className="px-2 py-2">{item.incidentCount}</td>
                          <td className="px-2 py-2">{item.kmDriven.toFixed(1)} km</td>
                          <td className="px-2 py-2">{formatRate(item.ratePer1000Km)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {canRegister && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar ocorrência</CardTitle>
            <CardDescription>
              Informe o veículo, a categoria, o tipo e a gravidade da ocorrência.
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
                {canManageOthers && (
                  <FormField
                    control={form.control}
                    name="driverId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Motorista</FormLabel>
                        <FormControl>
                          <Select {...field} required>
                            <option value="">Selecione...</option>
                            {activeDrivers.map((driver) => (
                              <option key={driver.id} value={driver.id}>
                                {driver.name}
                              </option>
                            ))}
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <FormControl>
                        <Select {...field} required>
                          <option value="">Selecione...</option>
                          {incidentCategoryOptions.map((option) => (
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
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <FormControl>
                        <Select {...field} required>
                          <option value="">Selecione...</option>
                          {incidentTypeOptions.map((option) => (
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
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gravidade</FormLabel>
                      <FormControl>
                        <Select {...field} required>
                          <option value="">Selecione...</option>
                          {incidentSeverityOptions.map((option) => (
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
                  name="responsible"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome do responsável" />
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
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data da ocorrência</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="sm:col-span-2 lg:col-span-3">
                  <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Descreva o que aconteceu" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Registrando...' : 'Registrar ocorrência'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Filtre o histórico de ocorrências da frota.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            {canManageOthers && (
              <div className="grid gap-1.5">
                <Label>Motorista</Label>
                <Select
                  value={filters.driverId ?? ''}
                  onChange={(event) => handleFilterChange('driverId', event.target.value)}
                >
                  <option value="">Todos</option>
                  {(drivers ?? []).map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>Categoria</Label>
              <Select
                value={filters.category ?? ''}
                onChange={(event) => handleFilterChange('category', event.target.value)}
              >
                <option value="">Todas</option>
                {incidentCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select
                value={filters.type ?? ''}
                onChange={(event) => handleFilterChange('type', event.target.value)}
              >
                <option value="">Todos</option>
                {incidentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Gravidade</Label>
              <Select
                value={filters.severity ?? ''}
                onChange={(event) => handleFilterChange('severity', event.target.value)}
              >
                <option value="">Todas</option>
                {incidentSeverityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>De</Label>
              <DatePicker
                value={filters.from}
                onChange={(value) => handleFilterChange('from', value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Até</Label>
              <DatePicker
                value={filters.to}
                onChange={(value) => handleFilterChange('to', value)}
              />
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-2 py-2 font-medium">Data</th>
                <th className="px-2 py-2 font-medium">Veículo</th>
                <th className="px-2 py-2 font-medium">Motorista</th>
                <th className="px-2 py-2 font-medium">Categoria</th>
                <th className="px-2 py-2 font-medium">Tipo</th>
                <th className="px-2 py-2 font-medium">Gravidade</th>
                <th className="px-2 py-2 font-medium">Responsável</th>
                <th className="px-2 py-2 font-medium">Custo</th>
                <th className="px-2 py-2 font-medium">Observações</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingHistory && (
                <tr>
                  <td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoadingHistory && history?.data.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">
                    Nenhuma ocorrência encontrada.
                  </td>
                </tr>
              )}
              {history?.data.map((incident) => (
                <tr key={incident.id} className="border-b last:border-0">
                  <td className="px-2 py-2 text-muted-foreground">
                    {formatDateTime(incident.date)}
                  </td>
                  <td className="px-2 py-2 font-medium">
                    <VehicleName vehicle={incident.vehicle} />
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{incident.driver.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {incidentCategoryLabels[incident.category]}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {incidentTypeLabels[incident.type]}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {incidentSeverityLabels[incident.severity]}
                  </td>
                  <td className="px-2 py-2">{incident.responsible}</td>
                  <td className="px-2 py-2">{formatCurrency(incident.cost)}</td>
                  <td className="px-2 py-2 text-muted-foreground">{incident.observations}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            page={history?.page ?? page}
            totalPages={history?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>
    </div>
  );
}
