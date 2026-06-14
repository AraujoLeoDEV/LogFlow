import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { parseDateOnly } from '../../common/utils/date-range.util';
import {
  DailyLogStatus,
  Driver,
  Incident,
  Prisma,
  Role,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentIndicatorsQueryDto } from './dto/incident-indicators-query.dto';
import { IncidentQueryDto } from './dto/incident-query.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { calculateIncidentRate } from './incidents.util';

export interface IncidentWithRelations extends Incident {
  vehicle: { id: string; plate: string };
  driver: { id: string; name: string };
}

export interface IncidentsByDriver {
  driverId: string;
  driverName: string;
  count: number;
  totalCost: number;
}

export interface IncidentsByVehicle {
  vehicleId: string;
  plate: string;
  count: number;
  totalCost: number;
}

export interface VehicleIncidentRate {
  vehicleId: string;
  plate: string;
  incidentCount: number;
  kmDriven: number;
  ratePer1000Km: number | null;
}

export interface IncidentIndicators {
  byDriver: IncidentsByDriver[];
  byVehicle: IncidentsByVehicle[];
  incidentRate: VehicleIncidentRate[];
  fleetRate: {
    incidentCount: number;
    kmDriven: number;
    ratePer1000Km: number | null;
  };
}

const incidentInclude = {
  vehicle: { select: { id: true, plate: true, model: true, currentKm: true } },
  driver: { select: { id: true, name: true } },
} as const;

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  // Registro de ocorrência - seção 4.8
  async create(
    dto: CreateIncidentDto,
    user: AuthenticatedUser,
  ): Promise<IncidentWithRelations> {
    const driver = await this.resolveDriverForCreate(dto, user);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null },
    });

    if (!vehicle) {
      throw new BadRequestException('Veículo informado não existe.');
    }

    return this.prisma.incident.create({
      data: {
        vehicleId: dto.vehicleId,
        driverId: driver.id,
        category: dto.category,
        type: dto.type,
        severity: dto.severity,
        responsible: dto.responsible,
        cost: dto.cost,
        observations: dto.observations,
        date: new Date(dto.date),
        createdBy: user.sub,
        updatedBy: user.sub,
      },
      include: incidentInclude,
    });
  }

  // Listagem/histórico com filtros - seção 4.8
  async findAll(
    query: IncidentQueryDto,
    user: AuthenticatedUser,
  ): Promise<IncidentWithRelations[]> {
    const where = await this.buildWhere(query, user);

    if (where === null) {
      return [];
    }

    return this.prisma.incident.findMany({
      where,
      orderBy: { date: 'desc' },
      include: incidentInclude,
    });
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
  ): Promise<IncidentWithRelations> {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: incidentInclude,
    });

    if (!incident) {
      throw new NotFoundException('Ocorrência não encontrada.');
    }

    if (user.role === Role.MOTORISTA) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId: user.sub, deletedAt: null },
      });

      if (!driver || incident.driverId !== driver.id) {
        throw new ForbiddenException('Acesso não permitido a esta ocorrência.');
      }
    }

    return incident;
  }

  // Atualização de ocorrência - seção 4.8 (ADMIN/COORDENACAO)
  async update(
    id: string,
    dto: UpdateIncidentDto,
    user: AuthenticatedUser,
  ): Promise<IncidentWithRelations> {
    await this.ensureExists(id);

    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, deletedAt: null },
      });

      if (!vehicle) {
        throw new BadRequestException('Veículo informado não existe.');
      }
    }

    if (dto.driverId) {
      const driver = await this.prisma.driver.findFirst({
        where: { id: dto.driverId, deletedAt: null },
      });

      if (!driver) {
        throw new BadRequestException('Motorista informado não existe.');
      }
    }

    return this.prisma.incident.update({
      where: { id },
      data: {
        ...dto,
        date: dto.date ? new Date(dto.date) : undefined,
        updatedBy: user.sub,
      },
      include: incidentInclude,
    });
  }

  // Remoção de ocorrência - seção 4.8 (ADMIN/COORDENACAO)
  async remove(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.prisma.incident.delete({ where: { id } });
  }

  // Indicadores - seção 4.8: ocorrências por motorista, por veículo e
  // índice ocorrências/KM rodado (a partir do somatório de
  // DailyLog.kmDriven no período).
  async getIndicators(
    query: IncidentIndicatorsQueryDto,
  ): Promise<IncidentIndicators> {
    const dateFilter = this.buildDateFilter(query);

    const incidents = await this.prisma.incident.findMany({
      where: dateFilter ? { date: dateFilter } : undefined,
      include: incidentInclude,
    });

    const byDriverMap = new Map<
      string,
      { driverName: string; count: number; totalCost: Prisma.Decimal }
    >();
    const byVehicleMap = new Map<
      string,
      {
        plate: string;
        model: string;
        currentKm: string;
        count: number;
        totalCost: Prisma.Decimal;
      }
    >();

    for (const incident of incidents) {
      const cost = incident.cost ?? new Prisma.Decimal(0);

      const driverEntry = byDriverMap.get(incident.driverId) ?? {
        driverName: incident.driver.name,
        count: 0,
        totalCost: new Prisma.Decimal(0),
      };
      driverEntry.count += 1;
      driverEntry.totalCost = driverEntry.totalCost.plus(cost);
      byDriverMap.set(incident.driverId, driverEntry);

      const vehicleEntry = byVehicleMap.get(incident.vehicleId) ?? {
        plate: incident.vehicle.plate,
        model: incident.vehicle.model,
        currentKm: incident.vehicle.currentKm.toString(),
        count: 0,
        totalCost: new Prisma.Decimal(0),
      };
      vehicleEntry.count += 1;
      vehicleEntry.totalCost = vehicleEntry.totalCost.plus(cost);
      byVehicleMap.set(incident.vehicleId, vehicleEntry);
    }

    const byDriver: IncidentsByDriver[] = [...byDriverMap.entries()].map(
      ([driverId, entry]) => ({
        driverId,
        driverName: entry.driverName,
        count: entry.count,
        totalCost: entry.totalCost.toNumber(),
      }),
    );

    const byVehicle: IncidentsByVehicle[] = [...byVehicleMap.entries()].map(
      ([vehicleId, entry]) => ({
        vehicleId,
        plate: entry.plate,
        model: entry.model,
        currentKm: entry.currentKm,
        count: entry.count,
        totalCost: entry.totalCost.toNumber(),
      }),
    );

    const kmByVehicle = await this.sumKmDrivenByVehicle(query);

    const vehicleIds = new Set([...byVehicleMap.keys(), ...kmByVehicle.keys()]);

    const incidentRate: VehicleIncidentRate[] = [...vehicleIds].map(
      (vehicleId) => {
        const incidentCount = byVehicleMap.get(vehicleId)?.count ?? 0;
        const kmDriven = kmByVehicle.get(vehicleId)?.km ?? 0;
        const vehicleEntry = byVehicleMap.get(vehicleId);
        const kmEntry = kmByVehicle.get(vehicleId);

        return {
          vehicleId,
          plate: vehicleEntry?.plate ?? kmEntry?.plate ?? '',
          model: vehicleEntry?.model ?? kmEntry?.model ?? '',
          currentKm: vehicleEntry?.currentKm ?? kmEntry?.currentKm ?? '0',
          incidentCount,
          kmDriven,
          ratePer1000Km: calculateIncidentRate(incidentCount, kmDriven),
        };
      },
    );

    const totalIncidents = incidents.length;
    const totalKm = [...kmByVehicle.values()].reduce(
      (sum, entry) => sum + entry.km,
      0,
    );

    return {
      byDriver,
      byVehicle,
      incidentRate,
      fleetRate: {
        incidentCount: totalIncidents,
        kmDriven: totalKm,
        ratePer1000Km: calculateIncidentRate(totalIncidents, totalKm),
      },
    };
  }

  private async sumKmDrivenByVehicle(
    query: IncidentIndicatorsQueryDto,
  ): Promise<
    Map<string, { plate: string; model: string; currentKm: string; km: number }>
  > {
    const dateFilter = this.buildDateFilter(query);

    const dailyLogs = await this.prisma.dailyLog.findMany({
      where: {
        status: DailyLogStatus.FINALIZADO,
        kmDriven: { not: null },
        ...(dateFilter ? { departureAt: dateFilter } : {}),
      },
      include: {
        vehicle: {
          select: { id: true, plate: true, model: true, currentKm: true },
        },
      },
    });

    const result = new Map<
      string,
      { plate: string; model: string; currentKm: string; km: number }
    >();

    for (const log of dailyLogs) {
      const entry = result.get(log.vehicleId) ?? {
        plate: log.vehicle.plate,
        model: log.vehicle.model,
        currentKm: log.vehicle.currentKm.toString(),
        km: 0,
      };
      entry.km += log.kmDriven?.toNumber() ?? 0;
      result.set(log.vehicleId, entry);
    }

    return result;
  }

  private buildDateFilter(query: {
    from?: string;
    to?: string;
  }): Prisma.DateTimeFilter | undefined {
    if (!query.from && !query.to) {
      return undefined;
    }

    return {
      ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
      ...(query.to ? { lte: parseDateOnly(query.to, true) } : {}),
    };
  }

  private async buildWhere(
    query: IncidentQueryDto,
    user: AuthenticatedUser,
  ): Promise<Prisma.IncidentWhereInput | null> {
    const where: Prisma.IncidentWhereInput = {
      vehicleId: query.vehicleId,
      driverId: query.driverId,
      category: query.category,
      type: query.type,
      severity: query.severity,
    };

    const dateFilter = this.buildDateFilter(query);
    if (dateFilter) {
      where.date = dateFilter;
    }

    if (user.role === Role.MOTORISTA) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId: user.sub, deletedAt: null },
      });

      if (!driver) {
        return null;
      }

      where.driverId = driver.id;
    }

    return where;
  }

  private async resolveDriverForCreate(
    dto: CreateIncidentDto,
    user: AuthenticatedUser,
  ): Promise<Driver> {
    if (user.role === Role.MOTORISTA) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId: user.sub, deletedAt: null },
      });

      if (!driver) {
        throw new ForbiddenException(
          'Usuário autenticado não está vinculado a um motorista.',
        );
      }

      return driver;
    }

    if (!dto.driverId) {
      throw new BadRequestException('Informe o motorista envolvido.');
    }

    const driver = await this.prisma.driver.findFirst({
      where: { id: dto.driverId, deletedAt: null },
    });

    if (!driver) {
      throw new BadRequestException('Motorista informado não existe.');
    }

    return driver;
  }

  private async ensureExists(id: string): Promise<void> {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundException('Ocorrência não encontrada.');
    }
  }
}
