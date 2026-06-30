import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Fuel as FuelIcon,
  Gauge,
  PieChart as PieChartIcon,
  Route as RouteIcon,
  Wallet,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartGradientDefs } from '@/components/charts/ChartGradientDefs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { StatCard } from '@/components/ui/stat-card';
import { VehicleName } from '@/components/vehicles/VehicleName';
import { api } from '@/lib/api';
import {
  chartAxisProps,
  chartGradientUrl,
  chartGridProps,
  chartTooltipProps,
} from '@/lib/chartTheme';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import type {
  DashboardQuery,
  DriverIndicator,
  RouteIndicator,
  VehicleIndicators,
} from '@/types/dashboard';
import type { CostPerKmResult, MonthlyFinanceComparison } from '@/types/finance';
import type { FuelIndicators } from '@/types/fuel';

const PIE_COLORS = ['chart-1', 'chart-3', 'chart-5', 'chart-2', 'chart-4', 'primary'];
const TOP_N = 5;

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function presetRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  return { from: formatLocalDate(from), to: formatLocalDate(to) };
}

function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: formatLocalDate(from), to: formatLocalDate(now) };
}

function formatVariation(value: number | null): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatNumber(value, 2)}%`;
}

// Agrupa os N maiores itens e soma o restante em "Outros", para os
// gráficos de pizza não ficarem poluídos com dezenas de fatias minúsculas.
function topNWithOthers<T>(
  items: T[],
  getValue: (item: T) => number,
  getName: (item: T) => string,
  topN: number,
): { name: string; value: number }[] {
  const sorted = [...items].sort((a, b) => getValue(b) - getValue(a));
  const top = sorted.slice(0, topN).map((item) => ({
    name: getName(item),
    value: getValue(item),
  }));
  const rest = sorted.slice(topN).reduce((sum, item) => sum + getValue(item), 0);

  return rest > 0 ? [...top, { name: 'Outros', value: rest }] : top;
}

export function ExecutiveDashboardPage() {
  const [filters, setFilters] = useState<DashboardQuery>(currentMonthRange());

  function setRange(range: { from: string; to: string }) {
    setFilters((prev) => ({ ...prev, ...range }));
  }

  const { data: driverIndicators, isLoading: isLoadingDrivers } = useQuery({
    queryKey: ['dashboard', 'drivers', filters],
    queryFn: async () =>
      (await api.get<DriverIndicator[]>('/dashboard/drivers', { params: filters })).data,
  });

  const { data: vehicleIndicators, isLoading: isLoadingVehicles } = useQuery({
    queryKey: ['dashboard', 'vehicles', filters],
    queryFn: async () =>
      (await api.get<VehicleIndicators>('/dashboard/vehicles', { params: filters })).data,
  });

  const { data: routeIndicators, isLoading: isLoadingRoutes } = useQuery({
    queryKey: ['dashboard', 'routes', filters],
    queryFn: async () =>
      (await api.get<RouteIndicator[]>('/dashboard/routes', { params: filters })).data,
  });

  const { data: comparison, isLoading: isLoadingComparison } = useQuery({
    queryKey: ['finance', 'comparison', filters],
    queryFn: async () =>
      (await api.get<MonthlyFinanceComparison[]>('/finance/comparison', { params: filters })).data,
  });

  const { data: costPerKm } = useQuery({
    queryKey: ['finance', 'cost-per-km', filters],
    queryFn: async () =>
      (await api.get<CostPerKmResult>('/finance/cost-per-km', { params: filters })).data,
  });

  const { data: fuelIndicators } = useQuery({
    queryKey: ['fuel', 'indicators', filters],
    queryFn: async () =>
      (
        await api.get<FuelIndicators>('/fuel/indicators', {
          params: { from: filters.from, to: filters.to },
        })
      ).data,
  });

  const isLoading = isLoadingDrivers || isLoadingVehicles || isLoadingRoutes || isLoadingComparison;

  const totals = useMemo(() => {
    const months = comparison ?? [];
    return {
      fuelCost: months.reduce((sum, m) => sum + m.fuelCost, 0),
      maintenanceCost: months.reduce((sum, m) => sum + m.maintenanceCost, 0),
      depreciation: months.reduce((sum, m) => sum + m.depreciation, 0),
      total: months.reduce((sum, m) => sum + m.total, 0),
      lastVariation: months.at(-1)?.variation ?? null,
    };
  }, [comparison]);

  const totalTrips = (routeIndicators ?? []).reduce((sum, r) => sum + r.usageCount, 0);

  const vehicles = vehicleIndicators?.vehicles ?? [];
  const fleetUtilization =
    vehicles.length > 0
      ? (vehicles.filter((v) => v.usageCount > 0).length / vehicles.length) * 100
      : null;

  const costDistribution = [
    { name: 'Combustível', value: totals.fuelCost },
    { name: 'Manutenção', value: totals.maintenanceCost },
    { name: 'Depreciação', value: totals.depreciation },
  ].filter((entry) => entry.value > 0);

  const kmByDriver = topNWithOthers(
    driverIndicators ?? [],
    (d) => d.kmTotal,
    (d) => d.driverName,
    TOP_N,
  );

  const fuelByVehicle = topNWithOthers(
    fuelIndicators?.vehicles ?? [],
    (v) => v.totalSpent,
    (v) => `${v.model} (${v.plate})`,
    TOP_N,
  );

  const monthlyChartData = (comparison ?? []).map((entry) => ({
    month: entry.month,
    Combustível: entry.fuelCost,
    Manutenção: entry.maintenanceCost,
    Depreciação: entry.depreciation,
  }));

  const routeUsageData = [...(routeIndicators ?? [])]
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, 8)
    .map((route) => ({ name: route.name, usos: route.usageCount }));

  const topDrivers = [...(driverIndicators ?? [])].sort((a, b) => a.rank - b.rank).slice(0, TOP_N);

  const vehiclesByMaintenanceCost = [...vehicles].sort(
    (a, b) => b.maintenanceCost - a.maintenanceCost,
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={PieChartIcon}
        title="Visão executiva"
        description="Indicadores consolidados da frota para apresentação à diretoria."
      />

      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
          <CardDescription>Escolha o período a ser analisado.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRange(presetRange(1))}
            >
              Hoje
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRange(presetRange(7))}
            >
              7 dias
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRange(presetRange(30))}
            >
              30 dias
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRange(currentMonthRange())}
            >
              Mês atual
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-1/2">
            <div className="grid gap-1.5">
              <Label>De</Label>
              <DatePicker
                value={filters.from}
                onChange={(value) => setFilters((prev) => ({ ...prev, from: value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Até</Label>
              <DatePicker
                value={filters.to}
                onChange={(value) => setFilters((prev) => ({ ...prev, to: value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Wallet}
          label="Custo total"
          value={isLoading ? '...' : formatCurrency(totals.total)}
          hint={
            totals.lastVariation !== null
              ? `${formatVariation(totals.lastVariation)} vs. mês anterior`
              : undefined
          }
        />
        <StatCard
          icon={FuelIcon}
          label="Custo combustível"
          value={isLoading ? '...' : formatCurrency(totals.fuelCost)}
        />
        <StatCard
          icon={Wrench}
          label="Custo manutenção"
          value={isLoading ? '...' : formatCurrency(totals.maintenanceCost)}
        />
        <StatCard
          icon={Gauge}
          label="Custo por KM"
          value={
            costPerKm?.costPerKm !== null && costPerKm?.costPerKm !== undefined
              ? `${formatCurrency(costPerKm.costPerKm)} / km`
              : '—'
          }
        />
        <StatCard
          icon={RouteIcon}
          label="KM rodado no período"
          value={costPerKm ? `${formatNumber(costPerKm.kmTotal, 0)} km` : '...'}
        />
        <StatCard
          icon={Activity}
          label="Total de viagens"
          value={isLoading ? '...' : String(totalTrips)}
          hint={
            fleetUtilization !== null
              ? `${formatNumber(fleetUtilization, 0)}% da frota em uso`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de custos</CardTitle>
            <CardDescription>Combustível, manutenção e depreciação no período.</CardDescription>
          </CardHeader>
          <CardContent>
            {costDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartGradientDefs />
                    <Pie
                      data={costDistribution}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {costDistribution.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={chartGradientUrl(PIE_COLORS[index % PIE_COLORS.length])}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução mensal de custos</CardTitle>
            <CardDescription>Combustível, manutenção e depreciação por mês.</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData}>
                    <ChartGradientDefs />
                    <CartesianGrid {...chartGridProps} />
                    <XAxis dataKey="month" {...chartAxisProps} />
                    <YAxis {...chartAxisProps} />
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                    <Bar dataKey="Combustível" stackId="cost" fill={chartGradientUrl('chart-1')} />
                    <Bar dataKey="Manutenção" stackId="cost" fill={chartGradientUrl('chart-3')} />
                    <Bar
                      dataKey="Depreciação"
                      stackId="cost"
                      fill={chartGradientUrl('chart-5')}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>KM por motorista</CardTitle>
            <CardDescription>Participação de cada motorista no KM total rodado.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {kmByDriver.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartGradientDefs />
                    <Pie data={kmByDriver} dataKey="value" nameKey="name" outerRadius={90}>
                      {kmByDriver.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={chartGradientUrl(PIE_COLORS[index % PIE_COLORS.length])}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value) => `${formatNumber(Number(value))} km`}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-2 py-2 font-medium">Motorista</th>
                  <th className="px-2 py-2 font-medium">KM total</th>
                  <th className="px-2 py-2 font-medium">Ocorrências</th>
                </tr>
              </thead>
              <tbody>
                {topDrivers.map((driver) => (
                  <tr key={driver.driverId} className="border-b last:border-0">
                    <td className="px-2 py-2 font-medium">{driver.driverName}</td>
                    <td className="px-2 py-2">{formatNumber(driver.kmTotal)} km</td>
                    <td className="px-2 py-2">{driver.incidentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uso por rota</CardTitle>
            <CardDescription>Quantas vezes cada rota foi utilizada no período.</CardDescription>
          </CardHeader>
          <CardContent>
            {routeUsageData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={routeUsageData} layout="vertical" margin={{ left: 24 }}>
                    <ChartGradientDefs />
                    <CartesianGrid {...chartGridProps} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} {...chartAxisProps} />
                    <YAxis type="category" dataKey="name" width={140} {...chartAxisProps} />
                    <Tooltip {...chartTooltipProps} />
                    <Bar dataKey="usos" fill={chartGradientUrl('route')} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Combustível</CardTitle>
            <CardDescription>Consumo médio e gasto por veículo no período.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground uppercase">Mais econômico</p>
                <p className="text-lg font-semibold">
                  {fuelIndicators?.mostEconomical ? (
                    <VehicleName vehicle={fuelIndicators.mostEconomical} />
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground uppercase">Menos econômico</p>
                <p className="text-lg font-semibold">
                  {fuelIndicators?.mostExpensive ? (
                    <VehicleName vehicle={fuelIndicators.mostExpensive} />
                  ) : (
                    '—'
                  )}
                </p>
              </div>
            </div>
            {fuelByVehicle.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <ChartGradientDefs />
                    <Pie data={fuelByVehicle} dataKey="value" nameKey="name" outerRadius={90}>
                      {fuelByVehicle.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={chartGradientUrl(PIE_COLORS[index % PIE_COLORS.length])}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      {...chartTooltipProps}
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manutenção por veículo</CardTitle>
            <CardDescription>Custo de manutenção individual no período.</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-2 py-2 font-medium">Veículo</th>
                  <th className="px-2 py-2 font-medium">Combustível</th>
                  <th className="px-2 py-2 font-medium">Manutenção</th>
                  <th className="px-2 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {vehiclesByMaintenanceCost.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-6 text-center text-muted-foreground">
                      Sem dados no período.
                    </td>
                  </tr>
                )}
                {vehiclesByMaintenanceCost.map((vehicle) => (
                  <tr key={vehicle.vehicleId} className="border-b last:border-0">
                    <td className="px-2 py-2 font-medium">
                      <VehicleName vehicle={vehicle} />
                    </td>
                    <td className="px-2 py-2">{formatCurrency(vehicle.fuelCost)}</td>
                    <td className="px-2 py-2">{formatCurrency(vehicle.maintenanceCost)}</td>
                    <td className="px-2 py-2">{formatCurrency(vehicle.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
