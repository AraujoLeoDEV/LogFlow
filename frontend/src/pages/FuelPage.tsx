import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Fuel as FuelIcon, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { z } from 'zod';

import { ChartGradientDefs } from '@/components/charts/ChartGradientDefs';
import { VehicleName } from '@/components/vehicles/VehicleName';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  chartAxisProps,
  chartGradientUrl,
  chartGridProps,
  chartTooltipProps,
} from '@/lib/chartTheme';
import { getErrorMessage } from '@/lib/errors';
import { formatCurrency, formatDateTime, formatDecimal, formatNumber } from '@/lib/formatters';
import { fuelTypeLabels, fuelTypeOptions } from '@/lib/fuelTypes';
import type {
  CreateFuelPayload,
  FuelIndicators,
  FuelQuery,
  FuelWithRelations,
  UpdateFuelPayload,
} from '@/types/fuel';
import type { Driver } from '@/types/driver';
import type { PaginatedResult } from '@/types/pagination';
import type { FuelType, Vehicle } from '@/types/vehicle';

function formatConsumption(value: number | null): string {
  return value !== null ? `${formatDecimal(value, 2)} km/l` : '—';
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-');
  return `${monthNumber}/${year}`;
}

function todayDateOnly(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function dateOnly(value: string): string {
  return value.slice(0, 10);
}

const fuelSchema = z.object({
  vehicleId: z.string().min(1, 'Selecione o veículo.'),
  driverId: z.string(),
  liters: z
    .number({ message: 'Informe a quantidade de litros.' })
    .min(0.01, 'A quantidade de litros deve ser maior que zero.'),
  amountPaid: z
    .number({ message: 'Informe o valor pago.' })
    .min(0, 'O valor pago não pode ser negativo.'),
  currentKm: z
    .number({ message: 'Informe o KM atual.' })
    .min(0, 'O KM atual não pode ser negativo.'),
  fuelType: z.string().min(1, 'Selecione o tipo de combustível.'),
  date: z.string().min(1, 'Selecione a data do abastecimento.'),
});

type FuelFormValues = z.infer<typeof fuelSchema>;

const EMPTY_FUEL_VALUES: FuelFormValues = {
  vehicleId: '',
  driverId: '',
  liters: 0,
  amountPaid: 0,
  currentKm: 0,
  fuelType: '',
  date: todayDateOnly(),
};

const editFuelSchema = z.object({
  driverId: z.string().min(1, 'Selecione o motorista.'),
  liters: z
    .number({ message: 'Informe a quantidade de litros.' })
    .min(0.01, 'A quantidade de litros deve ser maior que zero.'),
  amountPaid: z
    .number({ message: 'Informe o valor pago.' })
    .min(0, 'O valor pago não pode ser negativo.'),
  currentKm: z
    .number({ message: 'Informe o KM atual.' })
    .min(0, 'O KM atual não pode ser negativo.'),
  fuelType: z.string().min(1, 'Selecione o tipo de combustível.'),
  date: z.string().min(1, 'Selecione a data do abastecimento.'),
});

type EditFuelFormValues = z.infer<typeof editFuelSchema>;

export function FuelPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const canManageOthers = hasRole('ADMIN', 'COORDENACAO');
  const canRegister = hasRole('ADMIN', 'COORDENACAO', 'MOTORISTA');
  const canViewIndicators = hasRole('ADMIN', 'COORDENACAO', 'FINANCEIRO');

  const [filters, setFilters] = useState<FuelQuery>({});
  const [page, setPage] = useState(1);
  const [editingFuel, setEditingFuel] = useState<FuelWithRelations | null>(null);

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
    queryKey: ['fuel', 'history', filters, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResult<FuelWithRelations>>('/fuel', {
          params: { ...filters, page },
        })
      ).data,
    enabled: canRegister,
  });

  const { data: indicators, isLoading: isLoadingIndicators } = useQuery({
    queryKey: ['fuel', 'indicators'],
    queryFn: async () => (await api.get<FuelIndicators>('/fuel/indicators')).data,
    enabled: canViewIndicators,
  });

  const invalidateFuel = () => {
    queryClient.invalidateQueries({ queryKey: ['fuel'] });
    queryClient.invalidateQueries({ queryKey: ['vehicles'] });
  };

  const fuelForm = useForm<FuelFormValues>({
    resolver: zodResolver(fuelSchema),
    defaultValues: EMPTY_FUEL_VALUES,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateFuelPayload) => api.post('/fuel', payload),
    onSuccess: () => {
      toast.success('Abastecimento registrado com sucesso.');
      fuelForm.reset({ ...EMPTY_FUEL_VALUES, date: todayDateOnly() });
      invalidateFuel();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível registrar o abastecimento.'));
    },
  });

  const editForm = useForm<EditFuelFormValues>({
    resolver: zodResolver(editFuelSchema),
    defaultValues: {
      driverId: '',
      liters: 0,
      amountPaid: 0,
      currentKm: 0,
      fuelType: '',
      date: todayDateOnly(),
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; data: UpdateFuelPayload }) =>
      api.patch(`/fuel/${payload.id}`, payload.data),
    onSuccess: () => {
      toast.success('Abastecimento atualizado com sucesso.');
      setEditingFuel(null);
      invalidateFuel();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar o abastecimento.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/fuel/${id}`),
    onSuccess: () => {
      toast.success('Abastecimento excluído definitivamente.');
      invalidateFuel();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível excluir o abastecimento.'));
    },
  });

  function handleDelete(fuel: FuelWithRelations) {
    if (
      window.confirm(
        `Excluir DEFINITIVAMENTE o abastecimento de ${formatDateTime(fuel.date)}? Essa ação não pode ser desfeita.`,
      )
    ) {
      deleteMutation.mutate(fuel.id);
    }
  }

  function openEditDialog(fuel: FuelWithRelations) {
    setEditingFuel(fuel);
    editForm.reset({
      driverId: fuel.driverId,
      liters: Number(fuel.liters),
      amountPaid: Number(fuel.amountPaid),
      currentKm: Number(fuel.currentKm),
      fuelType: fuel.fuelType,
      date: dateOnly(fuel.date),
    });
  }

  function onSubmitEditFuel(values: EditFuelFormValues) {
    if (!editingFuel) return;
    updateMutation.mutate({
      id: editingFuel.id,
      data: {
        driverId: values.driverId,
        liters: values.liters,
        amountPaid: values.amountPaid,
        currentKm: values.currentKm,
        fuelType: values.fuelType as FuelType,
        date: new Date(`${values.date}T00:00:00`).toISOString(),
      },
    });
  }

  const activeVehicles = (vehicles ?? []).filter((vehicle) => vehicle.active);
  const activeDrivers = (drivers ?? []).filter((driver) => driver.active);

  const monthlySpendData = (indicators?.monthlySpend ?? []).map((entry) => ({
    month: formatMonth(entry.month),
    total: entry.total,
  }));

  function onSubmitFuel(values: FuelFormValues) {
    createMutation.mutate({
      vehicleId: values.vehicleId,
      driverId: values.driverId || undefined,
      liters: values.liters,
      amountPaid: values.amountPaid,
      currentKm: values.currentKm,
      fuelType: values.fuelType as FuelType,
      date: new Date(`${values.date}T00:00:00`).toISOString(),
    });
  }

  function handleFilterChange<K extends keyof FuelQuery>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (value || undefined) as FuelQuery[K] }));
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={FuelIcon}
        title="Abastecimentos"
        description="Registre abastecimentos e acompanhe o consumo e o custo da frota."
      />

      {canViewIndicators && (
        <Card>
          <CardHeader>
            <CardTitle>Indicadores</CardTitle>
            <CardDescription>
              Consumo médio e gastos com combustível por veículo e por mês.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {isLoadingIndicators && <p className="text-sm text-muted-foreground">Carregando...</p>}
            {!isLoadingIndicators && indicators && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground uppercase">Mais econômico</p>
                    <p className="text-lg font-semibold">
                      {indicators.mostEconomical ? (
                        <>
                          <VehicleName vehicle={indicators.mostEconomical} /> —{' '}
                          {formatConsumption(indicators.mostEconomical.avgConsumptionKmL)}
                        </>
                      ) : (
                        '—'
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground uppercase">Menos econômico</p>
                    <p className="text-lg font-semibold">
                      {indicators.mostExpensive ? (
                        <>
                          <VehicleName vehicle={indicators.mostExpensive} /> —{' '}
                          {formatConsumption(indicators.mostExpensive.avgConsumptionKmL)}
                        </>
                      ) : (
                        '—'
                      )}
                    </p>
                  </div>
                </div>

                <table className="w-full text-sm">
                  <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="px-2 py-2 font-medium">Veículo</th>
                      <th className="px-2 py-2 font-medium">Consumo médio</th>
                      <th className="px-2 py-2 font-medium">Gasto total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indicators.vehicles.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-2 py-6 text-center text-muted-foreground">
                          Nenhum abastecimento registrado.
                        </td>
                      </tr>
                    )}
                    {indicators.vehicles.map((vehicle) => (
                      <tr key={vehicle.vehicleId} className="border-b last:border-0">
                        <td className="px-2 py-2 font-medium">
                          <VehicleName vehicle={vehicle} />
                        </td>
                        <td className="px-2 py-2">
                          {formatConsumption(vehicle.avgConsumptionKmL)}
                        </td>
                        <td className="px-2 py-2">{formatCurrency(vehicle.totalSpent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {monthlySpendData.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Gasto mensal</p>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlySpendData}>
                          <ChartGradientDefs />
                          <CartesianGrid {...chartGridProps} />
                          <XAxis dataKey="month" {...chartAxisProps} />
                          <YAxis {...chartAxisProps} />
                          <Tooltip
                            {...chartTooltipProps}
                            formatter={(value) => formatCurrency(Number(value))}
                          />
                          <Bar
                            dataKey="total"
                            name="Gasto (R$)"
                            fill={chartGradientUrl('route')}
                            radius={[6, 6, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {canRegister && (
        <Card>
          <CardHeader>
            <CardTitle>Registrar abastecimento</CardTitle>
            <CardDescription>
              Informe o veículo, os litros abastecidos, o valor pago e o KM atual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...fuelForm}>
              <form
                onSubmit={fuelForm.handleSubmit(onSubmitFuel)}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <FormField
                  control={fuelForm.control}
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
                    control={fuelForm.control}
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
                  control={fuelForm.control}
                  name="fuelType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de combustível</FormLabel>
                      <FormControl>
                        <Select {...field} required>
                          <option value="">Selecione...</option>
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
                  control={fuelForm.control}
                  name="liters"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Litros</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          {...field}
                          onChange={(event) => field.onChange(event.target.valueAsNumber)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={fuelForm.control}
                  name="amountPaid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor pago (R$)</FormLabel>
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
                  control={fuelForm.control}
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
                  control={fuelForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data do abastecimento</FormLabel>
                      <FormControl>
                        <DatePicker value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="sm:col-span-2 lg:col-span-3">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Registrando...' : 'Registrar abastecimento'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {canRegister && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>Filtre o histórico de abastecimentos da frota.</CardDescription>
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
                  <th className="px-2 py-2 font-medium">Combustível</th>
                  <th className="px-2 py-2 font-medium">Litros</th>
                  <th className="px-2 py-2 font-medium">Valor pago</th>
                  <th className="px-2 py-2 font-medium">KM atual</th>
                  <th className="px-2 py-2 font-medium">Consumo</th>
                  <th className="px-2 py-2 font-medium">Custo/KM</th>
                  {canManageOthers && <th className="px-2 py-2 font-medium">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {isLoadingHistory && (
                  <tr>
                    <td
                      colSpan={canManageOthers ? 10 : 9}
                      className="px-2 py-6 text-center text-muted-foreground"
                    >
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoadingHistory && history?.data.length === 0 && (
                  <tr>
                    <td
                      colSpan={canManageOthers ? 10 : 9}
                      className="px-2 py-6 text-center text-muted-foreground"
                    >
                      Nenhum abastecimento encontrado.
                    </td>
                  </tr>
                )}
                {history?.data.map((fuel) => (
                  <tr key={fuel.id} className="border-b last:border-0">
                    <td className="px-2 py-2 text-muted-foreground">{formatDateTime(fuel.date)}</td>
                    <td className="px-2 py-2 font-medium">
                      <VehicleName vehicle={fuel.vehicle} />
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{fuel.driver.name}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {fuelTypeLabels[fuel.fuelType]}
                    </td>
                    <td className="px-2 py-2">{formatNumber(fuel.liters, 2)}</td>
                    <td className="px-2 py-2">{formatCurrency(Number(fuel.amountPaid))}</td>
                    <td className="px-2 py-2">{formatNumber(fuel.currentKm)}</td>
                    <td className="px-2 py-2">
                      {fuel.consumptionKmL !== null
                        ? formatConsumption(Number(fuel.consumptionKmL))
                        : '—'}
                    </td>
                    <td className="px-2 py-2">
                      {fuel.costPerKm !== null ? formatCurrency(Number(fuel.costPerKm)) : '—'}
                    </td>
                    {canManageOthers && (
                      <td className="px-2 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditDialog(fuel)}
                        >
                          <Pencil />
                          <span className="sr-only">Editar</span>
                        </Button>
                        {isAdmin && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(fuel)}
                          >
                            <Ban />
                            <span className="sr-only">Excluir definitivamente</span>
                          </Button>
                        )}
                      </td>
                    )}
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
      )}

      <Dialog open={!!editingFuel} onOpenChange={(open) => !open && setEditingFuel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar abastecimento</DialogTitle>
            <DialogDescription>
              Atualize os dados do abastecimento de{' '}
              {editingFuel && <VehicleName vehicle={editingFuel.vehicle} />}.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onSubmitEditFuel)}
              className="grid gap-4 px-4 pb-4 sm:grid-cols-2"
            >
              <FormField
                control={editForm.control}
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
              <FormField
                control={editForm.control}
                name="fuelType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de combustível</FormLabel>
                    <FormControl>
                      <Select {...field} required>
                        <option value="">Selecione...</option>
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
                control={editForm.control}
                name="liters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Litros</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        {...field}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="amountPaid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor pago (R$)</FormLabel>
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
                control={editForm.control}
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
                control={editForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do abastecimento</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="sm:col-span-2">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
