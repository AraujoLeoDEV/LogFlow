import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, ClipboardList } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { ReturnDailyLogSheet } from '@/components/daily-logs/ReturnDailyLogSheet';
import { VehicleName } from '@/components/vehicles/VehicleName';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { formatDateTime, formatNumber } from '@/lib/formatters';
import type {
  CreateDailyLogPayload,
  DailyLogQuery,
  DailyLogWithRelations,
  ReturnDailyLogPayload,
} from '@/types/dailyLog';
import type { Driver } from '@/types/driver';
import type { PaginatedResult } from '@/types/pagination';
import type { Route } from '@/types/route';
import type { Vehicle } from '@/types/vehicle';

function formatDuration(minutes: number | null): string {
  if (minutes === null) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
}

const statusLabels: Record<DailyLogWithRelations['status'], string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
  ATRASADO: 'Atrasado',
};

function StatusBadge({ status }: { status: DailyLogWithRelations['status'] }) {
  if (status === 'ATRASADO') {
    return <Badge variant="destructive">{statusLabels[status]}</Badge>;
  }
  if (status === 'FINALIZADO') {
    return <Badge variant="outline">{statusLabels[status]}</Badge>;
  }
  return <Badge variant="default">{statusLabels[status]}</Badge>;
}

const departureSchema = z.object({
  vehicleId: z.string().min(1, 'Selecione o veículo.'),
  driverId: z.string(),
  routeId: z.string(),
  destination: z.string(),
  startKm: z
    .number({ message: 'Informe o KM inicial.' })
    .min(0, 'O KM inicial não pode ser negativo.'),
  observations: z.string(),
  departureAt: z.string().min(1, 'Informe a data da saída.'),
});

type DepartureFormValues = z.infer<typeof departureSchema>;

