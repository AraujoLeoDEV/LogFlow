import { PrismaService } from '../../prisma/prisma.service';
import {
  DailyLog,
  DailyLogStatus,
  Fuel,
  FuelType,
  Maintenance,
  MaintenanceCategory,
  MaintenanceType,
  Prisma,
  Vehicle,
} from '../../../generated/prisma/client';
import { FinanceService } from './finance.service';

function buildVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'vehicle-1',
    plate: 'ABC1D23',
    fuelType: FuelType.FLEX,
    tankCapacityLiters: new Prisma.Decimal(50),
    yearModel: 2020,
    mainRouteId: null,
    acquisitionValue: new Prisma.Decimal(120000),
    usefulLifeMonths: 60,
    residualValue: new Prisma.Decimal(60000),
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
    createdAt: new Date('2026-06-01T10:00:00Z'),
    updatedAt: new Date('2026-06-01T10:00:00Z'),
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
    cost: new Prisma.Decimal(100),
    description: 'Manutenção de teste',
    scheduledDate: null,
    scheduledKm: null,
    performedDate: null,
    createdBy: 'user-admin',
    updatedBy: 'user-admin',
    createdAt: new Date('2026-06-01T10:00:00Z'),
    updatedAt: new Date('2026-06-01T10:00:00Z'),
    ...overrides,
  };
}

