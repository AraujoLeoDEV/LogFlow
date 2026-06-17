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
  Prisma,
  Role,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { DailyLogsService } from './daily-logs.service';

interface FindFirstDriverArgs {
  where: { id?: string; userId?: string; deletedAt?: Date | null };
}

interface FindFirstDailyLogArgs {
  where: { vehicleId?: string; status?: DailyLogStatus };
}

interface FindUniqueDailyLogArgs {
  where: { id: string };
}

interface CreateDailyLogArgs {
  data: {
    vehicleId: string;
    driverId: string;
    routeId: string;
    departureAt: Date;
    startKm: number;
    destination?: string;
    observations?: string;
    status: DailyLogStatus;
    createdBy: string;
    updatedBy: string;
  };
}

interface UpdateDailyLogArgs {
  where: { id: string };
  data: {
    returnAt?: Date;
    endKm?: number;
    kmDriven?: number;
    totalDurationMinutes?: number;
    avgSpeedKmh?: number;
    observations?: string | null;
    status?: DailyLogStatus;
    updatedBy?: string;
  };
}

interface UpdateVehicleArgs {
  where: { id: string };
  data: { currentKm: number };
}

interface FindManyDailyLogArgs {
  where: {
    vehicleId?: string;
    driverId?: string;
    routeId?: string;
    status?: DailyLogStatus;
  };
  skip?: number;
  take?: number;
}

