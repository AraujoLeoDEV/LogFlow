import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { DailyLogStatus, Prisma } from '../../../generated/prisma/client';
import { parseDateOnly } from '../../common/utils/date-range.util';
import { calculateCostPerKm } from '../dashboard/dashboard.util';
import { calculateMonthlyDepreciation } from '../vehicles/vehicles.util';
import { FinanceQueryDto } from './dto/finance-query.dto';
import { buildMonthRange, MonthRange } from './finance.util';

export interface MonthlyFinanceSummary {
  month: string;
  fuelCost: number;
  maintenanceCost: number;
  depreciation: number;
  total: number;
}

export interface MonthlyFinanceComparison extends MonthlyFinanceSummary {
  variation: number | null;
}

export interface CostPerKmResult {
  totalCost: number;
  kmTotal: number;
  costPerKm: number | null;
}

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // Custo mensal da frota - seção 4.12: combustível + manutenção +
  // depreciação mensal de todos os veículos ativos.
  async getMonthlySummary(
    query: FinanceQueryDto,
  ): Promise<MonthlyFinanceSummary[]> {
    const months = buildMonthRange(query.from, query.to);
    const depreciation = await this.getFleetMonthlyDepreciation();

    return Promise.all(
      months.map(async (range) => {
        const filter = this.rangeFilter(range);
        const [fuelCost, maintenanceCost] = await Promise.all([
          this.sumFuelCost(filter),
          this.sumMaintenanceCost(filter),
        ]);

        return {
          month: range.month,
          fuelCost,
          maintenanceCost,
          depreciation,
          total: fuelCost + maintenanceCost + depreciation,
        };
      }),
    );
  }

  // Custo médio por KM - seção 4.12: custo total (combustível + manutenção +
  // depreciação proporcional ao período) dividido pelo KM total rodado no
  // período. Retorna null quando não há KM rodado (evita divisão por zero).
  async getCostPerKm(query: FinanceQueryDto): Promise<CostPerKmResult> {
    const dateFilter = this.buildDateFilter(query);
    const monthsInPeriod = buildMonthRange(query.from, query.to).length;

    const [fuelCost, maintenanceCost, kmTotal, monthlyDepreciation] =
      await Promise.all([
        this.sumFuelCost(dateFilter),
        this.sumMaintenanceCost(dateFilter),
        this.sumKmDriven(dateFilter),
        this.getFleetMonthlyDepreciation(),
      ]);

    const depreciation = monthlyDepreciation * monthsInPeriod;
    const totalCost = fuelCost + maintenanceCost + depreciation;

    return {
      totalCost,
      kmTotal,
      costPerKm: calculateCostPerKm(totalCost, kmTotal),
    };
  }

  // Comparativo mensal - seção 4.12: custo total mês a mês, com a variação
  // percentual em relação ao mês anterior. Sem período informado, considera
  // os últimos 6 meses (incluindo o atual).
  async getMonthlyComparison(
    query: FinanceQueryDto,
  ): Promise<MonthlyFinanceComparison[]> {
    const effectiveQuery: FinanceQueryDto = query.from
      ? query
      : { ...query, from: this.defaultComparisonStart(query.to).toISOString() };

    const summary = await this.getMonthlySummary(effectiveQuery);

    return summary.map((entry, index) => {
      const previous = summary[index - 1];
      const variation =
        previous && previous.total > 0
          ? ((entry.total - previous.total) / previous.total) * 100
          : null;

      return { ...entry, variation };
    });
  }

  private defaultComparisonStart(to?: string): Date {
    const end = to ? parseDateOnly(to) : new Date();
    return new Date(end.getFullYear(), end.getMonth() - 5, 1);
  }

  private rangeFilter(range: MonthRange): Prisma.DateTimeFilter {
    return { gte: range.start, lte: range.end };
  }

  private buildDateFilter(
    query: FinanceQueryDto,
  ): Prisma.DateTimeFilter | undefined {
    if (!query.from && !query.to) {
      return undefined;
    }

    return {
      ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
      ...(query.to ? { lte: parseDateOnly(query.to, true) } : {}),
    };
  }

  private async sumFuelCost(filter?: Prisma.DateTimeFilter): Promise<number> {
    const records = await this.prisma.fuel.findMany({
      where: filter ? { date: filter } : undefined,
      select: { amountPaid: true },
    });

    return records
      .reduce(
        (sum, record) => sum.plus(record.amountPaid),
        new Prisma.Decimal(0),
      )
      .toNumber();
  }

  private async sumMaintenanceCost(
    filter?: Prisma.DateTimeFilter,
  ): Promise<number> {
    const records = await this.prisma.maintenance.findMany({
      where: filter ? { createdAt: filter } : undefined,
      select: { cost: true },
    });

    return records
      .reduce((sum, record) => sum.plus(record.cost), new Prisma.Decimal(0))
      .toNumber();
  }

  private async sumKmDriven(filter?: Prisma.DateTimeFilter): Promise<number> {
    const records = await this.prisma.dailyLog.findMany({
      where: {
        status: DailyLogStatus.FINALIZADO,
        kmDriven: { not: null },
        ...(filter ? { departureAt: filter } : {}),
      },
      select: { kmDriven: true },
    });

    return records.reduce(
      (sum, record) => sum + (record.kmDriven?.toNumber() ?? 0),
      0,
    );
  }

  private async getFleetMonthlyDepreciation(): Promise<number> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { deletedAt: null },
      select: {
        acquisitionValue: true,
        residualValue: true,
        usefulLifeMonths: true,
      },
    });

    return vehicles.reduce(
      (sum, vehicle) => sum + calculateMonthlyDepreciation(vehicle),
      0,
    );
  }
}