function buildDailyLog(overrides: Partial<DailyLog> = {}): DailyLog {
  return {
    id: 'daily-log-1',
    vehicleId: 'vehicle-1',
    driverId: 'driver-1',
    routeId: 'route-1',
    departureAt: new Date('2026-06-01T08:00:00Z'),
    returnAt: new Date('2026-06-01T12:00:00Z'),
    startKm: new Prisma.Decimal(1000),
    endKm: new Prisma.Decimal(1100),
    kmDriven: new Prisma.Decimal(100),
    totalDurationMinutes: 240,
    avgSpeedKmh: new Prisma.Decimal(25),
    observations: null,
    status: DailyLogStatus.FINALIZADO,
    createdBy: 'user-admin',
    updatedBy: 'user-admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface DateRangeFilter {
  gte?: Date;
  lte?: Date;
}

function applyDateFilter<T>(
  items: T[],
  getDate: (item: T) => Date,
  filter?: DateRangeFilter,
): T[] {
  if (!filter) {
    return items;
  }

  return items.filter((item) => {
    const date = getDate(item);
    if (filter.gte && date < filter.gte) return false;
    if (filter.lte && date > filter.lte) return false;
    return true;
  });
}

function buildService(
  options: {
    vehicles?: Vehicle[];
    fuelRecords?: Fuel[];
    maintenances?: Maintenance[];
    dailyLogs?: DailyLog[];
  } = {},
) {
  const vehicles = options.vehicles ?? [buildVehicle()];
  const fuelRecords = options.fuelRecords ?? [];
  const maintenances = options.maintenances ?? [];
  const dailyLogs = options.dailyLogs ?? [];

  const prisma = {
    vehicle: {
      findMany: jest.fn(() =>
        Promise.resolve(
          vehicles.filter((vehicle) => vehicle.deletedAt === null),
        ),
      ),
    },
    fuel: {
      findMany: jest.fn((args: { where?: { date?: DateRangeFilter } }) =>
        Promise.resolve(
          applyDateFilter(
            fuelRecords,
            (record) => record.date,
            args.where?.date,
          ),
        ),
      ),
    },
    maintenance: {
      findMany: jest.fn((args: { where?: { createdAt?: DateRangeFilter } }) =>
        Promise.resolve(
          applyDateFilter(
            maintenances,
            (record) => record.createdAt,
            args.where?.createdAt,
          ),
        ),
      ),
    },
    dailyLog: {
      findMany: jest.fn((args: { where: { departureAt?: DateRangeFilter } }) =>
        Promise.resolve(
          applyDateFilter(
            dailyLogs.filter((log) => log.status === DailyLogStatus.FINALIZADO),
            (log) => log.departureAt,
            args.where.departureAt,
          ),
        ),
      ),
    },
  } as unknown as PrismaService;

  const service = new FinanceService(prisma);

  return { service, prisma };
}

describe('FinanceService', () => {
  describe('getMonthlySummary', () => {
    it('soma combustível, manutenção e depreciação mensal da frota', async () => {
      const vehicles = [buildVehicle()]; // depreciação = (120000 - 60000) / 60 = 1000
      const fuelRecords = [
        buildFuel({
          amountPaid: new Prisma.Decimal(300),
          date: new Date('2026-06-05T10:00:00Z'),
        }),
      ];
      const maintenances = [
        buildMaintenance({
          cost: new Prisma.Decimal(200),
          createdAt: new Date('2026-06-10T10:00:00Z'),
        }),
      ];

      const { service } = buildService({ vehicles, fuelRecords, maintenances });

      const result = await service.getMonthlySummary({
        from: '2026-06-01',
        to: '2026-06-30',
      });

      expect(result).toEqual([
        {
          month: '2026-06',
          fuelCost: 300,
          maintenanceCost: 200,
          depreciation: 1000,
          total: 1500,
        },
      ]);
    });

    it('retorna um item por mês do período, mesmo sem registros', async () => {
      const vehicles = [buildVehicle()];

      const { service } = buildService({
        vehicles,
        fuelRecords: [],
        maintenances: [],
      });

      const result = await service.getMonthlySummary({
        from: '2026-04-01',
        to: '2026-06-30',
      });

      expect(result.map((entry) => entry.month)).toEqual([
        '2026-04',
        '2026-05',
        '2026-06',
      ]);
      result.forEach((entry) => {
        expect(entry.fuelCost).toBe(0);
        expect(entry.maintenanceCost).toBe(0);
        expect(entry.depreciation).toBe(1000);
        expect(entry.total).toBe(1000);
      });
    });
  });

  describe('getCostPerKm', () => {
    it('calcula o custo por km considerando combustível, manutenção e depreciação do período', async () => {
      const vehicles = [buildVehicle()]; // depreciação mensal = 1000
      const fuelRecords = [
        buildFuel({
          amountPaid: new Prisma.Decimal(300),
          date: new Date('2026-06-05T10:00:00Z'),
        }),
      ];
      const maintenances = [
        buildMaintenance({
          cost: new Prisma.Decimal(200),
          createdAt: new Date('2026-06-10T10:00:00Z'),
        }),
      ];
      const dailyLogs = [
        buildDailyLog({
          kmDriven: new Prisma.Decimal(500),
          departureAt: new Date('2026-06-15T08:00:00Z'),
        }),
      ];

      const { service } = buildService({
        vehicles,
        fuelRecords,
        maintenances,
        dailyLogs,
      });

      const result = await service.getCostPerKm({
        from: '2026-06-01',
        to: '2026-06-30',
      });

      // total = 300 (combustível) + 200 (manutenção) + 1000 (depreciação de 1 mês) = 1500
      // custo/km = 1500 / 500 = 3
      expect(result).toEqual({ totalCost: 1500, kmTotal: 500, costPerKm: 3 });
    });

    it('retorna costPerKm null quando não há km rodado no período (sem divisão por zero)', async () => {
      const vehicles = [buildVehicle()];
      const fuelRecords = [
        buildFuel({
          amountPaid: new Prisma.Decimal(300),
          date: new Date('2026-06-05T10:00:00Z'),
        }),
      ];

      const { service } = buildService({
        vehicles,
        fuelRecords,
        dailyLogs: [],
      });

      const result = await service.getCostPerKm({
        from: '2026-06-01',
        to: '2026-06-30',
      });

      expect(result.kmTotal).toBe(0);
      expect(result.costPerKm).toBeNull();
    });
  });

  describe('getMonthlyComparison', () => {
    it('calcula a variação percentual do custo total em relação ao mês anterior', async () => {
      const vehicles = [buildVehicle()]; // depreciação = 1000/mês
      const fuelRecords = [
        buildFuel({
          amountPaid: new Prisma.Decimal(500),
          date: new Date('2026-05-10T10:00:00Z'),
        }),
        buildFuel({
          amountPaid: new Prisma.Decimal(1000),
          date: new Date('2026-06-10T10:00:00Z'),
        }),
      ];

      const { service } = buildService({
        vehicles,
        fuelRecords,
        maintenances: [],
      });

      const result = await service.getMonthlyComparison({
        from: '2026-05-01',
        to: '2026-06-30',
      });

      // mês 1 (2026-05): total = 500 + 1000 = 1500, sem mês anterior -> variation null
      // mês 2 (2026-06): total = 1000 + 1000 = 2000, variação = (2000-1500)/1500*100
      expect(result).toEqual([
        {
          month: '2026-05',
          fuelCost: 500,
          maintenanceCost: 0,
          depreciation: 1000,
          total: 1500,
          variation: null,
        },
        {
          month: '2026-06',
          fuelCost: 1000,
          maintenanceCost: 0,
          depreciation: 1000,
          total: 2000,
          variation: (500 / 1500) * 100,
        },
      ]);
    });

    it('considera os últimos 6 meses quando nenhum período é informado', async () => {
      const vehicles = [buildVehicle()];

      const { service } = buildService({
        vehicles,
        fuelRecords: [],
        maintenances: [],
      });

      const result = await service.getMonthlyComparison({});

      expect(result).toHaveLength(6);
    });
  });
});
