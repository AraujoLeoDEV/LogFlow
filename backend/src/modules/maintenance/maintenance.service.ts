import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { buildDateRangeFilter } from '../../common/utils/date-range.util';
import { paginate, PaginatedResult } from '../../common/utils/pagination.util';
import { Maintenance, Prisma } from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { MaintenanceQueryDto } from './dto/maintenance-query.dto';
import {
  ScheduleEntry,
  buildScheduleEntries,
  calculateNextMaintenance,
} from './maintenance.util';

export interface MaintenanceWithVehicle extends Maintenance {
  vehicle: {
    id: string;
    plate: string;
    model: string;
    currentKm: Prisma.Decimal;
  };
}

const maintenanceInclude = {
  vehicle: { select: { id: true, plate: true, model: true, currentKm: true } },
} as const;

const DEFAULT_KM_ALERT_OIL_CHANGE = 10000;
const DEFAULT_KM_ALERT_MAINTENANCE = 5000;

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Regras da seção 4.7 - registro de manutenção
  async create(
    dto: CreateMaintenanceDto,
    user: AuthenticatedUser,
  ): Promise<MaintenanceWithVehicle> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null },
    });

    if (!vehicle) {
      throw new BadRequestException('Veículo informado não existe.');
    }

    const data: Prisma.MaintenanceCreateInput = {
      vehicle: { connect: { id: dto.vehicleId } },
      type: dto.type,
      category: dto.category,
      km: dto.km,
      cost: dto.cost,
      description: dto.description,
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
      scheduledKm: dto.scheduledKm ?? null,
      performedDate: dto.performedDate ? new Date(dto.performedDate) : null,
      createdBy: user.sub,
      updatedBy: user.sub,
    };

    if (!dto.performedDate) {
      return this.prisma.maintenance.create({
        data,
        include: maintenanceInclude,
      });
    }

    const nextFields = calculateNextMaintenance({
      category: dto.category,
      performedKm: dto.km,
      performedDate: new Date(dto.performedDate),
      kmAlertOilChange: this.getEnvNumber(
        'KM_ALERT_OIL_CHANGE',
        DEFAULT_KM_ALERT_OIL_CHANGE,
      ),
      kmAlertMaintenance: this.getEnvNumber(
        'KM_ALERT_MAINTENANCE',
        DEFAULT_KM_ALERT_MAINTENANCE,
      ),
    });

    if (!nextFields) {
      return this.prisma.maintenance.create({
        data,
        include: maintenanceInclude,
      });
    }

    const [created] = await this.prisma.$transaction([
      this.prisma.maintenance.create({ data, include: maintenanceInclude }),
      this.prisma.vehicle.update({
        where: { id: dto.vehicleId },
        data: nextFields,
      }),
    ]);

    return created;
  }

  // Histórico por veículo com filtros - seção 4.7
  async findAll(
    query: MaintenanceQueryDto,
  ): Promise<PaginatedResult<MaintenanceWithVehicle>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.MaintenanceWhereInput = {
      vehicleId: query.vehicleId,
      type: query.type,
      category: query.category,
    };

    const dateFilter = buildDateRangeFilter(query.from, query.to);
    if (dateFilter) {
      where.performedDate = dateFilter;
    }

    const [data, total] = await Promise.all([
      this.prisma.maintenance.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: maintenanceInclude,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.maintenance.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  // Agenda de manutenções previstas (próxima troca de óleo, pneus e revisão
  // geral por veículo), ordenada por proximidade - seção 4.7
  async getSchedule(): Promise<ScheduleEntry[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { deletedAt: null, active: true },
      select: {
        id: true,
        plate: true,
        model: true,
        currentKm: true,
        nextOilChangeKm: true,
        nextOilChangeDate: true,
        nextTireChangeKm: true,
        nextTireChangeDate: true,
        nextReviewKm: true,
        nextReviewDate: true,
      },
    });

    return buildScheduleEntries(
      vehicles.map((vehicle) => ({
        id: vehicle.id,
        plate: vehicle.plate,
        model: vehicle.model,
        currentKm: vehicle.currentKm.toNumber(),
        nextOilChangeKm: vehicle.nextOilChangeKm?.toNumber() ?? null,
        nextOilChangeDate: vehicle.nextOilChangeDate,
        nextTireChangeKm: vehicle.nextTireChangeKm?.toNumber() ?? null,
        nextTireChangeDate: vehicle.nextTireChangeDate,
        nextReviewKm: vehicle.nextReviewKm?.toNumber() ?? null,
        nextReviewDate: vehicle.nextReviewDate,
      })),
      new Date(),
    );
  }

  private getEnvNumber(key: string, defaultValue: number): number {
    const raw = this.config.get<string>(key);
    return raw !== undefined ? Number(raw) : defaultValue;
  }
}
