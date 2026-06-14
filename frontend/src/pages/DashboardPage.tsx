import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { ChartGradientDefs } from '@/components/charts/ChartGradientDefs';
import { VehicleName } from '@/components/vehicles/VehicleName';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  chartAxisProps,
  chartGradientUrl,
  chartGridProps,
  chartTooltipProps,
} from '@/lib/chartTheme';
import type {
  DashboardQuery,
  DriverIndicator,
  RouteIndicator,
  VehicleIndicators,
} from '@/types/dashboard';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function formatCurrency(value: number | null): string {
  return value !== null ? currencyFormatter.format(value) : '—';
}

function formatNumber(value: number, fractionDigits = 1): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: fractionDigits });
}

function formatRate(value: number | null): string {
  return value !== null ? `${numberFormatter.format(value)} / 1.000 km` : '—';
}

export function DashboardPage() {
  const { hasRole } = useAuth();
  const canViewDrivers = hasRole('ADMIN', 'COORDENACAO');
  const canViewVehicles = hasRole('ADMIN', 'COORDENACAO', 'FINANCEIRO');
  const canViewRoutes = hasRole('ADMIN', 'COORDENACAO');

  const [filters, setFilters] = useState<DashboardQuery>({});

  function handleFilterChange<K extends keyof DashboardQuery>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (value || undefined) as DashboardQuery[K] }));
  }

  const { data: driverIndicators, isLoading: isLoadingDrivers } = useQuery({
    queryKey: ['dashboard', 'drivers', filters],
    queryFn: async () =>
      (await api.get<DriverIndicator[]>('/dashboard/drivers', { params: filters })).data,
    enabled: canViewDrivers,
  });

  const { data: vehicleIndicators, isLoading: isLoadingVehicles } = useQuery({
    queryKey: ['dashboard', 'vehicles', filters],
    queryFn: async () =>
      (await api.get<VehicleIndicators>('/dashboard/vehicles', { params: filters })).data,
    enabled: canViewVehicles,
  });

  const { data: routeIndicators, isLoading: isLoadingRoutes } = useQuery({
    queryKey: ['dashboard', 'routes', filters],
    queryFn: async () =>
      (await api.get<RouteIndicator[]>('/dashboard/routes', { params: filters })).data,
    enabled: canViewRoutes,
  });

  const driverChartData = (driverIndicators ?? []).map((driver) => ({
    name: driver.driverName,
    kmTotal: driver.kmTotal,
  }));

  const vehicleChartData = (vehicleIndicators?.vehicles ?? []).map((vehicle) => ({
    name: vehicle.model,
    kmTotal: vehicle.kmTotal,
  }));

  const routeChartData = (routeIndicators ?? []).map((route) => ({
    name: route.name,
    usageCount: route.usageCount,
  }));

  const defaultTab = canViewDrivers ? 'drivers' : canViewVehicles ? 'vehicles' : 'routes';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Indicadores gerais da frota.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
          <CardDescription>Filtre os indicadores por período (opcional).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-1/2">
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
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {canViewDrivers && <TabsTab value="drivers">Motoristas</TabsTab>}
          {canViewVehicles && <TabsTab value="vehicles">Veículos</TabsTab>}
          {canViewRoutes && <TabsTab value="routes">Rotas</TabsTab>}
        </TabsList>

        {canViewDrivers && (
          <TabsPanel value="drivers">
            <Card>
              <CardHeader>
                <CardTitle>Indicadores por motorista</CardTitle>
                <CardDescription>
                  KM total rodado, horas dirigidas, ocorrências e índice de ocorrências por KM.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                {isLoadingDrivers && <p className="text-sm text-muted-foreground">Carregando...</p>}
                {!isLoadingDrivers && driverIndicators && (
                  <>
                    <table className="w-full text-sm">
                      <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-2 py-2 font-medium">Ranking</th>
                          <th className="px-2 py-2 font-medium">Motorista</th>
                          <th className="px-2 py-2 font-medium">KM total</th>
                          <th className="px-2 py-2 font-medium">Horas dirigidas</th>
                          <th className="px-2 py-2 font-medium">Ocorrências</th>
                          <th className="px-2 py-2 font-medium">Ocorrências/KM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {driverIndicators.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                              Nenhum motorista encontrado.
                            </td>
                          </tr>
                        )}
                        {driverIndicators.map((driver) => (
                          <tr key={driver.driverId} className="border-b last:border-0">
                            <td className="px-2 py-2 font-medium">{driver.rank}</td>
                            <td className="px-2 py-2">{driver.driverName}</td>
                            <td className="px-2 py-2">{formatNumber(driver.kmTotal)} km</td>
                            <td className="px-2 py-2">{formatNumber(driver.drivingHours, 2)} h</td>
                            <td className="px-2 py-2">{driver.incidentCount}</td>
                            <td className="px-2 py-2">
                              {formatRate(driver.incidentRatePer1000Km)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {driverChartData.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">KM total por motorista</p>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={driverChartData}>
                              <ChartGradientDefs />
                              <CartesianGrid {...chartGridProps} />
                              <XAxis dataKey="name" {...chartAxisProps} />
                              <YAxis {...chartAxisProps} />
                              <Tooltip
                                {...chartTooltipProps}
                                formatter={(value) => `${formatNumber(Number(value))} km`}
                              />
                              <Bar
                                dataKey="kmTotal"
                                name="KM total"
                                fill={chartGradientUrl('primary')}
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
          </TabsPanel>
        )}

        {canViewVehicles && (
          <TabsPanel value="vehicles">
            <Card>
              <CardHeader>
                <CardTitle>Indicadores por veículo</CardTitle>
                <CardDescription>
                  KM total, tempo de uso, quantidade de usos, custos totais e custo por KM.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                {isLoadingVehicles && (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                )}
                {!isLoadingVehicles && vehicleIndicators && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground uppercase">Mais utilizado</p>
                        <p className="text-lg font-semibold">
                          {vehicleIndicators.mostUsed ? (
                            <>
                              <VehicleName vehicle={vehicleIndicators.mostUsed} /> —{' '}
                              {formatNumber(vehicleIndicators.mostUsed.usageCount, 0)} uso(s)
                            </>
                          ) : (
                            '—'
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground uppercase">Mais caro</p>
                        <p className="text-lg font-semibold">
                          {vehicleIndicators.mostExpensive ? (
                            <>
                              <VehicleName vehicle={vehicleIndicators.mostExpensive} /> —{' '}
                              {formatCurrency(vehicleIndicators.mostExpensive.totalCost)}
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
                          <th className="px-2 py-2 font-medium">KM total</th>
                          <th className="px-2 py-2 font-medium">Tempo de uso</th>
                          <th className="px-2 py-2 font-medium">Qtd. de usos</th>
                          <th className="px-2 py-2 font-medium">Custo total</th>
                          <th className="px-2 py-2 font-medium">Custo/KM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicleIndicators.vehicles.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                              Nenhum veículo encontrado.
                            </td>
                          </tr>
                        )}
                        {vehicleIndicators.vehicles.map((vehicle) => (
                          <tr key={vehicle.vehicleId} className="border-b last:border-0">
                            <td className="px-2 py-2 font-medium">
                              <VehicleName vehicle={vehicle} />
                            </td>
                            <td className="px-2 py-2">{formatNumber(vehicle.kmTotal)} km</td>
                            <td className="px-2 py-2">
                              {formatNumber(vehicle.usageMinutes / 60, 2)} h
                            </td>
                            <td className="px-2 py-2">{vehicle.usageCount}</td>
                            <td className="px-2 py-2">{formatCurrency(vehicle.totalCost)}</td>
                            <td className="px-2 py-2">{formatCurrency(vehicle.costPerKm)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {vehicleChartData.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">KM total por veículo</p>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={vehicleChartData}>
                              <ChartGradientDefs />
                              <CartesianGrid {...chartGridProps} />
                              <XAxis dataKey="name" {...chartAxisProps} />
                              <YAxis {...chartAxisProps} />
                              <Tooltip
                                {...chartTooltipProps}
                                formatter={(value) => `${formatNumber(Number(value))} km`}
                              />
                              <Bar
                                dataKey="kmTotal"
                                name="KM total"
                                fill={chartGradientUrl('primary')}
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
          </TabsPanel>
        )}

        {canViewRoutes && (
          <TabsPanel value="routes">
            <Card>
              <CardHeader>
                <CardTitle>Indicadores por rota</CardTitle>
                <CardDescription>
                  Rotas mais utilizadas, distância e tempo médios e custo estimado.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                {isLoadingRoutes && <p className="text-sm text-muted-foreground">Carregando...</p>}
                {!isLoadingRoutes && routeIndicators && (
                  <>
                    <table className="w-full text-sm">
                      <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-2 py-2 font-medium">Rota</th>
                          <th className="px-2 py-2 font-medium">Qtd. de usos</th>
                          <th className="px-2 py-2 font-medium">Distância média</th>
                          <th className="px-2 py-2 font-medium">Tempo médio</th>
                          <th className="px-2 py-2 font-medium">Custo estimado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {routeIndicators.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                              Nenhuma rota encontrada.
                            </td>
                          </tr>
                        )}
                        {routeIndicators.map((route) => (
                          <tr key={route.routeId} className="border-b last:border-0">
                            <td className="px-2 py-2 font-medium">{route.name}</td>
                            <td className="px-2 py-2">{route.usageCount}</td>
                            <td className="px-2 py-2">
                              {route.avgDistanceKm !== null
                                ? `${formatNumber(route.avgDistanceKm)} km`
                                : '—'}
                            </td>
                            <td className="px-2 py-2">
                              {route.avgDurationMinutes !== null
                                ? `${formatNumber(route.avgDurationMinutes)} min`
                                : '—'}
                            </td>
                            <td className="px-2 py-2">{formatCurrency(route.estimatedCost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {routeChartData.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Usos por rota</p>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={routeChartData}>
                              <ChartGradientDefs />
                              <CartesianGrid {...chartGridProps} />
                              <XAxis dataKey="name" {...chartAxisProps} />
                              <YAxis allowDecimals={false} {...chartAxisProps} />
                              <Tooltip {...chartTooltipProps} />
                              <Bar
                                dataKey="usageCount"
                                name="Usos"
                                fill={chartGradientUrl('primary')}
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
          </TabsPanel>
        )}
      </Tabs>
    </div>
  );
}
