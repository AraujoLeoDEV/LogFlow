import { BadRequestException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Goal,
  GoalStatus,
  GoalType,
  Prisma,
  Role,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { GoalsService } from './goals.service';

const adminUser: AuthenticatedUser = {
  sub: 'user-admin',
  email: 'admin@empresa.com',
  role: Role.ADMIN,
};

interface FuelRecordFixture {
  driverId: string;
  vehicleId: string;
  date: Date;
  consumptionKmL: Prisma.Decimal | null;
}

function buildGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    driverId: 'driver-1',
    vehicleId: null,
    type: GoalType.CONSUMPTION_REDUCTION,
    period: '2020-01',
    targetValue: new Prisma.Decimal(10),
    actualValue: null,
    commissionValue: null,
    status: GoalStatus.ABERTA,
    createdBy: 'user-admin',
    updatedBy: 'user-admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(
  options: {
    goals?: Goal[];
    drivers?: { id: string; name: string }[];
    vehicles?: {
      id: string;
      plate: string;
      model: string;
      currentKm: Prisma.Decimal;
    }[];
    fuelRecords?: FuelRecordFixture[];
  } = {},
) {
  const goals = [...(options.goals ?? [])];
  const drivers = options.drivers ?? [
    { id: 'driver-1', name: 'João da Silva' },
  ];
  const vehicles = options.vehicles ?? [
    {
      id: 'vehicle-1',
      plate: 'ABC1D23',
      model: 'Fiat Strada',
      currentKm: new Prisma.Decimal(50000),
    },
  ];
  const fuelRecords = options.fuelRecords ?? [];

  function withRelations(goal: Goal) {
    return {
      ...goal,
      driver: goal.driverId
        ? {
            id: goal.driverId,
            name: drivers.find((d) => d.id === goal.driverId)?.name ?? '?',
          }
        : null,
      vehicle: goal.vehicleId
        ? {
            id: goal.vehicleId,
            plate: vehicles.find((v) => v.id === goal.vehicleId)?.plate ?? '?',
            model: vehicles.find((v) => v.id === goal.vehicleId)?.model ?? '?',
            currentKm:
              vehicles.find((v) => v.id === goal.vehicleId)?.currentKm ??
              new Prisma.Decimal(0),
          }
        : null,
    };
  }

  const findFirstDriver = jest.fn((args: { where: { id: string } }) => {
    const found = drivers.find((driver) => driver.id === args.where.id);
    return Promise.resolve(found ? { id: found.id, deletedAt: null } : null);
  });

  const findFirstVehicle = jest.fn((args: { where: { id: string } }) => {
    const found = vehicles.find((vehicle) => vehicle.id === args.where.id);
    return Promise.resolve(found ? { id: found.id, deletedAt: null } : null);
  });

  const createGoal = jest.fn((args: { data: Partial<Goal> }) => {
    const created = buildGoal({ id: `goal-${goals.length + 1}`, ...args.data });
    goals.push(created);
    return Promise.resolve(created);
  });

  const findUniqueGoal = jest.fn(
    (args: { where: { id: string }; include?: unknown }) => {
      const found = goals.find((goal) => goal.id === args.where.id);
      if (!found) return Promise.resolve(null);
      return Promise.resolve(args.include ? withRelations(found) : found);
    },
  );

  const findManyGoal = jest.fn(
    (
      args: {
        where?: Partial<
          Pick<Goal, 'period' | 'status' | 'driverId' | 'vehicleId' | 'type'>
        >;
        include?: unknown;
      } = {},
    ) => {
      let result = [...goals];
      if (args.where?.period)
        result = result.filter((g) => g.period === args.where?.period);
      if (args.where?.status)
        result = result.filter((g) => g.status === args.where?.status);
      if (args.where?.driverId)
        result = result.filter((g) => g.driverId === args.where?.driverId);
      if (args.where?.vehicleId)
        result = result.filter((g) => g.vehicleId === args.where?.vehicleId);
      if (args.where?.type)
        result = result.filter((g) => g.type === args.where?.type);
      return Promise.resolve(args.include ? result.map(withRelations) : result);
    },
  );

  const updateGoal = jest.fn(
    (args: {
      where: { id: string };
      data: Partial<Goal>;
      include?: unknown;
    }) => {
      const index = goals.findIndex((goal) => goal.id === args.where.id);
      const data = Object.fromEntries(
        Object.entries(args.data).filter(([, value]) => value !== undefined),
      );
      goals[index] = { ...goals[index], ...data };
      return Promise.resolve(
        args.include ? withRelations(goals[index]) : goals[index],
      );
    },
  );

  const deleteGoal = jest.fn((args: { where: { id: string } }) => {
    const index = goals.findIndex((goal) => goal.id === args.where.id);
    const [removed] = goals.splice(index, 1);
    return Promise.resolve(removed);
  });

  const findManyFuel = jest.fn(
    (args: {
      where?: {
        driverId?: string;
        vehicleId?: string;
        date?: { gte?: Date; lte?: Date };
      };
    }) => {
      let result = fuelRecords.filter(
        (record) => record.consumptionKmL !== null,
      );
      if (args.where?.driverId)
        result = result.filter(
          (record) => record.driverId === args.where?.driverId,
        );
      if (args.where?.vehicleId)
        result = result.filter(
          (record) => record.vehicleId === args.where?.vehicleId,
        );
      if (args.where?.date?.gte) {
        const gte = args.where.date.gte;
        result = result.filter((record) => record.date >= gte);
      }
      if (args.where?.date?.lte) {
        const lte = args.where.date.lte;
        result = result.filter((record) => record.date <= lte);
      }
      return Promise.resolve(
        result.map((record) => ({ consumptionKmL: record.consumptionKmL })),
      );
    },
  );

  const prisma = {
    goal: {
      create: createGoal,
      findUnique: findUniqueGoal,
      findMany: findManyGoal,
      update: updateGoal,
      delete: deleteGoal,
    },
    driver: { findFirst: findFirstDriver },
    vehicle: { findFirst: findFirstVehicle },
    fuel: { findMany: findManyFuel },
  } as unknown as PrismaService;

  const service = new GoalsService(prisma);

  return { service, prisma, goals, drivers, vehicles, fuelRecords };
}

