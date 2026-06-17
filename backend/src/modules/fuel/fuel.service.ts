import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { parseDateOnly } from '../../common/utils/date-range.util';
import {
  emptyPage,
  paginate,
  PaginatedResult,
} from '../../common/utils/pagination.util';
import { Driver, Fuel, Prisma, Role } from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { CreateFuelDto } from './dto/create-fuel.dto';
import { FuelQueryDto } from './dto/fuel-query.dto';
import { calculateFuelMetrics, isFuelTypeCompatible } from './fuel.util';

export interface FuelWithRelations extends Fuel {
  vehicle: { id: string; plate: string };
  driver: { id: string; name: string };
}

export interface VehicleFuelIndicator {
  vehicleId: string;
  plate: string;
  avgConsumptionKmL: number | null;
  totalSpent: number;
}

export interface MonthlyFuelSpend {
  month: string;
  total: number;
}

export interface FuelIndicators {
  vehicles: VehicleFuelIndicator[];
  mostEconomical: VehicleFuelIndicator | null;
  mostExpensive: VehicleFuelIndicator | null;
  monthlySpend: MonthlyFuelSpend[];
}

const fuelInclude = {
  vehicle: { select: { id: true, plate: true, model: true, currentKm: true } },
  driver: { select: { id: true, name: true } },
} as const;

@Injectable()
export class FuelService {
  constructor(private readonly prisma: PrismaService) {}

  // Regras da seção 4.6 - registro de abastecimento
  async create(dto: CreateFuelDto, user: AuthenticatedUser): Promise<Fuel> {
    const driver = await this.resolveDriverForCreate(dto, user);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, deletedAt: null },
    });

    if (!vehicle) {
      throw new BadRequestException('Veículo informado não existe.');
    }

    if (!isFuelTypeCompatible(vehicle.fuelType, dto.fuelType)) {
      throw new BadRequestException(
        `O tipo de combustível informado não é compatível com o veículo (${vehicle.fuelType}).`,
      );
    }

    const previous = await this.prisma.fuel.findFirst({
      where: { vehicleId: dto.vehicleId },
      orderBy: { currentKm: 'desc' },
    });

    if (
      previous &&
      new Prisma.Decimal(dto.currentKm).lessThan(previous.currentKm)
    ) {
      throw new UnprocessableEntityException(
        'O KM atual não pode ser menor que o último abastecimento registrado para este veículo.',
      );
    }

    const metrics = calculateFuelMetrics({
      currentKm: dto.currentKm,
      previousKm: previous?.currentKm ?? null,
      liters: dto.liters,
      amountPaid: dto.amountPaid,
    });

    const data = {
      vehicleId: dto.vehicleId,
      driverId: driver.id,
      liters: dto.liters,
      amountPaid: dto.amountPaid,
      currentKm: dto.currentKm,
      fuelType: dto.fuelType,
      date: dto.date ? new Date(dto.date) : new Date(),
      consumptionKmL: metrics.consumptionKmL,
      costPerKm: metrics.costPerKm,
      createdBy: user.sub,
      updatedBy: user.sub,
    };

    try {
      if (new Prisma.Decimal(dto.currentKm).greaterThan(vehicle.currentKm)) {
        const [created] = await this.prisma.$transaction([
          this.prisma.fuel.create({ data }),
          this.prisma.vehicle.update({
            where: { id: dto.vehicleId },
            data: { currentKm: dto.currentKm },
          }),
        ]);
        return created;
      }

      return await this.prisma.fuel.create({ data });
    } catch (error) {
      throw this.toFriendlyError(error);
    }
  }

  // Histórico com filtros - seção 4.6
  async findAll(
    query: FuelQueryDto,
    user: AuthenticatedUser,
  ): Promise<PaginatedResult<FuelWithRelations>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.FuelWhereInput = {
      vehicleId: query.vehicleId,
      driverId: query.driverId,
    };

    if (query.from || query.to) {
      where.date = {
        ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
        ...(query.to ? { lte: parseDateOnly(query.to, true) } : {}),
      };
    }

    if (user.role === Role.MOTORISTA) {
      const driver = await this.prisma.driver.findFirst({
        where: { userId: user.sub, deletedAt: null },
      });

      if (!driver) {
        return emptyPage(page, limit);
      }

      where.driverId = driver.id;
    }

    const [data, total] = await Promise.all([
      this.prisma.fuel.findMany({
        where,
        orderBy: { date: 'desc' },
        include: fuelInclude,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.fuel.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  // Indicadores - seção 4.6
  async getIndicators(): Promise<FuelIndicators> {
    const records = await this.prisma.fuel.findMany({
      include: {
        vehicle: {
          select: { id: true, plate: true, model: true, currentKm: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    const byVehicle = new Map<
      string,
      {
        plate: string;
        model: string;
        currentKm: string;
        consumptionSum: Prisma.Decimal;
        consumptionCount: number;
        totalSpent: Prisma.Decimal;
      }
    >();
    const byMonth = new Map<string, Prisma.Decimal>();

    for (const record of records) {
      const entry = byVehicle.get(record.vehicleId) ?? {
        plate: record.vehicle.plate,
        model: record.vehicle.model,
        currentKm: record.vehicle.currentKm.toString(),
        consumptionSum: new Prisma.Decimal(0),
        consumptionCount: 0,
        totalSpent: new Prisma.Decimal(0),
      };

      entry.totalSpent = entry.totalSpent.plus(record.amountPaid);
      if (record.consumptionKmL !== null) {
        entry.consumptionSum = entry.consumptionSum.plus(record.consumptionKmL);
        entry.consumptionCount += 1;
      }
      byVehicle.set(record.vehicleId, entry);

      const month = record.date.toISOString().slice(0, 7);
      byMonth.set(
        month,
        (byMonth.get(month) ?? new Prisma.Decimal(0)).plus(record.amountPaid),
      );
    }

    const vehicles: VehicleFuelIndicator[] = [...byVehicle.entries()].map(
      ([vehicleId, entry]) => ({
        vehicleId,
        plate: entry.plate,
        model: entry.model,
        currentKm: entry.currentKm,
        avgConsumptionKmL:
          entry.consumptionCount > 0
            ? entry.consumptionSum.dividedBy(entry.consumptionCount).toNumber()
            : null,
        totalSpent: entry.totalSpent.toNumber(),
      }),
    );

    const withConsumption = vehicles.filter(hasConsumption);

    const mostEconomical =
      withConsumption.length === 0
        ? null
        : withConsumption.reduce((best, current) =>
            current.avgConsumptionKmL > best.avgConsumptionKmL ? current : best,
          );

    const mostExpensive =
      withConsumption.length === 0
        ? null
        : withConsumption.reduce((worst, current) =>
            current.avgConsumptionKmL < worst.avgConsumptionKmL
              ? current
              : worst,
          );

    const monthlySpend: MonthlyFuelSpend[] = [...byMonth.entries()]
      .map(([month, total]) => ({ month, total: total.toNumber() }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { vehicles, mostEconomical, mostExpensive, monthlySpend };
  }

  private async resolveDriverForCreate(
    dto: CreateFuelDto,
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

  private toFriendlyError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        return new BadRequestException(
          'Veículo ou motorista informados não existem.',
        );
      }
    }

    return error;
  }
}

function hasConsumption(
  vehicle: VehicleFuelIndicator,
): vehicle is VehicleFuelIndicator & { avgConsumptionKmL: number } {
  return vehicle.avgConsumptionKmL !== null;
}
