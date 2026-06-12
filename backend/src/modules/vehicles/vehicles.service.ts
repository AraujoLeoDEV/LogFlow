import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Vehicle } from '../../../generated/prisma/client';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { calculateMonthlyDepreciation } from './vehicles.util';

export interface VehicleWithDepreciation extends Vehicle {
  monthlyDepreciation: number;
}

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateVehicleDto,
    userId: string,
  ): Promise<VehicleWithDepreciation> {
    try {
      const vehicle = await this.prisma.vehicle.create({
        data: {
          ...dto,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      return this.withDepreciation(vehicle);
    } catch (error) {
      throw this.toFriendlyError(error);
    }
  }

  async findAll(): Promise<VehicleWithDepreciation[]> {
    const vehicles = await this.prisma.vehicle.findMany({
      where: { deletedAt: null },
      orderBy: { plate: 'asc' },
    });

    return vehicles.map((vehicle) => this.withDepreciation(vehicle));
  }

  async findOne(id: string): Promise<VehicleWithDepreciation> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
    });

    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    return this.withDepreciation(vehicle);
  }

  async update(
    id: string,
    dto: UpdateVehicleDto,
    userId: string,
  ): Promise<VehicleWithDepreciation> {
    await this.findOne(id);

    try {
      const vehicle = await this.prisma.vehicle.update({
        where: { id },
        data: { ...dto, updatedBy: userId },
      });

      return this.withDepreciation(vehicle);
    } catch (error) {
      throw this.toFriendlyError(error);
    }
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.vehicle.update({
      where: { id },
      data: { deletedAt: new Date(), active: false, updatedBy: userId },
    });
  }

  private withDepreciation(vehicle: Vehicle): VehicleWithDepreciation {
    return {
      ...vehicle,
      monthlyDepreciation: calculateMonthlyDepreciation(vehicle),
    };
  }

  private toFriendlyError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new ConflictException(
          'Já existe um veículo cadastrado com esta placa.',
        );
      }
      if (error.code === 'P2003') {
        return new BadRequestException(
          'A rota principal informada não existe.',
        );
      }
    }

    return error;
  }
}
