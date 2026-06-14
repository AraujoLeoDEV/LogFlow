import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { ChartGradientDefs } from '@/components/charts/ChartGradientDefs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import {
  chartAxisProps,
  chartGradientUrl,
  chartGridProps,
  chartTooltipProps,
} from '@/lib/chartTheme';
import type {
  CostPerKmResult,
  FinanceQuery,
  MonthlyFinanceComparison,
  MonthlyFinanceSummary,
} from '@/types/finance';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const numberFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function formatCurrency(value: number | null): string {
  return value !== null ? currencyFormatter.format(value) : '—';
}

function formatNumber(value: number, fractionDigits = 2): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: fractionDigits });
}

function formatVariation(value: number | null): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${numberFormatter.format(value)}%`;
}

export function FinancePage() {
  const [filters, setFilters] = useState<FinanceQuery>({});

  function handleFilterChange<K extends keyof FinanceQuery>(key: K, value: string) {
    setFilters((prev) => ({ ...prev, [key]: (value || undefined) as FinanceQuery[K] }));
  }

  const { data: monthlySummary, isLoading: isLoadingMonthly } = useQuery({
    queryKey: ['finance', 'monthly', filters],
    queryFn: async () =>
      (await api.get<MonthlyFinanceSummary[]>('/finance/monthly', { params: filters })).data,
  });

  const { data: costPerKm, isLoading: isLoadingCostPerKm } = useQuery({
    queryKey: ['finance', 'cost-per-km', filters],
    queryFn: async () =>
      (await api.get<CostPerKmResult>('/finance/cost-per-km', { params: filters })).data,
  });

  const { data: comparison, isLoading: isLoadingComparison } = useQuery({
    queryKey: ['finance', 'comparison', filters],
    queryFn: async () =>
      (await api.get<MonthlyFinanceComparison[]>('/finance/comparison', { params: filters })).data,
  });

  const currentMonth = monthlySummary?.at(-1);

  const chartData = (comparison ?? []).map((entry) => ({
    month: entry.month,
    Combustível: entry.fuelCost,
    Manutenção: entry.maintenanceCost,
    Depreciação: entry.depreciation,
    total: entry.total,
    variation: entry.variation,
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Financeiro</h2>
        <p className="text-muted-foreground">
          Custos da frota: combustível, manutenção e depreciação.
        </p>
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
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Combustível</CardDescription>
            <CardTitle className="text-xl">
              {isLoadingMonthly ? '...' : formatCurrency(currentMonth?.fuelCost ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Manutenção</CardDescription>
            <CardTitle className="text-xl">
              {isLoadingMonthly ? '...' : formatCurrency(currentMonth?.maintenanceCost ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Depreciação mensal da frota</CardDescription>
            <CardTitle className="text-xl">
              {isLoadingMonthly ? '...' : formatCurrency(currentMonth?.depreciation ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Custo total do mês</CardDescription>
            <CardTitle className="text-xl">
              {isLoadingMonthly ? '...' : formatCurrency(currentMonth?.total ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Custo médio por KM</CardTitle>
          <CardDescription>
            Custo total (combustível + manutenção + depreciação) dividido pelo KM rodado no período.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingCostPerKm && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoadingCostPerKm && costPerKm && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground uppercase">Custo total</p>
                <p className="text-lg font-semibold">{formatCurrency(costPerKm.totalCost)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground uppercase">KM rodado</p>
                <p className="text-lg font-semibold">{formatNumber(costPerKm.kmTotal, 0)} km</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground uppercase">Custo por KM</p>
                <p className="text-lg font-semibold">
                  {costPerKm.costPerKm !== null
                    ? `${formatCurrency(costPerKm.costPerKm)} / km`
                    : '—'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comparativo mensal</CardTitle>
          <CardDescription>
            Custo total da frota por mês, com a variação percentual em relação ao mês anterior.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {isLoadingComparison && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoadingComparison && comparison && (
            <>
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-2 py-2 font-medium">Mês</th>
                    <th className="px-2 py-2 font-medium">Combustível</th>
                    <th className="px-2 py-2 font-medium">Manutenção</th>
                    <th className="px-2 py-2 font-medium">Depreciação</th>
                    <th className="px-2 py-2 font-medium">Total</th>
                    <th className="px-2 py-2 font-medium">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                        Nenhum dado encontrado.
                      </td>
                    </tr>
                  )}
                  {comparison.map((entry) => (
                    <tr key={entry.month} className="border-b last:border-0">
                      <td className="px-2 py-2 font-medium">{entry.month}</td>
                      <td className="px-2 py-2">{formatCurrency(entry.fuelCost)}</td>
                      <td className="px-2 py-2">{formatCurrency(entry.maintenanceCost)}</td>
                      <td className="px-2 py-2">{formatCurrency(entry.depreciation)}</td>
                      <td className="px-2 py-2">{formatCurrency(entry.total)}</td>
                      <td className="px-2 py-2">{formatVariation(entry.variation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {chartData.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Custo mensal por categoria</p>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <ChartGradientDefs />
                        <CartesianGrid {...chartGridProps} />
                        <XAxis dataKey="month" {...chartAxisProps} />
                        <YAxis {...chartAxisProps} />
                        <Tooltip
                          {...chartTooltipProps}
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                        <Legend wrapperStyle={{ fontSize: '0.8125rem' }} />
                        <Bar
                          dataKey="Combustível"
                          stackId="cost"
                          fill={chartGradientUrl('chart-1')}
                        />
                        <Bar
                          dataKey="Manutenção"
                          stackId="cost"
                          fill={chartGradientUrl('chart-3')}
                        />
                        <Bar
                          dataKey="Depreciação"
                          stackId="cost"
                          fill={chartGradientUrl('chart-5')}
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
    </div>
  );
}
