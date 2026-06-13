import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  DailyLog,
  DailyLogStatus,
  Driver,
  Prisma,
  Role,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { CreateDailyLogDto } from './dto/create-daily-log.dto';
import { DailyLogQueryDto } from './dto/daily-log-query.dto';
import { ReturnDailyLogDto } from './dto/return-daily-log.dto';
import { calculateReturnMetrics } from './daily-logs.util';

export interface DailyLogWithRelations extends DailyLog {
  vehicle: { id: string; plate: string };
  driver: { id: string; name: string };
  route: { id: string; name: string };
}

const dailyLogInclude = {
  vehicle: { select: { id: true, plate: true } },
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
    const driver = await this.resolveDriverForCreate(dto, user);

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
  ): Promise<DailyLogWithRelations[]> {
    const where: Prisma.DailyLogWhereInput = {
      vehicleId: query.vehicleId,
      driverId: query.driverId,
      routeId: query.routeId,
      status: query.status,
    };

    if (query.from || query.to) {
      where.departureAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    if (user.role === Role.MOTORISTA) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId: user.sub, deletedAt: null },
      });

      if (!driver) {
        return [];
      }

      where.driverId = driver.id;
    }

    return this.prisma.dailyLog.findMany({
      where,
      orderBy: { departureAt: 'desc' },
      include: dailyLogInclude,
    });
  }

  private async resolveDriverForCreate(
    dto: CreateDailyLogDto,
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
      throw new BadRequestException('Informe o motorista responsável.');
    }

    const driver = await this.prisma.driver.findFirst({
      where: { id: dto.driverId, deletedAt: null },
    });

    if (!driver) {
      throw new BadRequestException('Motorista informado não existe.');
    }

    return driver;
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
      const driver = await this.prisma.driver.findFirst({
        where: { userId: user.sub, deletedAt: null },
      });

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
