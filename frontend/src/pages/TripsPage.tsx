import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { FinishTripSheet } from '@/components/trips/FinishTripSheet';
import { VehicleName } from '@/components/vehicles/VehicleName';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import type {
  CreateTripPayload,
  FinishTripPayload,
  TripQuery,
  TripWithRelations,
} from '@/types/trip';
import type { Driver } from '@/types/driver';
import type { Route } from '@/types/route';
import type { Vehicle } from '@/types/vehicle';

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function formatDateTime(value: string | null): string {
  return value ? dateTimeFormatter.format(new Date(value)) : '—';
}

function formatNumber(value: string | null): string {
  return value !== null ? Number(value).toFixed(1) : '—';
}

const statusLabels: Record<TripWithRelations['status'], string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADA: 'Finalizada',
  ATRASADA: 'Atrasada',
};

function StatusBadge({ status }: { status: TripWithRelations['status'] }) {
  if (status === 'ATRASADA') {
    return <Badge variant="destructive">{statusLabels[status]}</Badge>;
  }
  if (status === 'FINALIZADA') {
    return <Badge variant="outline">{statusLabels[status]}</Badge>;
  }
  return <Badge variant="default">{statusLabels[status]}</Badge>;
}

const tripSchema = z.object({
  vehicleId: z.string().min(1, 'Selecione o veículo.'),
  driverId: z.string(),
  routeId: z.string(),
  destination: z.string().min(1, 'Informe o destino da viagem.'),
  startKm: z
    .number({ message: 'Informe o KM de retirada.' })
    .min(0, 'O KM de retirada não pode ser negativo.'),
});

type TripFormValues = z.infer<typeof tripSchema>;

const EMPTY_TRIP_VALUES: TripFormValues = {
  vehicleId: '',
  driverId: '',
  routeId: '',
  destination: '',
  startKm: 0,
};

export function TripsPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManageOthers = hasRole('ADMIN', 'COORDENACAO');

  const [filters, setFilters] = useState<TripQuery>({});
  const [finishSheetOpen, setFinishSheetOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripWithRelations | null>(null);

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

  const { data: allTrips, isLoading: isLoadingOngoing } = useQuery({
    queryKey: ['trips', 'all'],
    queryFn: async () => (await api.get<TripWithRelations[]>('/trips')).data,
  });

  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['trips', 'history', filters],
    queryFn: async () => (await api.get<TripWithRelations[]>('/trips', { params: filters })).data,
  });

  const invalidateTrips = () => queryClient.invalidateQueries({ queryKey: ['trips'] });

  const tripForm = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: EMPTY_TRIP_VALUES,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreateTripPayload) => api.post('/trips', payload),
    onSuccess: () => {
      toast.success('Viagem iniciada com sucesso.');
      tripForm.reset(EMPTY_TRIP_VALUES);
      invalidateTrips();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível iniciar a viagem.'));
    },
  });

  const finishMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: FinishTripPayload }) =>
      api.patch(`/trips/${id}/finish`, payload),
    onSuccess: () => {
      toast.success('Viagem encerrada com sucesso.');
      setFinishSheetOpen(false);
      invalidateTrips();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível encerrar a viagem.'));
    },
  });

  const ongoingTrips = (allTrips ?? []).filter((trip) => trip.status !== 'FINALIZADA');
  const activeVehicles = (vehicles ?? []).filter((vehicle) => vehicle.active);
  const activeDrivers = (drivers ?? []).filter((driver) => driver.active);
  const activeRoutes = (routes ?? []).filter((route) => route.active);

  function onSubmitTrip(values: TripFormValues) {
    createMutation.mutate({
      vehicleId: values.vehicleId,
      driverId: values.driverId || undefined,
      routeId: values.routeId || undefined,
      destination: values.destination,
      startKm: values.startKm,
    });
  }

  function openFinishSheet(trip: TripWithRelations) {
    setSelectedTrip(trip);
    setFinishSheetOpen(true);
  }

  function handleFinishSubmit(id: string, payload: FinishTripPayload) {
    finishMutation.mutate({ id, payload });
  }

  function handleFilterChange<K extends keyof TripQuery>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (value || undefined) as TripQuery[K] }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Viagens</h2>
        <p className="text-sm text-muted-foreground">
          Controle as viagens da frota, acompanhe atrasos e registre o encerramento.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Viagens em andamento</CardTitle>
          <CardDescription>
            Viagens que ainda não foram encerradas, incluindo as marcadas como atrasadas.
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
                <th className="px-2 py-2 font-medium">Início</th>
                <th className="px-2 py-2 font-medium">KM retirada</th>
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
              {!isLoadingOngoing && ongoingTrips.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                    Nenhuma viagem em andamento.
                  </td>
                </tr>
              )}
              {ongoingTrips.map((trip) => (
                <tr key={trip.id} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">
                    <VehicleName vehicle={trip.vehicle} />
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{trip.driver.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{trip.route.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{trip.destination}</td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {formatDateTime(trip.startedAt)}
                  </td>
                  <td className="px-2 py-2">{formatNumber(trip.startKm)}</td>
                  <td className="px-2 py-2">
                    <StatusBadge status={trip.status} />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Button size="sm" onClick={() => openFinishSheet(trip)}>
                      Encerrar viagem
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
          <CardTitle>Iniciar viagem</CardTitle>
          <CardDescription>
            Informe o veículo, o destino e o KM de retirada para iniciar uma nova viagem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...tripForm}>
            <form
              onSubmit={tripForm.handleSubmit(onSubmitTrip)}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <FormField
                control={tripForm.control}
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
                  control={tripForm.control}
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
                control={tripForm.control}
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
                control={tripForm.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destino</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={tripForm.control}
                name="startKm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>KM de retirada</FormLabel>
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
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Iniciando...' : 'Iniciar viagem'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardDescription>Filtre o histórico de viagens da frota.</CardDescription>
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
                <option value="FINALIZADA">Finalizada</option>
                <option value="ATRASADA">Atrasada</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>De</Label>
              <Input
                type="date"
                value={filters.from ?? ''}
                onChange={(event) => handleFilterChange('from', event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Até</Label>
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
                <th className="px-2 py-2 font-medium">Veículo</th>
                <th className="px-2 py-2 font-medium">Motorista</th>
                <th className="px-2 py-2 font-medium">Rota</th>
                <th className="px-2 py-2 font-medium">Destino</th>
                <th className="px-2 py-2 font-medium">Início</th>
                <th className="px-2 py-2 font-medium">Encerramento</th>
                <th className="px-2 py-2 font-medium">KM retirada</th>
                <th className="px-2 py-2 font-medium">KM devolução</th>
                <th className="px-2 py-2 font-medium">Status</th>
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
              {!isLoadingHistory && history?.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">
                    Nenhuma viagem encontrada.
                  </td>
                </tr>
              )}
              {history?.map((trip) => (
                <tr key={trip.id} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">
                    <VehicleName vehicle={trip.vehicle} />
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{trip.driver.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{trip.route.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{trip.destination}</td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {formatDateTime(trip.startedAt)}
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">
                    {formatDateTime(trip.finishedAt)}
                  </td>
                  <td className="px-2 py-2">{formatNumber(trip.startKm)}</td>
                  <td className="px-2 py-2">{formatNumber(trip.endKm)}</td>
                  <td className="px-2 py-2">
                    <StatusBadge status={trip.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <FinishTripSheet
        open={finishSheetOpen}
        trip={selectedTrip}
        isSubmitting={finishMutation.isPending}
        onOpenChange={setFinishSheetOpen}
        onSubmit={handleFinishSubmit}
      />
    </div>
  );
}
