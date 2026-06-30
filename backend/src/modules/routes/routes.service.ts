import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { groupAndAccumulate } from '../../common/utils/group.util';
import { Prisma, Route, RouteStop } from '../../../generated/prisma/client';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

export type RouteWithStops = Route & { stops: RouteStop[] };

export interface RouteWithUsageCount extends RouteWithStops {
  usageCount: number;
}

const stopsOrderBy = { stops: { orderBy: { sequence: 'asc' as const } } };

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateRouteDto): Promise<RouteWithStops> {
    return this.prisma.route.create({
      data: {
        name: dto.name,
        active: dto.active,
        stops: dto.stops
          ? {
              create: dto.stops.map((stop, index) => ({
                name: stop.name,
                sequence: index + 1,
              })),
            }
          : undefined,
      },
      include: stopsOrderBy,
    });
  }

  // Lista com a quantidade de vezes que cada rota foi utilizada (total de
  // registros de Registro Diário com essa rota, sem filtro de período).
  async findAll(): Promise<RouteWithUsageCount[]> {
    const [routes, dailyLogs] = await Promise.all([
      this.prisma.route.findMany({
        orderBy: { name: 'asc' },
        include: stopsOrderBy,
      }),
      this.prisma.dailyLog.findMany({ select: { routeId: true } }),
    ]);

    const usageByRoute = groupAndAccumulate(
      dailyLogs,
      (log) => log.routeId,
      () => 0,
      (count) => count + 1,
    );

    return routes.map((route) => ({
      ...route,
      usageCount: usageByRoute.get(route.id) ?? 0,
    }));
  }

  async findOne(id: string): Promise<RouteWithStops> {
    const route = await this.prisma.route.findUnique({
      where: { id },
      include: stopsOrderBy,
    });

    if (!route) {
      throw new NotFoundException('Rota não encontrada.');
    }

    return route;
  }

  async update(id: string, dto: UpdateRouteDto): Promise<RouteWithStops> {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.stops) {
        await tx.routeStop.deleteMany({ where: { routeId: id } });
      }

      return tx.route.update({
        where: { id },
        data: {
          name: dto.name,
          active: dto.active,
          stops: dto.stops
            ? {
                create: dto.stops.map((stop, index) => ({
                  name: stop.name,
                  sequence: index + 1,
                })),
              }
            : undefined,
        },
        include: stopsOrderBy,
      });
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.route.update({
      where: { id },
      data: { active: false },
    });
  }

  // Exclusão definitiva - somente ADMIN. Diferente de remove() (inativação),
  // apaga o registro de verdade (com seus pontos de parada, via cascade);
  // bloqueada se houver registros diários vinculados a esta rota.
  async removePermanently(id: string): Promise<void> {
    await this.findOne(id);

    try {
      await this.prisma.route.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Não é possível excluir definitivamente: existem registros diários vinculados a esta rota. Use inativar em vez de excluir.',
        );
      }

      throw error;
    }
  }
}
