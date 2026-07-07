import { useQuery } from '@tanstack/react-query';
import { Gauge, LayoutDashboard, PieChart, Route as RouteIcon, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';

import { ChartGradientDefs } from '@/components/charts/ChartGradientDefs';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { VehicleName } from '@/components/vehicles/VehicleName';
import { useAuth } from '@/contexts/AuthContext';
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
  FuelVehicleIndicator,
  RouteIndicator,
  VehicleIndicators,
} from '@/types/dashboard';
import type { Driver } from '@/types/driver';
import type { Vehicle } from '@/types/vehicle';

function formatRate(value: number | null): string {
  return value !== null ? `${formatNumber(value)} / 1.000 km` : '—';
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canViewExecutive = hasRole('ADMIN', 'COORDENACAO', 'FINANCEIRO');
  const canViewDrivers = hasRole('ADMIN', 'COORDENACAO');
  const canViewVehicles = hasRole('ADMIN', 'COORDENACAO', 'FINANCEIRO');
  const canViewRoutes = hasRole('ADMIN', 'COORDENACAO');
  const canViewFuel = hasRole('ADMIN', 'COORDENACAO', 'FINANCEIRO');

  const [filters, setFilters] = useState<DashboardQuery>({});

  function handleFilterChange<K extends keyof DashboardQuery>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (value || undefined) as DashboardQuery[K] }));
  }

  const { data: vehicles } = useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => (await api.get<Vehicle[]>('/vehicles')).data,
    enabled: canViewVehicles || canViewDrivers || canViewRoutes,
  });

  const { data: drivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: async () => (await api.get<Driver[]>('/drivers')).data,
    enabled: canViewDrivers || canViewVehicles || canViewRoutes,
  });

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

  const { data: fuelIndicators, isLoading: isLoadingFuel } = useQuery({
    queryKey: ['dashboard', 'fuel', filters],
    queryFn: async () =>
      (await api.get<FuelVehicleIndicator[]>('/dashboard/fuel', { params: filters })).data,
    enabled: canViewFuel,
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

  const fuelChartData = (fuelIndicators ?? []).map((v) => ({
    name: `${v.model} (${v.plate})`,
    avgConsumptionKmL: v.avgConsumptionKmL ?? 0,
  }));

  const defaultTab = canViewDrivers ? 'drivers' : canViewVehicles ? 'vehicles' : 'routes';

  const totalKmFleet = (vehicleIndicators?.vehicles ?? []).reduce((sum, v) => sum + v.kmTotal, 0);
  const activeDriversCount = (driverIndicators ?? []).filter((d) => d.kmTotal > 0).length;
  const totalRouteUsage = (routeIndicators ?? []).reduce((sum, r) => sum + r.usageCount, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Indicadores gerais da frota."
        action={
          canViewExecutive && (
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard/executivo')}
            >
              <PieChart />
              Visão executiva
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {canViewVehicles && (
          <StatCard
            icon={Gauge}
            label="KM total da frota"
            value={`${formatNumber(totalKmFleet, 0)} km`}
          />
        )}
        {canViewDrivers && (
          <StatCard
            icon={UserRound}
            label="Motoristas em atividade"
            value={String(activeDriversCount)}
          />
        )}
        {canViewRoutes && (
          <StatCard icon={RouteIcon} label="Viagens no período" value={String(totalRouteUsage)} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Filtre os indicadores por período, veículo e/ou motorista (opcional — padrão: geral, com
            todos).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            <div className="grid gap-1.5">
              <Label>Veículo</Label>
              <Select
                value={filters.vehicleId ?? ''}
                onChange={(event) => handleFilterChange('vehicleId', event.target.value)}
              >
                <option value="">Geral (todos)</option>
                {(vehicles ?? []).map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.model} ({vehicle.plate})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Motorista</Label>
              <Select
                value={filters.driverId ?? ''}
                onChange={(event) => handleFilterChange('driverId', event.target.value)}
              >
                <option value="">Geral (todos)</option>
                {(drivers ?? []).map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {canViewDrivers && <TabsTab value="drivers">Motoristas</TabsTab>}
          {canViewVehicles && <TabsTab value="vehicles">Veículos</TabsTab>}
          {canViewRoutes && <TabsTab value="routes">Rotas</TabsTab>}
          {canViewFuel && <TabsTab value="fuel">Combustível</TabsTab>}
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
          </TabsPanel>
        )}
        {canViewFuel && (
          <TabsPanel value="fuel">
            <Card>
              <CardHeader>
                <CardTitle>Indicadores de combustível</CardTitle>
                <CardDescription>
                  Consumo médio (km/L), total de litros, gasto total e preço médio por litro —
                  filtráveis por veículo e período.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                {isLoadingFuel && <p className="text-sm text-muted-foreground">Carregando...</p>}
                {!isLoadingFuel && fuelIndicators && (
                  <>
                    <table className="w-full text-sm">
                      <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-2 py-2 font-medium">Veículo</th>
                          <th className="px-2 py-2 font-medium">Abastecimentos</th>
                          <th className="px-2 py-2 font-medium">Total litros</th>
                          <th className="px-2 py-2 font-medium">Gasto total</th>
                          <th className="px-2 py-2 font-medium">Consumo médio</th>
                          <th className="px-2 py-2 font-medium">Preço médio/L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fuelIndicators.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                              Nenhum abastecimento encontrado no período.
                            </td>
                          </tr>
                        )}
                        {fuelIndicators.map((v) => (
                          <tr key={v.vehicleId} className="border-b last:border-0">
                            <td className="px-2 py-2 font-medium">
                              {v.model} ({v.plate})
                            </td>
                            <td className="px-2 py-2">{v.fuelCount}</td>
                            <td className="px-2 py-2">{formatNumber(v.totalLiters, 2)} L</td>
                            <td className="px-2 py-2">{formatCurrency(v.totalPaid)}</td>
                            <td className="px-2 py-2">
                              {v.avgConsumptionKmL !== null
                                ? `${formatNumber(v.avgConsumptionKmL, 2)} km/L`
                                : '—'}
                            </td>
                            <td className="px-2 py-2">
                              {v.avgPricePerLiter !== null
                                ? formatCurrency(v.avgPricePerLiter)
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {fuelChartData.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">Consumo médio por veículo (km/L)</p>
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={fuelChartData}>
                              <ChartGradientDefs />
                              <CartesianGrid {...chartGridProps} />
                              <XAxis dataKey="name" {...chartAxisProps} />
                              <YAxis {...chartAxisProps} />
                              <Tooltip
                                {...chartTooltipProps}
                                formatter={(value) => `${formatNumber(Number(value), 2)} km/L`}
                              />
                              <Bar
                                dataKey="avgConsumptionKmL"
                                name="Consumo médio"
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
          </TabsPanel>
        )}
      </Tabs>
    </div>
  );
}
