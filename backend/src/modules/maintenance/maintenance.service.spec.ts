import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import {
  FuelType,
  Maintenance,
  MaintenanceCategory,
  MaintenanceType,
  Prisma,
  Role,
  Vehicle,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { OIL_CHANGE_INTERVAL_MONTHS, addMonths } from './maintenance.util';
import { MaintenanceService } from './maintenance.service';

const adminUser: AuthenticatedUser = {
  sub: 'user-admin',
  email: 'admin@empresa.com',
  role: Role.ADMIN,
};

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
    currentKm: new Prisma.Decimal(50000),
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

function buildMaintenance(overrides: Partial<Maintenance> = {}): Maintenance {
  return {
    id: 'maintenance-1',
    vehicleId: 'vehicle-1',
    type: MaintenanceType.PREVENTIVA,
    category: MaintenanceCategory.OUTROS,
    km: new Prisma.Decimal(50000),
    cost: new Prisma.Decimal(350),
    description: 'Manutenção de teste',
    scheduledDate: null,
    scheduledKm: null,
    performedDate: null,
    createdBy: 'user-admin',
    updatedBy: 'user-admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface FindFirstVehicleArgs {
  where: { id: string; deletedAt?: Date | null };
}

interface MaintenanceWhere {
  vehicleId?: string;
  type?: MaintenanceType;
  category?: MaintenanceCategory;
  performedDate?: { gte?: Date; lte?: Date };
}

interface FindManyMaintenanceArgs {
  where?: MaintenanceWhere;
  skip?: number;
  take?: number;
}

interface CreateMaintenanceArgs {
  data: Prisma.MaintenanceCreateInput;
}

interface UpdateVehicleArgs {
  where: { id: string };
  data: Record<string, unknown>;
}

function buildService(
  options: {
    vehicles?: Vehicle[];
    maintenances?: Maintenance[];
    env?: Record<string, string>;
  } = {},
) {
  const vehicles = options.vehicles ?? [buildVehicle()];
  const maintenances = [...(options.maintenances ?? [])];
  const env = options.env ?? {};

  const findFirstVehicle = jest.fn(
    (args: FindFirstVehicleArgs): Promise<Vehicle | null> => {
      const found = vehicles.find((vehicle) => vehicle.id === args.where.id);
      return Promise.resolve(found ?? null);
    },
  );

  const findManyVehicle = jest.fn(() => Promise.resolve(vehicles));

  const createMaintenance = jest.fn(
    (
      args: CreateMaintenanceArgs,
    ): Promise<
      Maintenance & {
        vehicle: {
          id: string;
          plate: string;
          model: string;
          currentKm: Prisma.Decimal;
        };
      }
    > => {
      const data = args.data as unknown as {
        type: MaintenanceType;
        category: MaintenanceCategory;
        km: number;
        cost: number;
        description: string;
        scheduledDate: Date | null;
        scheduledKm: number | null;
        performedDate: Date | null;
        createdBy: string;
        updatedBy: string;
        vehicle: { connect: { id: string } };
      };
      const created = buildMaintenance({
        id: `maintenance-${maintenances.length + 1}`,
        vehicleId: data.vehicle.connect.id,
        type: data.type,
        category: data.category,
        km: new Prisma.Decimal(data.km),
        cost: new Prisma.Decimal(data.cost),
        description: data.description,
        scheduledDate: data.scheduledDate,
        scheduledKm:
          data.scheduledKm !== null
            ? new Prisma.Decimal(data.scheduledKm)
            : null,
        performedDate: data.performedDate,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
      });
      maintenances.push(created);
      const vehicle = vehicles.find((item) => item.id === created.vehicleId);
      return Promise.resolve({
        ...created,
        vehicle: {
          id: created.vehicleId,
          plate: vehicle?.plate ?? 'UNKNOWN',
          model: vehicle?.model ?? 'UNKNOWN',
          currentKm: vehicle?.currentKm ?? new Prisma.Decimal(0),
        },
      });
    },
  );

  const filterMaintenance = (where?: MaintenanceWhere) => {
    let results = [...maintenances];
    if (where?.vehicleId) {
      results = results.filter((item) => item.vehicleId === where.vehicleId);
    }
    if (where?.type) {
      results = results.filter((item) => item.type === where.type);
    }
    if (where?.category) {
      results = results.filter((item) => item.category === where.category);
    }
    if (where?.performedDate?.gte) {
      const gte = where.performedDate.gte;
      results = results.filter(
        (item) => !!item.performedDate && item.performedDate >= gte,
      );
    }
    if (where?.performedDate?.lte) {
      const lte = where.performedDate.lte;
      results = results.filter(
        (item) => !!item.performedDate && item.performedDate <= lte,
      );
    }

    return results;
  };

  const findManyMaintenance = jest.fn((args: FindManyMaintenanceArgs = {}) => {
    let results = filterMaintenance(args.where);

    if (args.skip !== undefined || args.take !== undefined) {
      const skip = args.skip ?? 0;
      const take = args.take ?? results.length;
      results = results.slice(skip, skip + take);
    }

    return Promise.resolve(
      results.map((maintenance) => {
        const vehicle = vehicles.find(
          (item) => item.id === maintenance.vehicleId,
        );
        return {
          ...maintenance,
          vehicle: {
            id: maintenance.vehicleId,
            plate: vehicle?.plate ?? 'UNKNOWN',
            model: vehicle?.model ?? 'UNKNOWN',
            currentKm: vehicle?.currentKm ?? new Prisma.Decimal(0),
          },
        };
      }),
    );
  });

  const countMaintenance = jest.fn((args: { where?: MaintenanceWhere } = {}) =>
    Promise.resolve(filterMaintenance(args.where).length),
  );

  const findUniqueMaintenance = jest.fn((args: { where: { id: string } }) =>
    Promise.resolve(
      maintenances.find((item) => item.id === args.where.id) ?? null,
    ),
  );

  const deleteMaintenance = jest.fn((args: { where: { id: string } }) => {
    const index = maintenances.findIndex((item) => item.id === args.where.id);
    const [removed] = maintenances.splice(index, 1);
    return Promise.resolve(removed);
  });

  const updateVehicle = jest.fn((args: UpdateVehicleArgs): Promise<Vehicle> => {
    const vehicle = vehicles.find((item) => item.id === args.where.id);
    if (!vehicle) {
      throw new Error('Vehicle não encontrado no mock.');
    }
    Object.assign(vehicle, args.data);
    return Promise.resolve(vehicle);
  });

  const transaction = jest.fn((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  );

  const prisma = {
    vehicle: {
      findFirst: findFirstVehicle,
      findMany: findManyVehicle,
      update: updateVehicle,
    },
    maintenance: {
      create: createMaintenance,
      findMany: findManyMaintenance,
      count: countMaintenance,
      findUnique: findUniqueMaintenance,
      delete: deleteMaintenance,
    },
    $transaction: transaction,
  } as unknown as PrismaService;

  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;

  const service = new MaintenanceService(prisma, config);

  return {
    service,
    prisma,
    vehicles,
    maintenances,
    updateVehicle,
    transaction,
    deleteMaintenance,
  };
}

describe('MaintenanceService', () => {
  describe('create', () => {
    it('rejeita veículo inexistente', async () => {
      const { service } = buildService({ vehicles: [] });

      await expect(
        service.create(
          {
            vehicleId: 'vehicle-1',
            type: MaintenanceType.PREVENTIVA,
            category: MaintenanceCategory.OUTROS,
            km: 50000,
            cost: 100,
            description: 'Teste',
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('sem performedDate não atualiza campos next* do veículo (agendamento futuro)', async () => {
      const { service, vehicles, transaction } = buildService();

      const created = await service.create(
        {
          vehicleId: 'vehicle-1',
          type: MaintenanceType.PREVENTIVA,
          category: MaintenanceCategory.TROCA_OLEO,
          km: 50000,
          cost: 100,
          description: 'Agendamento de troca de óleo',
          scheduledDate: '2026-07-01T00:00:00.000Z',
          scheduledKm: 60000,
        },
        adminUser,
      );

      expect(created.performedDate).toBeNull();
      expect(vehicles[0].nextOilChangeKm).toBeNull();
      expect(transaction).not.toHaveBeenCalled();
    });

    it('TROCA_OLEO concluída recalcula nextOilChangeKm/Date com base em KM_ALERT_OIL_CHANGE', async () => {
      const performedDate = '2026-06-13T00:00:00.000Z';
      const { service, vehicles } = buildService({
        env: { KM_ALERT_OIL_CHANGE: '10000', KM_ALERT_MAINTENANCE: '5000' },
      });

      await service.create(
        {
          vehicleId: 'vehicle-1',
          type: MaintenanceType.PREVENTIVA,
          category: MaintenanceCategory.TROCA_OLEO,
          km: 50000,
          cost: 200,
          description: 'Troca de óleo realizada',
          performedDate,
        },
        adminUser,
      );

      expect(vehicles[0].nextOilChangeKm).toBe(60000);
      expect(vehicles[0].nextOilChangeDate).toEqual(
        addMonths(new Date(performedDate), OIL_CHANGE_INTERVAL_MONTHS),
      );
      // demais campos next* não são afetados
      expect(vehicles[0].nextTireChangeKm).toBeNull();
      expect(vehicles[0].nextReviewKm).toBeNull();
    });

    it('categoria OUTROS concluída não altera nenhum campo next*', async () => {
      const { service, vehicles, transaction } = buildService();

      await service.create(
        {
          vehicleId: 'vehicle-1',
          type: MaintenanceType.CORRETIVA,
          category: MaintenanceCategory.OUTROS,
          km: 50000,
          cost: 150,
          description: 'Reparo diverso',
          performedDate: '2026-06-13T00:00:00.000Z',
        },
        adminUser,
      );

      expect(vehicles[0].nextOilChangeKm).toBeNull();
      expect(vehicles[0].nextTireChangeKm).toBeNull();
      expect(vehicles[0].nextReviewKm).toBeNull();
      expect(transaction).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('retorna o histórico com dados do veículo', async () => {
      const { service } = buildService({
        maintenances: [
          buildMaintenance({ id: 'maintenance-1', vehicleId: 'vehicle-1' }),
        ],
      });

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].vehicle).toEqual({
        id: 'vehicle-1',
        plate: 'ABC1D23',
        model: 'Fiat Strada',
        currentKm: new Prisma.Decimal(50000),
      });
    });
  });

  describe('getSchedule', () => {
    it('ordena a agenda por proximidade considerando apenas veículos ativos', async () => {
      const now = new Date();
      const soon = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      const { service } = buildService({
        vehicles: [
          buildVehicle({
            id: 'vehicle-1',
            plate: 'AAA0000',
            currentKm: new Prisma.Decimal(9000),
            nextOilChangeKm: new Prisma.Decimal(10000),
          }),
          buildVehicle({
            id: 'vehicle-2',
            plate: 'BBB0000',
            currentKm: new Prisma.Decimal(5000),
            nextReviewDate: soon,
          }),
        ],
      });

      const schedule = await service.getSchedule();

      expect(schedule).toHaveLength(2);
      expect(schedule[0]).toMatchObject({
        vehicleId: 'vehicle-2',
        category: 'REVISAO_GERAL',
        daysRemaining: 5,
      });
      expect(schedule[1]).toMatchObject({
        vehicleId: 'vehicle-1',
        category: 'TROCA_OLEO',
        kmRemaining: 1000,
      });
    });
  });

  describe('remove', () => {
    it('exclui definitivamente uma manutenção existente', async () => {
      const { service, deleteMaintenance } = buildService({
        maintenances: [buildMaintenance({ id: 'maintenance-1' })],
      });

      await service.remove('maintenance-1');

      expect(deleteMaintenance).toHaveBeenCalledWith({
        where: { id: 'maintenance-1' },
      });
    });

    it('lança 404 ao excluir manutenção inexistente', async () => {
      const { service } = buildService();

      await expect(service.remove('maintenance-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
