import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { buildDateRangeFilter } from '../../common/utils/date-range.util';
import { groupAndAccumulate } from '../../common/utils/group.util';
import { DailyLogStatus, Prisma } from '../../../generated/prisma/client';
import { calculateIncidentRate } from '../incidents/incidents.util';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { calculateCostPerKm, rankDescending } from './dashboard.util';

export interface DriverIndicator {
  driverId: string;
  driverName: string;
  kmTotal: number;
  drivingHours: number;
  incidentCount: number;
  incidentRatePer1000Km: number | null;
  rank: number;
}

export interface VehicleIndicator {
  vehicleId: string;
  plate: string;
  kmTotal: number;
  usageMinutes: number;
  usageCount: number;
  totalCost: number;
  costPerKm: number | null;
}

export interface VehicleIndicators {
  vehicles: VehicleIndicator[];
  mostUsed: VehicleIndicator | null;
  mostExpensive: VehicleIndicator | null;
}

export interface RouteIndicator {
  routeId: string;
  name: string;
  usageCount: number;
  totalKm: number;
  avgDistanceKm: number | null;
  avgDurationMinutes: number | null;
  estimatedCost: number | null;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Indicadores por motorista - seção 4.11: KM total rodado, horas
  // dirigidas, ocorrências, índice ocorrências/KM e ranking (por KM rodado).
  async getDriverIndicators(
    query: DashboardQueryDto,
  ): Promise<DriverIndicator[]> {
    const dateFilter = buildDateRangeFilter(query.from, query.to);

    const [drivers, dailyLogs, incidents] = await Promise.all([
      this.prisma.driver.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true },
      }),
      this.prisma.dailyLog.findMany({
        where: {
          status: DailyLogStatus.FINALIZADO,
          kmDriven: { not: null },
          ...(dateFilter ? { departureAt: dateFilter } : {}),
        },
        select: { driverId: true, kmDriven: true, totalDurationMinutes: true },
      }),
      this.prisma.incident.findMany({
        where: dateFilter ? { date: dateFilter } : undefined,
        select: { driverId: true },
      }),
    ]);

    const usageByDriver = groupAndAccumulate(
      dailyLogs,
      (log) => log.driverId,
      () => ({ kmTotal: 0, minutes: 0 }),
      (entry, log) => {
        entry.kmTotal += log.kmDriven?.toNumber() ?? 0;
        entry.minutes += log.totalDurationMinutes ?? 0;
        return entry;
      },
    );

    const incidentsByDriver = groupAndAccumulate(
      incidents,
      (incident) => incident.driverId,
      () => 0,
      (count) => count + 1,
    );

    const indicators = drivers.map((driver) => {
      const usage = usageByDriver.get(driver.id) ?? { kmTotal: 0, minutes: 0 };
      const incidentCount = incidentsByDriver.get(driver.id) ?? 0;

      return {
        driverId: driver.id,
        driverName: driver.name,
        kmTotal: usage.kmTotal,
        drivingHours: usage.minutes / 60,
        incidentCount,
        incidentRatePer1000Km: calculateIncidentRate(
          incidentCount,
          usage.kmTotal,
        ),
      };
    });

    return rankDescending(indicators, (indicator) => indicator.kmTotal);
  }

  // Indicadores por veículo - seção 4.11: KM total, tempo de uso, qtd. de
  // usos, custos totais (combustível + manutenção), custo/KM e destaques de
  // mais utilizado/mais caro.
  async getVehicleIndicators(
    query: DashboardQueryDto,
  ): Promise<VehicleIndicators> {
    const dateFilter = buildDateRangeFilter(query.from, query.to);

    const [vehicles, dailyLogs, fuelRecords, maintenances] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { deletedAt: null },
        select: { id: true, plate: true, model: true, currentKm: true },
      }),
      this.prisma.dailyLog.findMany({
        where: {
          status: DailyLogStatus.FINALIZADO,
          kmDriven: { not: null },
          ...(dateFilter ? { departureAt: dateFilter } : {}),
        },
        select: { vehicleId: true, kmDriven: true, totalDurationMinutes: true },
      }),
      this.prisma.fuel.findMany({
        where: dateFilter ? { date: dateFilter } : undefined,
        select: { vehicleId: true, amountPaid: true },
      }),
      this.prisma.maintenance.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        select: { vehicleId: true, cost: true },
      }),
    ]);

    const usageByVehicle = groupAndAccumulate(
      dailyLogs,
      (log) => log.vehicleId,
      () => ({ kmTotal: 0, minutes: 0, count: 0 }),
      (entry, log) => {
        entry.kmTotal += log.kmDriven?.toNumber() ?? 0;
        entry.minutes += log.totalDurationMinutes ?? 0;
        entry.count += 1;
        return entry;
      },
    );

    // Combustível + manutenção somados no mesmo Map por veículo;
    // distingue a origem do registro por qual campo de valor ele tem.
    const costByVehicle = groupAndAccumulate(
      [...fuelRecords, ...maintenances],
      (record) => record.vehicleId,
      () => new Prisma.Decimal(0),
      (total, record) =>
        total.plus('amountPaid' in record ? record.amountPaid : record.cost),
    );

    const indicators: VehicleIndicator[] = vehicles.map((vehicle) => {
      const usage = usageByVehicle.get(vehicle.id) ?? {
        kmTotal: 0,
        minutes: 0,
        count: 0,
      };
      const totalCost = (
        costByVehicle.get(vehicle.id) ?? new Prisma.Decimal(0)
      ).toNumber();

      return {
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        model: vehicle.model,
        currentKm: vehicle.currentKm.toString(),
        kmTotal: usage.kmTotal,
        usageMinutes: usage.minutes,
        usageCount: usage.count,
        totalCost,
        costPerKm: calculateCostPerKm(totalCost, usage.kmTotal),
      };
    });

    const withUsage = indicators.filter(
      (indicator) => indicator.usageCount > 0,
    );
    const withCost = indicators.filter((indicator) => indicator.totalCost > 0);

    const mostUsed =
      withUsage.length === 0
        ? null
        : withUsage.reduce((most, current) =>
            current.usageCount > most.usageCount ? current : most,
          );

    const mostExpensive =
      withCost.length === 0
        ? null
        : withCost.reduce((most, current) =>
            current.totalCost > most.totalCost ? current : most,
          );

    return { vehicles: indicators, mostUsed, mostExpensive };
  }

  // Indicadores por rota - seção 4.11: rotas mais utilizadas, distância e
  // tempo médios, e custo estimado (com base no custo/KM médio da frota no
  // período).
  async getRouteIndicators(
    query: DashboardQueryDto,
  ): Promise<RouteIndicator[]> {
    const dateFilter = buildDateRangeFilter(query.from, query.to);

    const [routes, dailyLogs, vehicleIndicators] = await Promise.all([
      this.prisma.route.findMany({
        where: { active: true },
        select: { id: true, name: true },
      }),
      this.prisma.dailyLog.findMany({
        where: {
          status: DailyLogStatus.FINALIZADO,
          kmDriven: { not: null },
          ...(dateFilter ? { departureAt: dateFilter } : {}),
        },
        select: { routeId: true, kmDriven: true, totalDurationMinutes: true },
      }),
      this.getVehicleIndicators(query),
    ]);

    const usageByRoute = groupAndAccumulate(
      dailyLogs,
      (log) => log.routeId,
      () => ({ kmTotal: 0, minutes: 0, count: 0 }),
      (entry, log) => {
        entry.kmTotal += log.kmDriven?.toNumber() ?? 0;
        entry.minutes += log.totalDurationMinutes ?? 0;
        entry.count += 1;
        return entry;
      },
    );

    const fleetKmTotal = vehicleIndicators.vehicles.reduce(
      (sum, vehicle) => sum + vehicle.kmTotal,
      0,
    );
    const fleetCostTotal = vehicleIndicators.vehicles.reduce(
      (sum, vehicle) => sum + vehicle.totalCost,
      0,
    );
    const fleetCostPerKm = calculateCostPerKm(fleetCostTotal, fleetKmTotal);

    const indicators: RouteIndicator[] = routes.map((route) => {
      const usage = usageByRoute.get(route.id) ?? {
        kmTotal: 0,
        minutes: 0,
        count: 0,
      };
      const avgDistanceKm =
        usage.count > 0 ? usage.kmTotal / usage.count : null;
      const avgDurationMinutes =
        usage.count > 0 ? usage.minutes / usage.count : null;

      return {
        routeId: route.id,
        name: route.name,
        usageCount: usage.count,
        totalKm: usage.kmTotal,
        avgDistanceKm,
        avgDurationMinutes,
        estimatedCost:
          avgDistanceKm !== null && fleetCostPerKm !== null
            ? avgDistanceKm * fleetCostPerKm
            : null,
      };
    });

    return indicators.sort((a, b) => b.usageCount - a.usageCount);
  }
}
