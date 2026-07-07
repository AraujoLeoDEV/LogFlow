import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';
import { buildDateRangeFilter } from '../../common/utils/date-range.util';
import {
  findOwnDriver,
  resolveDriverForCreate,
} from '../../common/utils/driver-scope.util';
import {
  emptyPage,
  paginate,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import {
  DailyLog,
  DailyLogStatus,
  Prisma,
  Role,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { DailyLogQueryDto } from './dto/daily-log-query.dto';
import { ReturnDailyLogDto } from './dto/return-daily-log.dto';
import { UpdateDailyLogDto } from './dto/update-daily-log.dto';
import { calculateReturnMetrics } from './daily-logs.util';

export interface DailyLogWithRelations extends DailyLog {
  vehicle: { id: string; plate: string };
  driver: { id: string; name: string };
  route: { id: string; name: string };
}

const dailyLogInclude = {
  vehicle: { select: { id: true, plate: true, model: true, currentKm: true } },
  driver: { select: { id: true, name: true } },
  route: { select: { id: true, name: true } },
} as const;

@Injectable()
export class DailyLogsService {
  constructor(private readonly prisma: PrismaService) {}

  // Regras da seção 4.4 - início da saída
  async create(
    dto: CreateDailyLogDto,
    user: AuthenticatedUser,
  ): Promise<DailyLog> {
    const driver = await resolveDriverForCreate(
      this.prisma,
      user,
      dto.driverId,
      'Informe o motorista responsável.',
    );

    const routeId = dto.routeId ?? driver.defaultRouteId;
    if (!routeId) {
      throw new BadRequestException(
        'Informe a rota da saída ou cadastre uma rota padrão para o motorista.',
      );
    }

    const ongoing = await this.prisma.dailyLog.findFirst({
      where: { vehicleId: dto.vehicleId, status: DailyLogStatus.EM_ANDAMENTO },
    });

    if (ongoing) {
      throw new ConflictException(
        'Já existe uma saída em andamento para este veículo.',
      );
    }

    try {
      return await this.prisma.dailyLog.create({
        data: {
          vehicleId: dto.vehicleId,
          driverId: driver.id,
          routeId,
          departureAt: dto.departureAt ? new Date(dto.departureAt) : new Date(),
          startKm: dto.startKm,
          destination: dto.destination,
          observations: dto.observations,
          status: DailyLogStatus.EM_ANDAMENTO,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      });
    } catch (error) {
      throw this.toFriendlyError(error);
    }
  }

  // Regras da seção 4.4 - registro do retorno
  async returnTrip(
    id: string,
    dto: ReturnDailyLogDto,
    user: AuthenticatedUser,
  ): Promise<DailyLog> {
    const dailyLog = await this.findOneForUser(id, user);

    if (dailyLog.status === DailyLogStatus.FINALIZADO) {
      throw new ConflictException('Este registro já foi finalizado.');
    }

    const returnAt = dto.returnAt ? new Date(dto.returnAt) : new Date();
    const metrics = calculateReturnMetrics({
      startKm: dailyLog.startKm,
      endKm: dto.endKm,
      departureAt: dailyLog.departureAt,
      returnAt,
    });

    const [, updated] = await this.prisma.$transaction([
      this.prisma.vehicle.update({
        where: { id: dailyLog.vehicleId },
        data: { currentKm: dto.endKm },
      }),
      this.prisma.dailyLog.update({
        where: { id },
        data: {
          returnAt,
          endKm: dto.endKm,
          kmDriven: metrics.kmDriven,
          totalDurationMinutes: metrics.totalDurationMinutes,
          avgSpeedKmh: metrics.avgSpeedKmh,
          observations: dto.observations ?? dailyLog.observations,
          status: DailyLogStatus.FINALIZADO,
          updatedBy: user.sub,
        },
      }),
    ]);

    return updated;
  }

  // Histórico com filtros - seção 4.4
  async findAll(
    query: DailyLogQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<DailyLogWithRelations>> {
    const where: Prisma.DailyLogWhereInput = {
      vehicleId: query.vehicleId,
      driverId: query.driverId,
      routeId: query.routeId,
      status: query.status,
    };

    const dateFilter = buildDateRangeFilter(query.from, query.to);
    if (dateFilter) {
      where.departureAt = dateFilter;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (user.role === Role.MOTORISTA) {
      const driver = await findOwnDriver(this.prisma, user);

      if (!driver) {
        return emptyPage(page, limit);
      }

      where.driverId = driver.id;
    }

    const [data, total] = await Promise.all([
      this.prisma.dailyLog.findMany({
        where,
        orderBy: { departureAt: 'desc' },
        include: dailyLogInclude,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.dailyLog.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  // Edição de campos do registro — somente ADMIN/COORDENACAO.
  async update(
    id: string,
    dto: UpdateDailyLogDto,
    user: AuthenticatedUser,
  ): Promise<DailyLog> {
    const existing = await this.prisma.dailyLog.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Registro diário não encontrado.');
    }

    const newDepartureAt =
      dto.departureAt !== undefined
        ? new Date(dto.departureAt)
        : existing.departureAt;
    const newReturnAt =
      dto.returnAt !== undefined ? new Date(dto.returnAt) : existing.returnAt;
    const newStartKm =
      dto.startKm !== undefined ? dto.startKm : existing.startKm.toNumber();
    const newEndKm =
      dto.endKm !== undefined
        ? dto.endKm
        : (existing.endKm?.toNumber() ?? null);

    const kmDriven =
      newEndKm !== null && newEndKm >= newStartKm
        ? newEndKm - newStartKm
        : (existing.kmDriven?.toNumber() ?? null);

    const totalDurationMinutes =
      newReturnAt !== null
        ? Math.round((newReturnAt.getTime() - newDepartureAt.getTime()) / 60000)
        : existing.totalDurationMinutes;

    const avgSpeedKmh =
      kmDriven !== null &&
      totalDurationMinutes !== null &&
      totalDurationMinutes > 0
        ? (kmDriven / totalDurationMinutes) * 60
        : (existing.avgSpeedKmh?.toNumber() ?? null);

    try {
      return await this.prisma.dailyLog.update({
        where: { id },
        data: {
          ...(dto.vehicleId !== undefined && { vehicleId: dto.vehicleId }),
          ...(dto.driverId !== undefined && { driverId: dto.driverId }),
          ...(dto.routeId !== undefined && { routeId: dto.routeId }),
          departureAt: newDepartureAt,
          ...(dto.returnAt !== undefined && { returnAt: newReturnAt }),
          startKm: newStartKm,
          ...(dto.endKm !== undefined && { endKm: newEndKm }),
          ...(kmDriven !== null && { kmDriven }),
          ...(totalDurationMinutes !== null && { totalDurationMinutes }),
          ...(avgSpeedKmh !== null && { avgSpeedKmh }),
          ...(dto.destination !== undefined && {
            destination: dto.destination || null,
          }),
          ...(dto.observations !== undefined && {
            observations: dto.observations || null,
          }),
          updatedBy: user.sub,
        },
      });
    } catch (error) {
      throw this.toFriendlyError(error);
    }
  }

  // Exclusão definitiva - somente ADMIN. Registro Diário não tem
  // dependentes no schema, então não há risco de violação de FK.
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.dailyLog.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Registro diário não encontrado.');
    }

    await this.prisma.dailyLog.delete({ where: { id } });
  }

  // Job agendado - seção 4.5: marca como ATRASADO os registros que excederem
  // o tempo estimado da rota sem retorno
  @Cron(CronExpression.EVERY_5_MINUTES)
  async markOverdueLogs(): Promise<number> {
    const ongoingLogs = await this.prisma.dailyLog.findMany({
      where: { status: DailyLogStatus.EM_ANDAMENTO },
      include: { route: { select: { estimatedDurationMinutes: true } } },
    });

    const now = Date.now();
    const overdueIds = ongoingLogs
      .filter((log) => {
        if (log.route.estimatedDurationMinutes === null) {
          return false;
        }

        const deadline =
          log.departureAt.getTime() +
          log.route.estimatedDurationMinutes * 60_000;
        return deadline < now;
      })
      .map((log) => log.id);

    if (overdueIds.length === 0) {
      return 0;
    }

    const result = await this.prisma.dailyLog.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: DailyLogStatus.ATRASADO },
    });

    return result.count;
  }

  private async findOneForUser(
    id: string,
    user: AuthenticatedUser,
  ): Promise<DailyLog> {
    const dailyLog = await this.prisma.dailyLog.findUnique({ where: { id } });

    if (!dailyLog) {
      throw new NotFoundException('Registro não encontrado.');
    }

    if (user.role === Role.MOTORISTA) {
      const driver = await findOwnDriver(this.prisma, user);

      if (!driver || dailyLog.driverId !== driver.id) {
        throw new NotFoundException('Registro não encontrado.');
      }
    }

    return dailyLog;
  }

  private toFriendlyError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return new BadRequestException(
          'Veículo, motorista ou rota informados não existem.',
        );
      }
    }

    return error;
  }
}
