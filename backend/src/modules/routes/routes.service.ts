import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { groupAndAccumulate } from '../../common/utils/group.util';
import { Route } from '../../../generated/prisma/client';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

export interface RouteWithUsageCount extends Route {
  usageCount: number;
}

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateRouteDto): Promise<Route> {
    return this.prisma.route.create({ data: dto });
  }

  // Lista com a quantidade de vezes que cada rota foi utilizada (total de
  // registros de Registro Diário com essa rota, sem filtro de período).
  async findAll(): Promise<RouteWithUsageCount[]> {
    const [routes, dailyLogs] = await Promise.all([
      this.prisma.route.findMany({ orderBy: { name: 'asc' } }),
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

  async findOne(id: string): Promise<Route> {
    const route = await this.prisma.route.findUnique({ where: { id } });

    if (!route) {
      throw new NotFoundException('Rota não encontrada.');
    }

    return route;
  }

  async update(id: string, dto: UpdateRouteDto): Promise<Route> {
    await this.findOne(id);

    return this.prisma.route.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.route.update({
      where: { id },
      data: { active: false },
    });
  }
}
