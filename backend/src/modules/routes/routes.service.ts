import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { Route } from '../../../generated/prisma/client';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateRouteDto): Promise<Route> {
    return this.prisma.route.create({ data: dto });
  }

  findAll(): Promise<Route[]> {
    return this.prisma.route.findMany({ orderBy: { name: 'asc' } });
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
