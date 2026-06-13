import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Driver,
  Prisma,
  Role,
  Trip,
  TripStatus,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { CreateTripDto } from './dto/create-trip.dto';
import { FinishTripDto } from './dto/finish-trip.dto';
import { TripQueryDto } from './dto/trip-query.dto';

export interface TripWithRelations extends Trip {
  vehicle: { id: string; plate: string };
  driver: { id: string; name: string };
  route: { id: string; name: string };
}

const tripInclude = {
  vehicle: { select: { id: true, plate: true } },
  driver: { select: { id: true, name: true } },
  route: { select: { id: true, name: true } },
} as const;

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  // Regras da seção 4.5 - criação da viagem
  async create(dto: CreateTripDto, user: AuthenticatedUser): Promise<Trip> {
    const driver = await this.resolveDriverForCreate(dto, user);

    const routeId = dto.routeId ?? driver.defaultRouteId;
    if (!routeId) {
      throw new BadRequestException(
        'Informe a rota da viagem ou cadastre uma rota padrão para o motorista.',
      );
    }

    try {
      return await this.prisma.trip.create({
        data: {
          vehicleId: dto.vehicleId,
          driverId: driver.id,
          routeId,
          destination: dto.destination,
          startKm: dto.startKm,
          startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
          status: TripStatus.EM_ANDAMENTO,
          createdBy: user.sub,
          updatedBy: user.sub,
        },
      });
    } catch (error) {
      throw this.toFriendlyError(error);
    }
  }

  // Regras da seção 4.5 - encerramento da viagem
  async finish(
    id: string,
    dto: FinishTripDto,
    user: AuthenticatedUser,
  ): Promise<Trip> {
    const trip = await this.findOneForUser(id, user);

    if (trip.status === TripStatus.FINALIZADA) {
      throw new ConflictException('Esta viagem já foi finalizada.');
    }

    const startKm = new Prisma.Decimal(trip.startKm);
    const endKm = new Prisma.Decimal(dto.endKm);

    if (endKm.lessThan(startKm)) {
      throw new UnprocessableEntityException(
        'O KM de devolução não pode ser menor que o KM de retirada.',
      );
    }

    return this.prisma.trip.update({
      where: { id },
      data: {
        endKm: dto.endKm,
        finishedAt: dto.finishedAt ? new Date(dto.finishedAt) : new Date(),
        status: TripStatus.FINALIZADA,
        updatedBy: user.sub,
      },
    });
  }

  // Histórico com filtros - seção 4.5
  async findAll(
    query: TripQueryDto,
    user: AuthenticatedUser,
  ): Promise<TripWithRelations[]> {
    const where: Prisma.TripWhereInput = {
      vehicleId: query.vehicleId,
      driverId: query.driverId,
      routeId: query.routeId,
      status: query.status,
    };

    if (query.from || query.to) {
      where.startedAt = {
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

    return this.prisma.trip.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: tripInclude,
    });
  }

  // Job agendado - seção 4.5: marca como ATRASADA viagens que excederem o
  // tempo estimado da rota sem finalização
  @Cron(CronExpression.EVERY_5_MINUTES)
  async markOverdueTrips(): Promise<number> {
    const ongoingTrips = await this.prisma.trip.findMany({
      where: { status: TripStatus.EM_ANDAMENTO },
      include: { route: { select: { estimatedDurationMinutes: true } } },
    });

    const now = Date.now();
    const overdueIds = ongoingTrips
      .filter((trip) => {
        const deadline =
          trip.startedAt.getTime() +
          trip.route.estimatedDurationMinutes * 60_000;
        return deadline < now;
      })
      .map((trip) => trip.id);

    if (overdueIds.length === 0) {
      return 0;
    }

    const result = await this.prisma.trip.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: TripStatus.ATRASADA },
    });

    return result.count;
  }

  private async resolveDriverForCreate(
    dto: CreateTripDto,
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
  ): Promise<Trip> {
    const trip = await this.prisma.trip.findUnique({ where: { id } });

    if (!trip) {
      throw new NotFoundException('Viagem não encontrada.');
    }

    if (user.role === Role.MOTORISTA) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId: user.sub, deletedAt: null },
      });

      if (!driver || trip.driverId !== driver.id) {
        throw new NotFoundException('Viagem não encontrada.');
      }
    }

    return trip;
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
