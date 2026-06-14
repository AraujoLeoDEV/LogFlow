import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  DailyLog,
  DailyLogStatus,
  Driver,
  FuelType,
  Prisma,
  Role,
  Trip,
  TripStatus,
  Vehicle,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { TripsService } from './trips.service';

interface FindFirstDriverArgs {
  where: { id?: string; userId?: string; deletedAt?: Date | null };
}

interface FindUniqueTripArgs {
  where: { id: string };
}

interface FindManyTripArgs {
  where?: {
    vehicleId?: string;
    driverId?: string;
    routeId?: string;
    status?: TripStatus;
  };
}

interface CreateTripArgs {
  data: {
    vehicleId: string;
    driverId: string;
    routeId: string;
    destination: string;
    startKm: Prisma.Decimal;
    startedAt: Date;
    status: TripStatus;
    createdBy: string;
    updatedBy: string;
  };
}

interface UpdateTripArgs {
  where: { id: string };
  data: {
    endKm?: number;
    finishedAt?: Date;
    status?: TripStatus;
    updatedBy?: string;
  };
}

interface UpdateManyTripArgs {
  where: { id: { in: string[] } };
  data: { status: TripStatus };
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
    defaultRouteId: 'route-1',
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
    tankCapacityLiters: new Prisma.Decimal(55),
    yearModel: 2022,
    mainRouteId: null,
    acquisitionValue: new Prisma.Decimal(95000),
    usefulLifeMonths: 60,
    residualValue: new Prisma.Decimal(35000),
    currentKm: new Prisma.Decimal(1000),
    licensingExpiration: null,
    insuranceExpiration: null,
    active: true,
    nextOilChangeKm: null,
    nextOilChangeDate: null,
    nextTireChangeKm: null,
    nextTireChangeDate: null,
    nextReviewKm: null,
    nextReviewDate: null,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildDailyLog(overrides: Partial<DailyLog> = {}): DailyLog {
  return {
    id: 'daily-log-1',
    vehicleId: 'vehicle-1',
    driverId: 'driver-1',
    routeId: 'route-1',
    departureAt: new Date('2026-06-12T08:00:00Z'),
    returnAt: null,
    startKm: new Prisma.Decimal(1000),
    endKm: null,
    kmDriven: null,
    totalDurationMinutes: null,
    avgSpeedKmh: null,
    observations: null,
    status: DailyLogStatus.EM_ANDAMENTO,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    vehicleId: 'vehicle-1',
    driverId: 'driver-1',
    routeId: 'route-1',
    status: TripStatus.EM_ANDAMENTO,
    destination: 'Centro',
    startKm: new Prisma.Decimal(1000),
    endKm: null,
    startedAt: new Date('2026-06-12T08:00:00Z'),
    finishedAt: null,
    createdBy: 'user-admin',
    updatedBy: 'user-admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(
  options: {
    trips?: Trip[];
    drivers?: Driver[];
    vehicles?: Vehicle[];
    dailyLogs?: DailyLog[];
    routeDurations?: Record<string, number>;
  } = {},
) {
  const trips = new Map<string, Trip>();
  (options.trips ?? []).forEach((trip) => trips.set(trip.id, trip));

  const drivers = options.drivers ?? [buildDriver()];
  const vehicles = options.vehicles ?? [buildVehicle()];
  const dailyLogs = options.dailyLogs ?? [];
  const routeDurations = options.routeDurations ?? { 'route-1': 60 };

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

  const findUniqueTrip = jest.fn(
    (args: FindUniqueTripArgs): Promise<Trip | null> => {
      return Promise.resolve(trips.get(args.where.id) ?? null);
    },
  );

  const findManyTrip = jest.fn((args: FindManyTripArgs) => {
    let results = [...trips.values()];
    if (args.where?.vehicleId) {
      results = results.filter(
        (trip) => trip.vehicleId === args.where?.vehicleId,
      );
    }
    if (args.where?.driverId) {
      results = results.filter(
        (trip) => trip.driverId === args.where?.driverId,
      );
    }
    if (args.where?.routeId) {
      results = results.filter((trip) => trip.routeId === args.where?.routeId);
    }
    if (args.where?.status) {
      results = results.filter((trip) => trip.status === args.where?.status);
    }

    return Promise.resolve(
      results.map((trip) => ({
        ...trip,
        vehicle: { id: trip.vehicleId, plate: 'ABC1D23' },
        driver: { id: trip.driverId, name: 'João da Silva' },
        route: {
          id: trip.routeId,
          name: 'Rota Principal',
          estimatedDurationMinutes: routeDurations[trip.routeId] ?? 60,
        },
      })),
    );
  });

  const createTrip = jest.fn((args: CreateTripArgs): Promise<Trip> => {
    const created = buildTrip({
      id: 'trip-new',
      vehicleId: args.data.vehicleId,
      driverId: args.data.driverId,
      routeId: args.data.routeId,
      destination: args.data.destination,
      startKm: new Prisma.Decimal(args.data.startKm),
      startedAt: args.data.startedAt,
      status: args.data.status,
      createdBy: args.data.createdBy,
      updatedBy: args.data.updatedBy,
    });
    trips.set(created.id, created);
    return Promise.resolve(created);
  });

  const findFirstVehicle = jest.fn(
    (args: { where: { id: string } }): Promise<Vehicle | null> => {
      const found = vehicles.find((vehicle) => vehicle.id === args.where.id);
      return Promise.resolve(found ?? null);
    },
  );

  const findFirstDailyLog = jest.fn(
    (args: {
      where: { vehicleId: string; status: DailyLogStatus };
    }): Promise<DailyLog | null> => {
      const found = dailyLogs.find(
        (log) =>
          log.vehicleId === args.where.vehicleId &&
          log.status === args.where.status,
      );
      return Promise.resolve(found ?? null);
    },
  );

  const findFirstTrip = jest.fn(
    (args: {
      where: { vehicleId: string; status: { in: TripStatus[] } };
    }): Promise<Trip | null> => {
      const found = [...trips.values()].find(
        (trip) =>
          trip.vehicleId === args.where.vehicleId &&
          args.where.status.in.includes(trip.status),
      );
      return Promise.resolve(found ?? null);
    },
  );

  const updateTrip = jest.fn((args: UpdateTripArgs): Promise<Trip> => {
    const current = trips.get(args.where.id);
    if (!current) {
      throw new Error('Trip não encontrada no mock.');
    }
    const updated = { ...current, ...args.data } as unknown as Trip;
    trips.set(args.where.id, updated);
    return Promise.resolve(updated);
  });

  const updateManyTrip = jest.fn((args: UpdateManyTripArgs) => {
    let count = 0;
    args.where.id.in.forEach((id) => {
      const current = trips.get(id);
      if (current) {
        trips.set(id, { ...current, ...args.data });
        count += 1;
      }
    });
    return Promise.resolve({ count });
  });

  const updateVehicle = jest.fn(
    (args: { where: { id: string }; data: { currentKm: number } }) => {
      const vehicle = vehicles.find((item) => item.id === args.where.id);
      if (vehicle) {
        vehicle.currentKm = new Prisma.Decimal(args.data.currentKm);
      }
      return Promise.resolve(vehicle);
    },
  );

  const prisma = {
    trip: {
      findUnique: findUniqueTrip,
      findMany: findManyTrip,
      findFirst: findFirstTrip,
      create: createTrip,
      update: updateTrip,
      updateMany: updateManyTrip,
    },
    driver: {
      findFirst: findFirstDriver,
    },
    vehicle: {
      findFirst: findFirstVehicle,
      update: updateVehicle,
    },
    dailyLog: {
      findFirst: findFirstDailyLog,
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  } as unknown as PrismaService;

  const service = new TripsService(prisma);

  return { service, prisma, trips, vehicles, updateManyTrip, updateVehicle };
}

describe('TripsService', () => {
  describe('create', () => {
    it('exige o motorista quando o usuário não é MOTORISTA', async () => {
      const { service } = buildService();

      await expect(
        service.create(
          { vehicleId: 'vehicle-1', destination: 'Centro' },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('exige a rota quando não informada e o motorista não possui rota padrão', async () => {
      const { service } = buildService({
        drivers: [buildDriver({ defaultRouteId: null })],
      });

      await expect(
        service.create(
          {
            vehicleId: 'vehicle-1',
            driverId: 'driver-1',
            destination: 'Centro',
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deriva o motorista automaticamente quando o usuário é MOTORISTA', async () => {
      const { service, trips } = buildService();

      const created = await service.create(
        { vehicleId: 'vehicle-1', destination: 'Centro' },
        motoristaUser,
      );

      expect(created.driverId).toBe('driver-1');
      expect(created.routeId).toBe('route-1');
      expect(created.status).toBe(TripStatus.EM_ANDAMENTO);
      expect(trips.get(created.id)).toBeDefined();
    });

    it('rejeita MOTORISTA sem motorista vinculado', async () => {
      const { service } = buildService({ drivers: [] });

      await expect(
        service.create(
          { vehicleId: 'vehicle-1', destination: 'Centro' },
          motoristaUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('usa o currentKm do veículo como startKm da viagem', async () => {
      const { service, trips } = buildService({
        vehicles: [buildVehicle({ currentKm: new Prisma.Decimal(4250.5) })],
      });

      const created = await service.create(
        { vehicleId: 'vehicle-1', destination: 'Centro' },
        motoristaUser,
      );

      expect(trips.get(created.id)?.startKm.toString()).toBe('4250.5');
    });

    it('rejeita criação quando o veículo informado não existe', async () => {
      const { service } = buildService({ vehicles: [] });

      await expect(
        service.create(
          { vehicleId: 'vehicle-1', destination: 'Centro' },
          motoristaUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita criação quando o veículo já possui viagem em andamento', async () => {
      const { service } = buildService({
        trips: [
          buildTrip({
            vehicleId: 'vehicle-1',
            status: TripStatus.EM_ANDAMENTO,
          }),
        ],
      });

      await expect(
        service.create(
          { vehicleId: 'vehicle-1', destination: 'Centro' },
          motoristaUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejeita criação quando o veículo já possui viagem atrasada', async () => {
      const { service } = buildService({
        trips: [
          buildTrip({ vehicleId: 'vehicle-1', status: TripStatus.ATRASADA }),
        ],
      });

      await expect(
        service.create(
          { vehicleId: 'vehicle-1', destination: 'Centro' },
          motoristaUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejeita criação quando o veículo está em uma rota em andamento (registro diário)', async () => {
      const { service } = buildService({
        dailyLogs: [
          buildDailyLog({
            vehicleId: 'vehicle-1',
            status: DailyLogStatus.EM_ANDAMENTO,
          }),
        ],
      });

      await expect(
        service.create(
          { vehicleId: 'vehicle-1', destination: 'Centro' },
          motoristaUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('finish', () => {
    it('rejeita endKm menor que startKm com 422', async () => {
      const { service } = buildService({
        trips: [
          buildTrip({
            startKm: new Prisma.Decimal(1000),
            status: TripStatus.EM_ANDAMENTO,
          }),
        ],
      });

      await expect(
        service.finish('trip-1', { endKm: 900 }, adminUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('encerra a viagem, define endKm/finishedAt e status FINALIZADA', async () => {
      const { service, trips } = buildService({
        trips: [
          buildTrip({
            startKm: new Prisma.Decimal(1000),
            status: TripStatus.EM_ANDAMENTO,
          }),
        ],
      });

      const updated = await service.finish(
        'trip-1',
        { endKm: 1050, finishedAt: '2026-06-12T09:00:00Z' },
        adminUser,
      );

      expect(updated.status).toBe(TripStatus.FINALIZADA);
      expect(updated.endKm).toBe(1050);
      expect(updated.finishedAt).toEqual(new Date('2026-06-12T09:00:00Z'));
      expect(trips.get('trip-1')?.status).toBe(TripStatus.FINALIZADA);
    });

    it('atualiza o currentKm do veículo para o endKm da viagem', async () => {
      const { service, vehicles, updateVehicle } = buildService({
        trips: [
          buildTrip({
            vehicleId: 'vehicle-1',
            startKm: new Prisma.Decimal(1000),
            status: TripStatus.EM_ANDAMENTO,
          }),
        ],
        vehicles: [
          buildVehicle({
            id: 'vehicle-1',
            currentKm: new Prisma.Decimal(1000),
          }),
        ],
      });

      await service.finish('trip-1', { endKm: 1050 }, adminUser);

      expect(updateVehicle).toHaveBeenCalledWith({
        where: { id: 'vehicle-1' },
        data: { currentKm: 1050 },
      });
      expect(vehicles[0].currentKm.toString()).toBe('1050');
    });

    it('permite encerrar viagem marcada como ATRASADA', async () => {
      const { service } = buildService({
        trips: [
          buildTrip({
            startKm: new Prisma.Decimal(1000),
            status: TripStatus.ATRASADA,
          }),
        ],
      });

      const updated = await service.finish(
        'trip-1',
        { endKm: 1050 },
        adminUser,
      );

      expect(updated.status).toBe(TripStatus.FINALIZADA);
    });

    it('rejeita encerrar viagem já finalizada', async () => {
      const { service } = buildService({
        trips: [
          buildTrip({
            status: TripStatus.FINALIZADA,
            endKm: new Prisma.Decimal(1050),
            finishedAt: new Date('2026-06-12T09:00:00Z'),
          }),
        ],
      });

      await expect(
        service.finish('trip-1', { endKm: 1100 }, adminUser),
      ).rejects.toThrow(ConflictException);
    });

    it('MOTORISTA não pode encerrar viagem de outro motorista', async () => {
      const { service } = buildService({
        trips: [
          buildTrip({ driverId: 'driver-2', status: TripStatus.EM_ANDAMENTO }),
        ],
        drivers: [buildDriver({ id: 'driver-1', userId: 'user-driver-1' })],
      });

      await expect(
        service.finish('trip-1', { endKm: 1050 }, motoristaUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('MOTORISTA só vê as próprias viagens', async () => {
      const { service } = buildService({
        trips: [
          buildTrip({ id: 'trip-1', driverId: 'driver-1' }),
          buildTrip({ id: 'trip-2', driverId: 'driver-2' }),
        ],
        drivers: [buildDriver({ id: 'driver-1', userId: 'user-driver-1' })],
      });

      const result = await service.findAll({}, motoristaUser);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('trip-1');
    });
  });

  describe('markOverdueTrips', () => {
    it('marca como ATRASADA viagens que excederam o tempo estimado da rota', async () => {
      const startedAt = new Date(Date.now() - 120 * 60_000);
      const { service, trips, updateManyTrip } = buildService({
        trips: [
          buildTrip({
            id: 'trip-1',
            status: TripStatus.EM_ANDAMENTO,
            startedAt,
            routeId: 'route-1',
          }),
        ],
        routeDurations: { 'route-1': 60 },
      });

      const count = await service.markOverdueTrips();

      expect(count).toBe(1);
      expect(trips.get('trip-1')?.status).toBe(TripStatus.ATRASADA);
      expect(updateManyTrip).toHaveBeenCalledTimes(1);
    });

    it('não marca viagem dentro do tempo estimado da rota', async () => {
      const startedAt = new Date(Date.now() - 10 * 60_000);
      const { service, trips, updateManyTrip } = buildService({
        trips: [
          buildTrip({
            id: 'trip-1',
            status: TripStatus.EM_ANDAMENTO,
            startedAt,
            routeId: 'route-1',
          }),
        ],
        routeDurations: { 'route-1': 60 },
      });

      const count = await service.markOverdueTrips();

      expect(count).toBe(0);
      expect(trips.get('trip-1')?.status).toBe(TripStatus.EM_ANDAMENTO);
      expect(updateManyTrip).not.toHaveBeenCalled();
    });
  });
});
