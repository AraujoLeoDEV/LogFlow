import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { Driver, Prisma, Role } from '../../../generated/prisma/client';
import { CreateDriverDto } from './dto/create-driver.dto';
import { DriverHistoryDto } from './dto/driver-history.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDriverDto, userId: string): Promise<Driver> {
    await this.assertUserCanBeDriver(dto.userId);

    try {
      return await this.prisma.driver.create({
        data: {
          ...dto,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    } catch (error) {
      throw this.toFriendlyError(error);
    }
  }

  findAll(): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<Driver> {
    const driver = await this.prisma.driver.findFirst({
      where: { id, deletedAt: null },
    });

    if (!driver) {
      throw new NotFoundException('Motorista não encontrado.');
    }

    return driver;
  }

  async update(
    id: string,
    dto: UpdateDriverDto,
    userId: string,
  ): Promise<Driver> {
    const current = await this.findOne(id);

    if (dto.userId && dto.userId !== current.userId) {
      await this.assertUserCanBeDriver(dto.userId);
    }

    try {
      return await this.prisma.driver.update({
        where: { id },
        data: { ...dto, updatedBy: userId },
      });
    } catch (error) {
      throw this.toFriendlyError(error);
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.driver.update({
      where: { id },
      data: { deletedAt: new Date(), active: false, updatedBy: userId },
    });
  }

  // Histórico placeholder - será agregado conforme as Fases 4, 5 e 7 forem concluídas
  async history(id: string): Promise<DriverHistoryDto> {
    await this.findOne(id);

    return { trips: [], fuelRecords: [], incidents: [] };
  }

  private async assertUserCanBeDriver(userId?: string): Promise<void> {
    if (!userId) {
      return;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new BadRequestException('Usuário informado não existe.');
    }

    if (user.role !== Role.MOTORISTA) {
      throw new BadRequestException(
        'O usuário vinculado a um motorista deve ter o perfil MOTORISTA.',
      );
    }
  }

  private toFriendlyError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new ConflictException(
          'Este usuário já está vinculado a outro motorista.',
        );
      }
      if (error.code === 'P2003') {
        return new BadRequestException(
          'Veículo ou rota padrão informada não existe.',
        );
      }
    }

    return error;
  }
}
