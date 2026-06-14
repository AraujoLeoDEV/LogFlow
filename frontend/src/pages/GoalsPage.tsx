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
import type { Driver } from '@/types/driver';
import type {
  CreateGoalPayload,
  GoalQuery,
  GoalRankingEntry,
  GoalStatus,
  GoalWithRelations,
  UpdateGoalPayload,
} from '@/types/goal';
import type { Vehicle } from '@/types/vehicle';

const statusLabels: Record<GoalStatus, string> = {
  ABERTA: 'Aberta',
  ATINGIDA: 'Atingida',
  NAO_ATINGIDA: 'Não atingida',
};

const statusOptions: { value: GoalStatus; label: string }[] = [
  { value: 'ABERTA', label: 'Aberta' },
  { value: 'ATINGIDA', label: 'Atingida' },
  { value: 'NAO_ATINGIDA', label: 'Não atingida' },
];

function statusBadgeVariant(status: GoalStatus): 'secondary' | 'default' | 'destructive' {
  if (status === 'ATINGIDA') return 'default';
  if (status === 'NAO_ATINGIDA') return 'destructive';
  return 'secondary';
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatCurrency(value: string | number | null): string {
  return value !== null ? currencyFormatter.format(Number(value)) : '—';
}

function formatConsumption(value: string | number | null): string {
  return value !== null ? `${Number(value).toFixed(2)} km/L` : '—';
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const goalSchema = z.object({
  targetType: z.enum(['driver', 'vehicle']),
  entityId: z.string().min(1, 'Selecione o motorista ou o veículo.'),
  period: z
    .string()
    .min(1, 'Informe o período.')
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Período inválido. Use o formato AAAA-MM.'),
  targetValue: z
    .number({ message: 'Informe a meta de consumo.' })
    .min(0.001, 'A meta deve ser maior que zero.'),
});

type GoalFormValues = z.infer<typeof goalSchema>;

const EMPTY_VALUES: GoalFormValues = {
  targetType: 'driver',
  entityId: '',
  period: currentPeriod(),
  targetValue: 0,
};

export function GoalsPage() {
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole('ADMIN', 'COORDENACAO');

  const [filters, setFilters] = useState<GoalQuery>({});
  const [rankingPeriod, setRankingPeriod] = useState(currentPeriod());
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => (await api.get<Driver[]>('/drivers')).data,
    enabled: canManage,
  });

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/vehicles')).data,
    enabled: canManage,
  });

  const { data: goals, isLoading: isLoadingGoals } = useQuery({
    queryKey: ['goals', filters],
    queryFn: async () => (await api.get<GoalWithRelations[]>('/goals', { params: filters })).data,
    enabled: canManage,
  });

  const { data: ranking, isLoading: isLoadingRanking } = useQuery({
    queryKey: ['goals', 'ranking', rankingPeriod],
    queryFn: async () =>
      (
        await api.get<GoalRankingEntry[]>('/goals/ranking', {
          params: { period: rankingPeriod },
        })
      ).data,
    enabled: canManage && rankingPeriod.length > 0,
  });

  const invalidateGoals = () => {
    queryClient.invalidateQueries({ queryKey: ['goals'] });
  };

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: EMPTY_VALUES,
  });

  const targetType = form.watch('targetType');

  const createMutation = useMutation({
    mutationFn: async (payload: CreateGoalPayload) => api.post('/goals', payload),
    onSuccess: () => {
      toast.success('Meta cadastrada com sucesso.');
      form.reset(EMPTY_VALUES);
      invalidateGoals();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível cadastrar a meta.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateGoalPayload }) =>
      api.patch(`/goals/${id}`, payload),
    onSuccess: () => {
      toast.success('Meta atualizada com sucesso.');
      form.reset(EMPTY_VALUES);
      setEditingId(null);
      invalidateGoals();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar a meta.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/goals/${id}`),
    onSuccess: () => {
      toast.success('Meta removida com sucesso.');
      invalidateGoals();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível remover a meta.'));
    },
  });

  const activeDrivers = (drivers ?? []).filter((driver) => driver.active);
  const activeVehicles = (vehicles ?? []).filter((vehicle) => vehicle.active);

  function onSubmit(values: GoalFormValues) {
    const payload: CreateGoalPayload = {
      type: 'CONSUMPTION_REDUCTION',
      period: values.period,
      targetValue: values.targetValue,
      driverId: values.targetType === 'driver' ? values.entityId : undefined,
      vehicleId: values.targetType === 'vehicle' ? values.entityId : undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleEdit(goal: GoalWithRelations) {
    setEditingId(goal.id);
    form.reset({
      targetType: goal.driverId ? 'driver' : 'vehicle',
      entityId: goal.driverId ?? goal.vehicleId ?? '',
      period: goal.period,
      targetValue: Number(goal.targetValue),
    });
  }

  function handleCancelEdit() {
    setEditingId(null);
    form.reset(EMPTY_VALUES);
  }

  function handleDelete(id: string) {
    if (window.confirm('Tem certeza que deseja remover esta meta?')) {
      deleteMutation.mutate(id);
    }
  }

  function handleFilterChange<K extends keyof GoalQuery>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (value || undefined) as GoalQuery[K] }));
  }

  function entityDisplay(goal: GoalWithRelations | GoalRankingEntry) {
    if ('driver' in goal) {
      if (goal.driver) return goal.driver.name;
      if (goal.vehicle) return <VehicleName vehicle={goal.vehicle} />;
      return '—';
    }
    if (goal.driverName) return goal.driverName;
    if (goal.vehiclePlate) {
      return (
        <VehicleName
          vehicle={{
            plate: goal.vehiclePlate,
            model: goal.vehicleModel ?? goal.vehiclePlate,
            currentKm: goal.vehicleCurrentKm ?? '0',
          }}
        />
      );
    }
    return '—';
  }

  if (!canManage) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Metas e Comissão</h2>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Metas e Comissão</h2>
        <p className="text-sm text-muted-foreground">
          Defina metas de redução de consumo por motorista ou veículo e acompanhe o resultado real e
          a comissão apurada ao final de cada período.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Editar meta' : 'Cadastrar meta'}</CardTitle>
          <CardDescription>
            Informe o motorista ou o veículo, o período de referência (AAAA-MM) e a meta de consumo
            médio (km/L).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <FormField
                control={form.control}
                name="targetType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vínculo</FormLabel>
                    <FormControl>
                      <Select
                        {...field}
                        onChange={(event) => {
                          field.onChange(event.target.value);
                          form.setValue('entityId', '');
                        }}
                      >
                        <option value="driver">Motorista</option>
                        <option value="vehicle">Veículo</option>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{targetType === 'driver' ? 'Motorista' : 'Veículo'}</FormLabel>
                    <FormControl>
                      <Select {...field} required>
                        <option value="">Selecione...</option>
                        {targetType === 'driver'
                          ? activeDrivers.map((driver) => (
                              <option key={driver.id} value={driver.id}>
                                {driver.name}
                              </option>
                            ))
                          : activeVehicles.map((vehicle) => (
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
                name="period"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Período</FormLabel>
                    <FormControl>
                      <Input type="month" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meta de consumo (km/L)</FormLabel>
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
              <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId
                    ? updateMutation.isPending
                      ? 'Salvando...'
                      : 'Salvar alterações'
                    : createMutation.isPending
                      ? 'Cadastrando...'
                      : 'Cadastrar meta'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    Cancelar edição
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metas cadastradas</CardTitle>
          <CardDescription>
            Filtre as metas cadastradas e acompanhe o resultado apurado.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="grid gap-1.5">
              <Label>Motorista</Label>
              <Select
                value={filters.driverId ?? ''}
                onChange={(event) => handleFilterChange('driverId', event.target.value)}
              >
                <option value="">Todos</option>
                {activeDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Veículo</Label>
              <Select
                value={filters.vehicleId ?? ''}
                onChange={(event) => handleFilterChange('vehicleId', event.target.value)}
              >
                <option value="">Todos</option>
                {activeVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.model} ({vehicle.plate})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Período</Label>
              <Input
                type="month"
                value={filters.period ?? ''}
                onChange={(event) => handleFilterChange('period', event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select
                value={filters.status ?? ''}
                onChange={(event) => handleFilterChange('status', event.target.value)}
              >
                <option value="">Todos</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-2 py-2 font-medium">Período</th>
                <th className="px-2 py-2 font-medium">Vínculo</th>
                <th className="px-2 py-2 font-medium">Meta</th>
                <th className="px-2 py-2 font-medium">Real</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Comissão</th>
                <th className="px-2 py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingGoals && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoadingGoals && goals?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    Nenhuma meta cadastrada.
                  </td>
                </tr>
              )}
              {goals?.map((goal) => (
                <tr key={goal.id} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">{goal.period}</td>
                  <td className="px-2 py-2 text-muted-foreground">{entityDisplay(goal)}</td>
                  <td className="px-2 py-2">{formatConsumption(goal.targetValue)}</td>
                  <td className="px-2 py-2">{formatConsumption(goal.actualValue)}</td>
                  <td className="px-2 py-2">
                    <Badge variant={statusBadgeVariant(goal.status)}>
                      {statusLabels[goal.status]}
                    </Badge>
                  </td>
                  <td className="px-2 py-2">{formatCurrency(goal.commissionValue)}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(goal)}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(goal.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ranking</CardTitle>
          <CardDescription>
            Comparativo real vs. meta no período, ordenado pela maior economia obtida.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-1.5 sm:w-48">
            <Label>Período</Label>
            <Input
              type="month"
              value={rankingPeriod}
              onChange={(event) => setRankingPeriod(event.target.value)}
            />
          </div>

          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-2 py-2 font-medium">Posição</th>
                <th className="px-2 py-2 font-medium">Vínculo</th>
                <th className="px-2 py-2 font-medium">Meta</th>
                <th className="px-2 py-2 font-medium">Real</th>
                <th className="px-2 py-2 font-medium">Diferença</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingRanking && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoadingRanking && ranking?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    Nenhuma meta encontrada para o período.
                  </td>
                </tr>
              )}
              {ranking?.map((entry, index) => (
                <tr key={entry.goalId} className="border-b last:border-0">
                  <td className="px-2 py-2 font-medium">{index + 1}º</td>
                  <td className="px-2 py-2 text-muted-foreground">{entityDisplay(entry)}</td>
                  <td className="px-2 py-2">{formatConsumption(entry.targetValue)}</td>
                  <td className="px-2 py-2">{formatConsumption(entry.actualValue)}</td>
                  <td className="px-2 py-2">
                    {entry.difference !== null ? `${entry.difference.toFixed(2)} km/L` : '—'}
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant={statusBadgeVariant(entry.status)}>
                      {statusLabels[entry.status]}
                    </Badge>
                  </td>
                  <td className="px-2 py-2">{formatCurrency(entry.commissionValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
