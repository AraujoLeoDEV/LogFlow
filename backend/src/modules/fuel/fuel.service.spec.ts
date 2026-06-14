import {
  BadRequestException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Driver,
  Fuel,
  FuelType,
  Prisma,
  Role,
  Vehicle,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { FuelService } from './fuel.service';

interface FindFirstDriverArgs {
  where: { id?: string; userId?: string; deletedAt?: Date | null };
}

interface FindFirstVehicleArgs {
  where: { id: string; deletedAt?: Date | null };
}

interface FindFirstFuelArgs {
  where: { vehicleId: string };
}

interface FindManyFuelArgs {
  where?: {
    vehicleId?: string;
    driverId?: string;
    date?: { gte?: Date; lte?: Date };
  };
}

interface CreateFuelArgs {
  data: {
    vehicleId: string;
    driverId: string;
    liters: number;
    amountPaid: number;
    currentKm: number;
    fuelType: FuelType;
    date: Date;
    consumptionKmL: Prisma.Decimal | null;
    costPerKm: Prisma.Decimal | null;
    createdBy: string;
    updatedBy: string;
  };
}

interface UpdateVehicleArgs {
  where: { id: string };
  data: { currentKm: number };
}

const adminUser: AuthenticatedUser = {
  sub: 'user-admin',
  email: 'admin@empresa.com',
  role: Role.ADMIN,
};

const motoristaUser: AuthenticatedUser = {
  sub: 'user-driver-1',
  email: 'motorista@empresa.com',
  role: Role.MOTORISTA,
};

function buildDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: 'driver-1',
    name: 'João da Silva',
    position: 'Motorista',
    vehicleId: null,
    currentKm: new Prisma.Decimal(0),
    defaultRouteId: null,
    cnhExpiration: null,
    userId: 'user-driver-1',
    active: true,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'vehicle-1',
    plate: 'ABC1D23',
    model: 'Fiat Strada',
    fuelType: FuelType.FLEX,
    tankCapacityLiters: new Prisma.Decimal(50),
    yearModel: 2020,
    mainRouteId: null,
    acquisitionValue: new Prisma.Decimal(100000),
    usefulLifeMonths: 60,
    residualValue: new Prisma.Decimal(20000),
    currentKm: new Prisma.Decimal(1000),
    licensingExpiration: null,
    insuranceExpiration: null,
    nextOilChangeKm: null,
    nextOilChangeDate: null,
    nextTireChangeKm: null,
    nextTireChangeDate: null,
    nextReviewKm: null,
    nextReviewDate: null,
    active: true,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildFuel(overrides: Partial<Fuel> = {}): Fuel {
  return {
    id: 'fuel-1',
    vehicleId: 'vehicle-1',
    driverId: 'driver-1',
    liters: new Prisma.Decimal(40),
    amountPaid: new Prisma.Decimal(200),
    currentKm: new Prisma.Decimal(1000),
    fuelType: FuelType.FLEX,
    date: new Date('2026-06-01T10:00:00Z'),
    consumptionKmL: null,
    costPerKm: null,
    createdBy: 'user-admin',
    updatedBy: 'user-admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(
  options: {
    fuelRecords?: Fuel[];
    drivers?: Driver[];
    vehicles?: Vehicle[];
  } = {},
) {
  const fuelRecords = [...(options.fuelRecords ?? [])];
  const drivers = options.drivers ?? [buildDriver()];
  const vehicles = options.vehicles ?? [buildVehicle()];

  const findFirstDriver = jest.fn(
    (args: FindFirstDriverArgs): Promise<Driver | null> => {
      const found = drivers.find((driver) => {
        if (args.where.id) return driver.id === args.where.id;
        if (args.where.userId) return driver.userId === args.where.userId;
        return false;
      });
      return Promise.resolve(found ?? null);
    },
  );

  const findFirstVehicle = jest.fn(
    (args: FindFirstVehicleArgs): Promise<Vehicle | null> => {
      const found = vehicles.find((vehicle) => vehicle.id === args.where.id);
      return Promise.resolve(found ?? null);
    },
  );

  const findFirstFuel = jest.fn(
    (args: FindFirstFuelArgs): Promise<Fuel | null> => {
      const filtered = fuelRecords.filter(
        (fuel) => fuel.vehicleId === args.where.vehicleId,
      );
      if (filtered.length === 0) return Promise.resolve(null);

      const sorted = [...filtered].sort((a, b) =>
        new Prisma.Decimal(b.currentKm).comparedTo(a.currentKm),
      );
      return Promise.resolve(sorted[0]);
    },
  );

  const findManyFuel = jest.fn((args: FindManyFuelArgs = {}) => {
    let results = [...fuelRecords];
    if (args.where?.vehicleId) {
      results = results.filter(
        (fuel) => fuel.vehicleId === args.where?.vehicleId,
      );
    }
    if (args.where?.driverId) {
      results = results.filter(
        (fuel) => fuel.driverId === args.where?.driverId,
      );
    }
    if (args.where?.date?.gte) {
      const gte = args.where.date.gte;
      results = results.filter((fuel) => fuel.date >= gte);
    }
    if (args.where?.date?.lte) {
      const lte = args.where.date.lte;
      results = results.filter((fuel) => fuel.date <= lte);
    }

    return Promise.resolve(
      results.map((fuel) => ({
        ...fuel,
        vehicle: {
          id: fuel.vehicleId,
          plate:
            vehicles.find((vehicle) => vehicle.id === fuel.vehicleId)?.plate ??
            'UNKNOWN',
          model:
            vehicles.find((vehicle) => vehicle.id === fuel.vehicleId)?.model ??
            'UNKNOWN',
          currentKm:
            vehicles
              .find((vehicle) => vehicle.id === fuel.vehicleId)
              ?.currentKm.toString() ?? '0',
        },
        driver: { id: fuel.driverId, name: 'João da Silva' },
      })),
    );
  });

  const createFuel = jest.fn((args: CreateFuelArgs): Promise<Fuel> => {
    const created = buildFuel({
      id: `fuel-${fuelRecords.length + 1}`,
      ...args.data,
    });
    fuelRecords.push(created);
    return Promise.resolve(created);
  });

  const updateVehicle = jest.fn((args: UpdateVehicleArgs): Promise<Vehicle> => {
    const vehicle = vehicles.find((item) => item.id === args.where.id);
    if (!vehicle) {
      throw new Error('Vehicle não encontrado no mock.');
    }
    vehicle.currentKm = new Prisma.Decimal(args.data.currentKm);
    return Promise.resolve(vehicle);
  });

  const transaction = jest.fn((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  );

  const prisma = {
    fuel: {
      findFirst: findFirstFuel,
      findMany: findManyFuel,
      create: createFuel,
    },
    vehicle: {
      findFirst: findFirstVehicle,
      update: updateVehicle,
    },
    driver: {
      findFirst: findFirstDriver,
    },
    $transaction: transaction,
  } as unknown as PrismaService;

  const service = new FuelService(prisma);

  return { service, prisma, fuelRecords, vehicles, drivers, updateVehicle };
}

describe('FuelService', () => {
  describe('create', () => {
    it('exige o motorista quando o usuário não é MOTORISTA', async () => {
      const { service } = buildService();

      await expect(
        service.create(
          {
            vehicleId: 'vehicle-1',
            liters: 40,
            amountPaid: 200,
            currentKm: 1100,
            fuelType: FuelType.FLEX,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita tipo de combustível incompatível com o veículo', async () => {
      const { service } = buildService({
        vehicles: [buildVehicle({ fuelType: FuelType.DIESEL })],
      });

      await expect(
        service.create(
          {
            vehicleId: 'vehicle-1',
            driverId: 'driver-1',
            liters: 40,
            amountPaid: 200,
            currentKm: 1100,
            fuelType: FuelType.GASOLINE,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita currentKm menor que o último abastecimento registrado', async () => {
      const { service } = buildService({
        fuelRecords: [
          buildFuel({
            vehicleId: 'vehicle-1',
            currentKm: new Prisma.Decimal(1000),
          }),
        ],
        vehicles: [buildVehicle({ currentKm: new Prisma.Decimal(1000) })],
      });

      await expect(
        service.create(
          {
            vehicleId: 'vehicle-1',
            driverId: 'driver-1',
            liters: 40,
            amountPaid: 200,
            currentKm: 900,
            fuelType: FuelType.FLEX,
          },
          adminUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('primeiro abastecimento não calcula consumptionKmL/costPerKm e atualiza currentKm do veículo', async () => {
      const { service, vehicles } = buildService({
        vehicles: [buildVehicle({ currentKm: new Prisma.Decimal(1000) })],
      });

      const created = await service.create(
        {
          vehicleId: 'vehicle-1',
          driverId: 'driver-1',
          liters: 40,
          amountPaid: 200,
          currentKm: 1100,
          fuelType: FuelType.FLEX,
        },
        adminUser,
      );

      expect(created.consumptionKmL).toBeNull();
      expect(created.costPerKm).toBeNull();
      expect(vehicles[0].currentKm.toNumber()).toBe(1100);
    });

    it('calcula consumptionKmL e costPerKm com base no abastecimento anterior', async () => {
      const { service } = buildService({
        fuelRecords: [
          buildFuel({
            vehicleId: 'vehicle-1',
            currentKm: new Prisma.Decimal(1000),
          }),
        ],
        vehicles: [buildVehicle({ currentKm: new Prisma.Decimal(1000) })],
      });

      const created = await service.create(
        {
          vehicleId: 'vehicle-1',
          driverId: 'driver-1',
          liters: 40,
          amountPaid: 200,
          currentKm: 1400,
          fuelType: FuelType.FLEX,
        },
        adminUser,
      );

      expect(created.consumptionKmL?.toNumber()).toBe(10);
      expect(created.costPerKm?.toNumber()).toBe(0.5);
    });

    it('MOTORISTA deriva o motorista automaticamente', async () => {
      const { service, fuelRecords } = buildService({
        vehicles: [buildVehicle({ currentKm: new Prisma.Decimal(1000) })],
      });

      const created = await service.create(
        {
          vehicleId: 'vehicle-1',
          liters: 40,
          amountPaid: 200,
          currentKm: 1100,
          fuelType: FuelType.FLEX,
        },
        motoristaUser,
      );

      expect(created.driverId).toBe('driver-1');
      expect(fuelRecords).toHaveLength(1);
    });

    it('rejeita MOTORISTA sem motorista vinculado', async () => {
      const { service } = buildService({ drivers: [] });

      await expect(
        service.create(
          {
            vehicleId: 'vehicle-1',
            liters: 40,
            amountPaid: 200,
            currentKm: 1100,
            fuelType: FuelType.FLEX,
          },
          motoristaUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll', () => {
    it('MOTORISTA só vê os próprios abastecimentos', async () => {
      const { service } = buildService({
        fuelRecords: [
          buildFuel({ id: 'fuel-1', driverId: 'driver-1' }),
          buildFuel({ id: 'fuel-2', driverId: 'driver-2' }),
        ],
      });

      const result = await service.findAll({}, motoristaUser);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('fuel-1');
    });
  });

  describe('getIndicators', () => {
    it('calcula consumo médio, gasto total, mais econômico/mais caro e gasto mensal', async () => {
      const { service } = buildService({
        vehicles: [
          buildVehicle({ id: 'vehicle-1', plate: 'ABC1D23' }),
          buildVehicle({ id: 'vehicle-2', plate: 'XYZ9876' }),
        ],
        fuelRecords: [
          buildFuel({
            id: 'fuel-1',
            vehicleId: 'vehicle-1',
            amountPaid: new Prisma.Decimal(200),
            consumptionKmL: new Prisma.Decimal(10),
            date: new Date('2026-05-15T10:00:00Z'),
          }),
          buildFuel({
            id: 'fuel-2',
            vehicleId: 'vehicle-1',
            amountPaid: new Prisma.Decimal(220),
            consumptionKmL: new Prisma.Decimal(12),
            date: new Date('2026-06-15T10:00:00Z'),
          }),
          buildFuel({
            id: 'fuel-3',
            vehicleId: 'vehicle-2',
            amountPaid: new Prisma.Decimal(300),
            consumptionKmL: new Prisma.Decimal(6),
            date: new Date('2026-06-20T10:00:00Z'),
          }),
        ],
      });

      const indicators = await service.getIndicators();

      const vehicle1 = indicators.vehicles.find(
        (item) => item.vehicleId === 'vehicle-1',
      );
      const vehicle2 = indicators.vehicles.find(
        (item) => item.vehicleId === 'vehicle-2',
      );

      expect(vehicle1?.avgConsumptionKmL).toBe(11);
      expect(vehicle1?.totalSpent).toBe(420);
      expect(vehicle2?.avgConsumptionKmL).toBe(6);
      expect(vehicle2?.totalSpent).toBe(300);

      expect(indicators.mostEconomical?.vehicleId).toBe('vehicle-1');
      expect(indicators.mostExpensive?.vehicleId).toBe('vehicle-2');

      expect(indicators.monthlySpend).toEqual([
        { month: '2026-05', total: 200 },
        { month: '2026-06', total: 520 },
      ]);
    });
  });
});
