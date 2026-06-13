import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Driver,
  Prisma,
  Role,
  Trip,
  TripStatus,
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
    startKm: number;
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
    routeDurations?: Record<string, number>;
  } = {},
) {
  const trips = new Map<string, Trip>();
  (options.trips ?? []).forEach((trip) => trips.set(trip.id, trip));

  const drivers = options.drivers ?? [buildDriver()];
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

  const prisma = {
    trip: {
      findUnique: findUniqueTrip,
      findMany: findManyTrip,
      create: createTrip,
      update: updateTrip,
      updateMany: updateManyTrip,
    },
    driver: {
      findFirst: findFirstDriver,
    },
  } as unknown as PrismaService;

  const service = new TripsService(prisma);

  return { service, prisma, trips, updateManyTrip };
}

describe('TripsService', () => {
  describe('create', () => {
    it('exige o motorista quando o usuário não é MOTORISTA', async () => {
      const { service } = buildService();

      await expect(
        service.create(
          { vehicleId: 'vehicle-1', destination: 'Centro', startKm: 1000 },
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
            startKm: 1000,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deriva o motorista automaticamente quando o usuário é MOTORISTA', async () => {
      const { service, trips } = buildService();

      const created = await service.create(
        { vehicleId: 'vehicle-1', destination: 'Centro', startKm: 1000 },
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
          { vehicleId: 'vehicle-1', destination: 'Centro', startKm: 1000 },
          motoristaUser,
        ),
      ).rejects.toThrow(ForbiddenException);
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