interface UpdateManyDailyLogArgs {
  where: { id: { in: string[] } };
  data: { status: DailyLogStatus };
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

function buildDailyLog(overrides: Partial<DailyLog> = {}): DailyLog {
  return {
    id: 'log-1',
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
    destination: null,
    observations: null,
    status: DailyLogStatus.EM_ANDAMENTO,
    createdBy: 'user-admin',
    updatedBy: 'user-admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(
  options: {
    dailyLogs?: DailyLog[];
    drivers?: Driver[];
    routeDurations?: Record<string, number>;
  } = {},
) {
  const dailyLogs = new Map<string, DailyLog>();
  (options.dailyLogs ?? []).forEach((log) => dailyLogs.set(log.id, log));

  const drivers = options.drivers ?? [buildDriver()];
  const routeDurations = options.routeDurations ?? {};

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

  const findFirstDailyLog = jest.fn(
    (args: FindFirstDailyLogArgs): Promise<DailyLog | null> => {
      const found = [...dailyLogs.values()].find((log) => {
        if (args.where.vehicleId && log.vehicleId !== args.where.vehicleId) {
          return false;
        }
        if (args.where.status && log.status !== args.where.status) {
          return false;
        }
        return true;
      });
      return Promise.resolve(found ?? null);
    },
  );

  const findUniqueDailyLog = jest.fn(
    (args: FindUniqueDailyLogArgs): Promise<DailyLog | null> => {
      return Promise.resolve(dailyLogs.get(args.where.id) ?? null);
    },
  );

  const filterDailyLogs = (where: FindManyDailyLogArgs['where']) => {
    let results = [...dailyLogs.values()];
    if (where.vehicleId) {
      results = results.filter((log) => log.vehicleId === where.vehicleId);
    }
    if (where.driverId) {
      results = results.filter((log) => log.driverId === where.driverId);
    }
    if (where.routeId) {
      results = results.filter((log) => log.routeId === where.routeId);
    }
    if (where.status) {
      results = results.filter((log) => log.status === where.status);
    }
    return results;
  };

  const findManyDailyLog = jest.fn((args: FindManyDailyLogArgs) => {
    let results = filterDailyLogs(args.where);
    if (args.skip) {
      results = results.slice(args.skip);
    }
    if (args.take) {
      results = results.slice(0, args.take);
    }
    return Promise.resolve(
      results.map((log) => ({
        ...log,
        vehicle: { id: log.vehicleId, plate: 'ABC1D23' },
        driver: { id: log.driverId, name: 'João da Silva' },
        route: {
          id: log.routeId,
          name: 'Rota Principal',
          estimatedDurationMinutes: routeDurations[log.routeId] ?? 60,
        },
      })),
    );
  });

  const countDailyLog = jest.fn(
    (args: { where: FindManyDailyLogArgs['where'] }) =>
      Promise.resolve(filterDailyLogs(args.where).length),
  );

  const createDailyLog = jest.fn(
    (args: CreateDailyLogArgs): Promise<DailyLog> => {
      const created = buildDailyLog({
        id: 'log-new',
        vehicleId: args.data.vehicleId,
        driverId: args.data.driverId,
        routeId: args.data.routeId,
        departureAt: args.data.departureAt,
        startKm: new Prisma.Decimal(args.data.startKm),
        destination: args.data.destination ?? null,
        observations: args.data.observations ?? null,
        status: args.data.status,
        createdBy: args.data.createdBy,
        updatedBy: args.data.updatedBy,
      });
      dailyLogs.set(created.id, created);
      return Promise.resolve(created);
    },
  );

  const updateDailyLog = jest.fn(
    (args: UpdateDailyLogArgs): Promise<DailyLog> => {
      const current = dailyLogs.get(args.where.id);
      if (!current) {
        throw new Error('DailyLog não encontrado no mock.');
      }
      const updated = { ...current, ...args.data } as unknown as DailyLog;
      dailyLogs.set(args.where.id, updated);
      return Promise.resolve(updated);
    },
  );

  const updateVehicle = jest.fn((args: UpdateVehicleArgs) =>
    Promise.resolve({ id: args.where.id, currentKm: args.data.currentKm }),
  );

  const updateManyDailyLog = jest.fn((args: UpdateManyDailyLogArgs) => {
    let count = 0;
    for (const id of args.where.id.in) {
      const current = dailyLogs.get(id);
      if (current) {
        dailyLogs.set(id, { ...current, status: args.data.status });
        count += 1;
      }
    }
    return Promise.resolve({ count });
  });

  const prisma = {
    dailyLog: {
      findFirst: findFirstDailyLog,
      findUnique: findUniqueDailyLog,
      findMany: findManyDailyLog,
      count: countDailyLog,
      create: createDailyLog,
      update: updateDailyLog,
      updateMany: updateManyDailyLog,
    },
    driver: {
      findFirst: findFirstDriver,
    },
    vehicle: {
      update: updateVehicle,
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  } as unknown as PrismaService;

  const service = new DailyLogsService(prisma);

  return { service, prisma, dailyLogs, updateVehicle, updateManyDailyLog };
}

describe('DailyLogsService', () => {
  describe('create', () => {
    it('bloqueia nova saída se já existe uma em andamento para o veículo', async () => {
      const { service } = buildService({
        dailyLogs: [buildDailyLog({ status: DailyLogStatus.EM_ANDAMENTO })],
      });

      await expect(
        service.create(
          { vehicleId: 'vehicle-1', driverId: 'driver-1', startKm: 500 },
          adminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('exige o motorista quando o usuário não é MOTORISTA', async () => {
      const { service } = buildService();

      await expect(
        service.create({ vehicleId: 'vehicle-1', startKm: 1000 }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('exige a rota quando não informada e o motorista não possui rota padrão', async () => {
      const { service } = buildService({
        drivers: [buildDriver({ defaultRouteId: null })],
      });

      await expect(
        service.create(
          { vehicleId: 'vehicle-1', driverId: 'driver-1', startKm: 1000 },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('deriva o motorista automaticamente quando o usuário é MOTORISTA', async () => {
      const { service, dailyLogs } = buildService();

      const created = await service.create(
        { vehicleId: 'vehicle-1', startKm: 1000 },
        motoristaUser,
      );

      expect(created.driverId).toBe('driver-1');
      expect(created.status).toBe(DailyLogStatus.EM_ANDAMENTO);
      expect(dailyLogs.get(created.id)).toBeDefined();
    });

    it('rejeita MOTORISTA sem motorista vinculado', async () => {
      const { service } = buildService({ drivers: [] });

      await expect(
        service.create(
          { vehicleId: 'vehicle-1', startKm: 1000 },
          motoristaUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('persiste o destino quando informado', async () => {
      const { service, dailyLogs } = buildService();

      const created = await service.create(
        {
          vehicleId: 'vehicle-1',
          driverId: 'driver-1',
          startKm: 1000,
          destination: 'Filial Centro',
        },
        adminUser,
      );

      expect(created.destination).toBe('Filial Centro');
      expect(dailyLogs.get(created.id)?.destination).toBe('Filial Centro');
    });
  });

  describe('returnTrip', () => {
    it('rejeita endKm menor que startKm com 422', async () => {
      const { service } = buildService({
        dailyLogs: [
          buildDailyLog({
            startKm: new Prisma.Decimal(1000),
            status: DailyLogStatus.EM_ANDAMENTO,
          }),
        ],
      });

      await expect(
        service.returnTrip('log-1', { endKm: 900 }, adminUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('calcula km rodado, duração, velocidade média e atualiza o KM do veículo', async () => {
      const { service, updateVehicle } = buildService({
        dailyLogs: [
          buildDailyLog({
            vehicleId: 'vehicle-1',
            startKm: new Prisma.Decimal(1000),
            departureAt: new Date('2026-06-12T08:00:00Z'),
            status: DailyLogStatus.EM_ANDAMENTO,
          }),
        ],
      });

      const updated = await service.returnTrip(
        'log-1',
        { endKm: 1050, returnAt: '2026-06-12T09:00:00Z' },
        adminUser,
      );

      expect(updated.status).toBe(DailyLogStatus.FINALIZADO);
      expect(updated.kmDriven).toBe(50);
      expect(updated.totalDurationMinutes).toBe(60);
      expect(updated.avgSpeedKmh).toBe(50);
      expect(updateVehicle).toHaveBeenCalledWith({
        where: { id: 'vehicle-1' },
        data: { currentKm: 1050 },
      });
    });

    it('rejeita registrar retorno de um registro já finalizado', async () => {
      const { service } = buildService({
        dailyLogs: [
          buildDailyLog({
            status: DailyLogStatus.FINALIZADO,
            endKm: new Prisma.Decimal(1050),
          }),
        ],
      });

      await expect(
        service.returnTrip('log-1', { endKm: 1100 }, adminUser),
      ).rejects.toThrow(ConflictException);
    });

    it('MOTORISTA não pode registrar retorno de registro de outro motorista', async () => {
      const { service } = buildService({
        dailyLogs: [
          buildDailyLog({
            driverId: 'driver-2',
            status: DailyLogStatus.EM_ANDAMENTO,
          }),
        ],
        drivers: [buildDriver({ id: 'driver-1', userId: 'user-driver-1' })],
      });

      await expect(
        service.returnTrip('log-1', { endKm: 1050 }, motoristaUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('MOTORISTA só vê os próprios registros', async () => {
      const { service } = buildService({
        dailyLogs: [
          buildDailyLog({ id: 'log-1', driverId: 'driver-1' }),
          buildDailyLog({ id: 'log-2', driverId: 'driver-2' }),
        ],
        drivers: [buildDriver({ id: 'driver-1', userId: 'user-driver-1' })],
      });

      const result = await service.findAll({}, motoristaUser);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('log-1');
      expect(result.total).toBe(1);
    });
  });

  describe('markOverdueLogs', () => {
    it('marca como ATRASADO os registros que excederam o tempo estimado da rota', async () => {
      const departureAt = new Date(Date.now() - 120 * 60_000);
      const { service, dailyLogs, updateManyDailyLog } = buildService({
        dailyLogs: [
          buildDailyLog({
            id: 'log-1',
            status: DailyLogStatus.EM_ANDAMENTO,
            departureAt,
            routeId: 'route-1',
          }),
        ],
        routeDurations: { 'route-1': 60 },
      });

      const count = await service.markOverdueLogs();

      expect(count).toBe(1);
      expect(dailyLogs.get('log-1')?.status).toBe(DailyLogStatus.ATRASADO);
      expect(updateManyDailyLog).toHaveBeenCalledTimes(1);
    });

    it('não marca registros que ainda estão dentro do tempo estimado da rota', async () => {
      const departureAt = new Date(Date.now() - 10 * 60_000);
      const { service, dailyLogs, updateManyDailyLog } = buildService({
        dailyLogs: [
          buildDailyLog({
            id: 'log-1',
            status: DailyLogStatus.EM_ANDAMENTO,
            departureAt,
            routeId: 'route-1',
          }),
        ],
        routeDurations: { 'route-1': 60 },
      });

      const count = await service.markOverdueLogs();

      expect(count).toBe(0);
      expect(dailyLogs.get('log-1')?.status).toBe(DailyLogStatus.EM_ANDAMENTO);
      expect(updateManyDailyLog).not.toHaveBeenCalled();
    });
  });
});