describe('GoalsService', () => {
  describe('create', () => {
    it('rejeita quando nem motorista nem veículo são informados', async () => {
      const { service } = buildService();

      await expect(
        service.create(
          {
            type: GoalType.CONSUMPTION_REDUCTION,
            period: '2099-01',
            targetValue: 10,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita quando motorista e veículo são informados juntos', async () => {
      const { service } = buildService();

      await expect(
        service.create(
          {
            driverId: 'driver-1',
            vehicleId: 'vehicle-1',
            type: GoalType.CONSUMPTION_REDUCTION,
            period: '2099-01',
            targetValue: 10,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita motorista inexistente', async () => {
      const { service } = buildService({ drivers: [] });

      await expect(
        service.create(
          {
            driverId: 'driver-1',
            type: GoalType.CONSUMPTION_REDUCTION,
            period: '2099-01',
            targetValue: 10,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('para período futuro, mantém a meta ABERTA sem apurar resultado', async () => {
      const { service } = buildService();

      const created = await service.create(
        {
          driverId: 'driver-1',
          type: GoalType.CONSUMPTION_REDUCTION,
          period: '2099-01',
          targetValue: 10,
        },
        adminUser,
      );

      expect(created.status).toBe('ABERTA');
      expect(created.actualValue).toBeNull();
      expect(created.commissionValue).toBeNull();
    });

    it('para período encerrado, apura o resultado real e a comissão imediatamente', async () => {
      const { service } = buildService({
        fuelRecords: [
          {
            driverId: 'driver-1',
            vehicleId: 'vehicle-1',
            date: new Date(2020, 0, 10),
            consumptionKmL: new Prisma.Decimal(9),
          },
          {
            driverId: 'driver-1',
            vehicleId: 'vehicle-1',
            date: new Date(2020, 0, 20),
            consumptionKmL: new Prisma.Decimal(13),
          },
        ],
      });

      const created = await service.create(
        {
          driverId: 'driver-1',
          type: GoalType.CONSUMPTION_REDUCTION,
          period: '2020-01',
          targetValue: 10,
        },
        adminUser,
      );

      expect(created.actualValue?.toNumber()).toBe(11);
      expect(created.status).toBe('ATINGIDA');
      expect(created.commissionValue?.toNumber()).toBe(50);
    });
  });

  describe('update', () => {
    it('lança NotFoundException para meta inexistente', async () => {
      const { service } = buildService();

      await expect(
        service.update('goal-x', { targetValue: 12 }, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('trocar para veículo limpa o vínculo com motorista', async () => {
      const { service, goals } = buildService({
        goals: [
          buildGoal({
            id: 'goal-1',
            driverId: 'driver-1',
            vehicleId: null,
            period: '2099-01',
          }),
        ],
      });

      const updated = await service.update(
        'goal-1',
        { vehicleId: 'vehicle-1' },
        adminUser,
      );

      expect(updated.driverId).toBeNull();
      expect(updated.vehicleId).toBe('vehicle-1');
      expect(goals[0].driverId).toBeNull();
    });
  });

  describe('remove', () => {
    it('lança NotFoundException para meta inexistente', async () => {
      const { service } = buildService();

      await expect(service.remove('goal-x')).rejects.toThrow(NotFoundException);
    });

    it('remove a meta existente', async () => {
      const { service, goals } = buildService({
        goals: [buildGoal({ id: 'goal-1' })],
      });

      await service.remove('goal-1');

      expect(goals).toHaveLength(0);
    });
  });

  describe('recalculateClosedGoals', () => {
    it('recalcula apenas metas ABERTA com período encerrado', async () => {
      const { service, goals } = buildService({
        goals: [
          buildGoal({
            id: 'goal-1',
            period: '2020-01',
            status: GoalStatus.ABERTA,
          }),
          buildGoal({
            id: 'goal-2',
            period: '2099-01',
            status: GoalStatus.ABERTA,
          }),
        ],
        fuelRecords: [
          {
            driverId: 'driver-1',
            vehicleId: 'vehicle-1',
            date: new Date(2020, 0, 10),
            consumptionKmL: new Prisma.Decimal(8),
          },
        ],
      });

      const updated = await service.recalculateClosedGoals();

      expect(updated).toBe(1);
      expect(goals[0].status).toBe('NAO_ATINGIDA');
      expect(goals[1].status).toBe('ABERTA');
    });
  });

  describe('getRanking', () => {
    it('ordena pela maior diferença (real - meta), metas sem apuração ficam por último', async () => {
      const { service } = buildService({
        goals: [
          buildGoal({
            id: 'goal-1',
            driverId: 'driver-1',
            period: '2026-06',
            targetValue: new Prisma.Decimal(10),
            actualValue: new Prisma.Decimal(12),
            status: GoalStatus.ATINGIDA,
            commissionValue: new Prisma.Decimal(100),
          }),
          buildGoal({
            id: 'goal-2',
            driverId: 'driver-1',
            vehicleId: null,
            period: '2026-06',
            targetValue: new Prisma.Decimal(10),
            actualValue: null,
            status: GoalStatus.ABERTA,
          }),
          buildGoal({
            id: 'goal-3',
            driverId: null,
            vehicleId: 'vehicle-1',
            period: '2026-06',
            targetValue: new Prisma.Decimal(10),
            actualValue: new Prisma.Decimal(8),
            status: GoalStatus.NAO_ATINGIDA,
            commissionValue: new Prisma.Decimal(0),
          }),
        ],
      });

      const ranking = await service.getRanking('2026-06');

      expect(ranking.map((entry) => entry.goalId)).toEqual([
        'goal-1',
        'goal-3',
        'goal-2',
      ]);
      expect(ranking[0].difference).toBe(2);
      expect(ranking[1].difference).toBe(-2);
      expect(ranking[2].difference).toBeNull();
    });
  });
});
