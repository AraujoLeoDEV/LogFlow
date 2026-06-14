import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { FuelType, Prisma, Vehicle } from '../../../generated/prisma/client';
import { VehiclesService } from './vehicles.service';

interface FindFirstArgs {
  where: { id: string; deletedAt?: Date | null };
}

interface FindManyArgs {
  where: { deletedAt?: Date | null };
}

interface UpdateArgs {
  where: { id: string };
  data: Partial<Vehicle>;
}

function buildVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'vehicle-1',
    plate: 'ABC1D23',
    model: 'Fiat Strada',
    fuelType: FuelType.FLEX,
    tankCapacityLiters: new Prisma.Decimal(55),
    yearModel: 2022,
    mainRouteId: null,
    acquisitionValue: new Prisma.Decimal(100000),
    usefulLifeMonths: 60,
    residualValue: new Prisma.Decimal(40000),
    currentKm: new Prisma.Decimal(0),
    licensingExpiration: null,
    insuranceExpiration: null,
    nextOilChangeKm: null,
    nextOilChangeDate: null,
    nextTireChangeKm: null,
    nextTireChangeDate: null,
    nextReviewKm: null,
    nextReviewDate: null,
    active: true,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildService() {
  const store = new Map<string, Vehicle>();
  store.set('vehicle-1', buildVehicle());

  const findFirstMock = jest.fn<Promise<Vehicle | null>, [FindFirstArgs]>(
    (args) => {
      const found = store.get(args.where.id);
      if (
        !found ||
        (args.where.deletedAt === null && found.deletedAt !== null)
      ) {
        return Promise.resolve(null);
      }
      return Promise.resolve(found);
    },
  );

  const findManyMock = jest.fn<Promise<Vehicle[]>, [FindManyArgs]>((args) => {
    const all = [...store.values()];
    if (args.where.deletedAt === null) {
      return Promise.resolve(
        all.filter((vehicle) => vehicle.deletedAt === null),
      );
    }
    return Promise.resolve(all);
  });

  const updateMock = jest.fn<Promise<Vehicle>, [UpdateArgs]>((args) => {
    const found = store.get(args.where.id);
    if (!found) {
      throw new Error('Veículo não encontrado no mock.');
    }
    const updated = { ...found, ...args.data };
    store.set(args.where.id, updated);
    return Promise.resolve(updated);
  });

  const prisma = {
    vehicle: {
      findFirst: findFirstMock,
      findMany: findManyMock,
      update: updateMock,
      create: jest.fn(),
    },
  } as unknown as PrismaService;

  const service = new VehiclesService(prisma);

  return { service, store };
}

describe('VehiclesService', () => {
  it('retorna o veículo com a depreciação mensal calculada', async () => {
    const { service } = buildService();

    const result = await service.findOne('vehicle-1');

    expect(result.monthlyDepreciation).toBeCloseTo((100000 - 40000) / 60);
  });

  describe('soft delete', () => {
    it('marca deletedAt e active=false ao remover, sem excluir o registro', async () => {
      const { service, store } = buildService();

      await service.remove('vehicle-1', 'user-2');

      const stored = store.get('vehicle-1');
      expect(stored).toBeDefined();
      expect(stored?.deletedAt).toBeInstanceOf(Date);
      expect(stored?.active).toBe(false);
      expect(stored?.updatedBy).toBe('user-2');
    });

    it('não retorna o registro removido em findAll', async () => {
      const { service } = buildService();

      await service.remove('vehicle-1', 'user-2');
      const all = await service.findAll();

      expect(all).toHaveLength(0);
    });

    it('lança NotFoundException ao buscar um registro removido', async () => {
      const { service } = buildService();

      await service.remove('vehicle-1', 'user-2');

      await expect(service.findOne('vehicle-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