function getTodayDateOnly(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function getEmptyDepartureValues(): DepartureFormValues {
  return {
    vehicleId: '',
    driverId: '',
    routeId: '',
    destination: '',
    startKm: 0,
    observations: '',
    departureAt: getTodayDateOnly(),
  };
}

export function DailyLogsPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const canManageOthers = hasRole('ADMIN', 'COORDENACAO');

  const [filters, setFilters] = useState<DailyLogQuery>({});
  const [page, setPage] = useState(1);
  const [returnSheetOpen, setReturnSheetOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DailyLogWithRelations | null>(null);

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/vehicles')).data,
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => (await api.get<Driver[]>('/drivers')).data,
    enabled: canManageOthers,
  });

  const { data: routes } = useQuery({
    queryKey: ['routes'],
    queryFn: async () => (await api.get<Route[]>('/routes')).data,
  });

  const { data: allLogs, isLoading: isLoadingOngoing } = useQuery({
    queryKey: ['daily-logs', 'ongoing'],
    queryFn: async () =>
      (
        await api.get<PaginatedResult<DailyLogWithRelations>>('/daily-logs', {
          params: { limit: 100 } satisfies DailyLogQuery,
        })
      ).data.data,
  });

  const ongoingLogs = (allLogs ?? []).filter((log) => log.status !== 'FINALIZADO');

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['daily-logs', 'history', filters, page],
    queryFn: async () =>
      (
        await api.get<PaginatedResult<DailyLogWithRelations>>('/daily-logs', {
          params: { ...filters, page },
        })
      ).data,
  });

  const invalidateDailyLogs = () => queryClient.invalidateQueries({ queryKey: ['daily-logs'] });

  const departureForm = useForm<DepartureFormValues>({
    resolver: zodResolver(departureSchema),
    defaultValues: getEmptyDepartureValues(),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateDailyLogPayload) => api.post('/daily-logs', payload),
    onSuccess: () => {
      toast.success('Saída registrada com sucesso.');
      departureForm.reset(getEmptyDepartureValues());
      invalidateDailyLogs();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível registrar a saída.'));
    },
  });

  const returnMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: ReturnDailyLogPayload }) =>
      api.patch(`/daily-logs/${id}/return`, payload),
    onSuccess: () => {
      toast.success('Retorno registrado com sucesso.');
      setReturnSheetOpen(false);
      invalidateDailyLogs();
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível registrar o retorno.'));
    },
  });

  const ongoingVehicleIds = new Set(ongoingLogs.map((log) => log.vehicleId));
  const availableVehicles = (vehicles ?? []).filter(
    (vehicle) => vehicle.active && !ongoingVehicleIds.has(vehicle.id),
  );
  const activeDrivers = (drivers ?? []).filter((driver) => driver.active);
  const activeRoutes = (routes ?? []).filter((route) => route.active);

  const selectedVehicleId = departureForm.watch('vehicleId');

  useEffect(() => {
    const vehicle = (vehicles ?? []).find((item) => item.id === selectedVehicleId);
    if (vehicle) {
      departureForm.setValue('startKm', Number(vehicle.currentKm));
    }
  }, [selectedVehicleId, vehicles, departureForm]);

  function onSubmitDeparture(values: DepartureFormValues) {
    createMutation.mutate({
      vehicleId: values.vehicleId,
      driverId: values.driverId || undefined,
      routeId: values.routeId || undefined,
      destination: values.destination || undefined,
      startKm: values.startKm,
      observations: values.observations || undefined,
      departureAt: new Date(`${values.departureAt}T00:00:00`).toISOString(),
    });
  }

  function openReturnSheet(log: DailyLogWithRelations) {
    setSelectedLog(log);
    setReturnSheetOpen(true);
  }

  function handleReturnSubmit(id: string, payload: ReturnDailyLogPayload) {
    returnMutation.mutate({ id, payload });
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/daily-logs/${id}`),
    onSuccess: () => {
      toast.success('Registro diário excluído definitivamente.');
      invalidateDailyLogs();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível excluir o registro diário.'));
    },
  });

  function handleDelete(log: DailyLogWithRelations) {
    if (
      window.confirm(
        `Excluir DEFINITIVAMENTE o registro diário de ${formatDateTime(log.departureAt)}? Essa ação não pode ser desfeita.`,
      )
    ) {
      deleteMutation.mutate(log.id);
    }
  }

  function handleFilterChange<K extends keyof DailyLogQuery>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (value || undefined) as DailyLogQuery[K] }));
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={ClipboardList}
        title="Registro Diário"
        description="Registre a saída e o retorno dos veículos e acompanhe o histórico de uso da frota."
      />

      <Card>
        <CardHeader>
          <CardTitle>Saídas em andamento</CardTitle>
          <CardDescription>
            Veículos que ainda não tiveram o retorno registrado, incluindo os marcados como
            atrasados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-2 py-2 font-medium">Veículo</th>
                <th className="px-2 py-2 font-medium">Motorista</th>
                <th className="px-2 py-2 font-medium">Rota</th>
                <th className="px-2 py-2 font-medium">Destino</th>
                <th className="px-2 py-2 font-medium">Saída</th>
                <th className="px-2 py-2 font-medium">KM inicial</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingOngoing && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoadingOngoing && ongoingLogs.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                    Nenhuma saída em andamento.
                  </td>
                </tr>
              )}
              {ongoingLogs.map((log) => (
                <tr key={log.id} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">
                    <VehicleName vehicle={log.vehicle} />
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{log.driver.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{log.route.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{log.destination ?? '—'}</td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {formatDateTime(log.departureAt)}
                  </td>
                  <td className="px-2 py-2">{formatNumber(log.startKm)}</td>
                  <td className="px-2 py-2">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Button size="sm" onClick={() => openReturnSheet(log)}>
                      Registrar retorno
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrar saída</CardTitle>
          <CardDescription>
            Informe o veículo e o KM inicial para iniciar uma nova rota.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...departureForm}>
            <form
              onSubmit={departureForm.handleSubmit(onSubmitDeparture)}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <FormField
                control={departureForm.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Veículo</FormLabel>
                    <FormControl>
                      <Select {...field} required>
                        <option value="">Selecione...</option>
                        {availableVehicles.map((vehicle) => (
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
                  control={departureForm.control}
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
                control={departureForm.control}
                name="routeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rota</FormLabel>
                    <FormControl>
                      <Select {...field}>
                        <option value="">Usar rota padrão do motorista</option>
                        {activeRoutes.map((route) => (
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
                control={departureForm.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destino (opcional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={departureForm.control}
                name="startKm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>KM inicial</FormLabel>
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
                control={departureForm.control}
                name="departureAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data da saída</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={departureForm.control}
                name="observations"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-3">
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Registrando...' : 'Registrar saída'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Filtre o histórico de saídas e retornos da frota.</CardDescription>
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
              <Label>Rota</Label>
              <Select
                value={filters.routeId ?? ''}
                onChange={(event) => handleFilterChange('routeId', event.target.value)}
              >
                <option value="">Todas</option>
                {(routes ?? []).map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={filters.status ?? ''}
                onChange={(event) => handleFilterChange('status', event.target.value)}
              >
                <option value="">Todos</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="FINALIZADO">Finalizado</option>
                <option value="ATRASADO">Atrasado</option>
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
                <th className="px-2 py-2 font-medium">Veículo</th>
                <th className="px-2 py-2 font-medium">Motorista</th>
                <th className="px-2 py-2 font-medium">Rota</th>
                <th className="px-2 py-2 font-medium">Destino</th>
                <th className="px-2 py-2 font-medium">Saída</th>
                <th className="px-2 py-2 font-medium">Retorno</th>
                <th className="px-2 py-2 font-medium">KM rodado</th>
                <th className="px-2 py-2 font-medium">Duração</th>
                <th className="px-2 py-2 font-medium">Vel. média</th>
                <th className="px-2 py-2 font-medium">Status</th>
                {isAdmin && <th className="px-2 py-2 font-medium">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {isLoadingHistory && (
                <tr>
                  <td
                    colSpan={isAdmin ? 11 : 10}
                    className="px-2 py-6 text-center text-muted-foreground"
                  >
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoadingHistory && history?.data.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 11 : 10}
                    className="px-2 py-6 text-center text-muted-foreground"
                  >
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
              {history?.data.map((log) => (
                <tr key={log.id} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">
                    <VehicleName vehicle={log.vehicle} />
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{log.driver.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{log.route.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{log.destination ?? '—'}</td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {formatDateTime(log.departureAt)}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {formatDateTime(log.returnAt)}
                  </td>
                  <td className="px-2 py-2">{formatNumber(log.kmDriven)}</td>
                  <td className="px-2 py-2">{formatDuration(log.totalDurationMinutes)}</td>
                  <td className="px-2 py-2">{formatNumber(log.avgSpeedKmh)}</td>
                  <td className="px-2 py-2">
                    <StatusBadge status={log.status} />
                  </td>
                  {isAdmin && (
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(log)}
                      >
                        <Ban />
                        <span className="sr-only">Excluir definitivamente</span>
                      </Button>
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

      <ReturnDailyLogSheet
        open={returnSheetOpen}
        dailyLog={selectedLog}
        isSubmitting={returnMutation.isPending}
        onOpenChange={setReturnSheetOpen}
        onSubmit={handleReturnSubmit}
      />
    </div>
  );
}
