import { PrismaService } from '../../prisma/prisma.service';
import {
  DailyLog,
  DailyLogStatus,
  Driver,
  Fuel,
  FuelType,
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentType,
  Maintenance,
  MaintenanceCategory,
  MaintenanceType,
  Prisma,
  Route,
  Vehicle,
} from '../../../generated/prisma/client';
import { DashboardService } from './dashboard.service';

function buildDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: 'driver-1',
    name: 'João da Silva',
    position: 'Motorista',
    vehicleId: null,
    currentKm: new Prisma.Decimal(0),
    defaultRouteId: null,
    cnhExpiration: null,
    userId: null,
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

function buildRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: 'route-1',
    name: 'Centro - Filial',
    origin: 'Centro',
    destination: 'Filial',
    estimatedDistanceKm: new Prisma.Decimal(50),
    estimatedDurationMinutes: 90,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
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

function buildIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'incident-1',
    vehicleId: 'vehicle-1',
    driverId: 'driver-1',
    category: IncidentCategory.TRANSITO,
    type: IncidentType.MULTA,
    severity: IncidentSeverity.BAIXA,
    responsible: 'João da Silva',
    cost: new Prisma.Decimal(150),
    observations: 'Multa por excesso de velocidade.',
    date: new Date('2026-06-01T10:00:00Z'),
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
    drivers?: Driver[];
    vehicles?: Vehicle[];
    routes?: Route[];
    dailyLogs?: DailyLog[];
    fuelRecords?: Fuel[];
    maintenances?: Maintenance[];
    incidents?: Incident[];
  } = {},
) {
  const drivers = options.drivers ?? [buildDriver()];
  const vehicles = options.vehicles ?? [buildVehicle()];
  const routes = options.routes ?? [buildRoute()];
  const dailyLogs = options.dailyLogs ?? [];
  const fuelRecords = options.fuelRecords ?? [];
  const maintenances = options.maintenances ?? [];
  const incidents = options.incidents ?? [];

  const prisma = {
    driver: {
      findMany: jest.fn(() =>
        Promise.resolve(drivers.filter((driver) => driver.deletedAt === null)),
      ),
    },
    vehicle: {
      findMany: jest.fn(() =>
        Promise.resolve(
          vehicles.filter((vehicle) => vehicle.deletedAt === null),
        ),
      ),
    },
    route: {
      findMany: jest.fn(() =>
        Promise.resolve(routes.filter((route) => route.active)),
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
    incident: {
      findMany: jest.fn((args: { where?: { date?: DateRangeFilter } }) =>
        Promise.resolve(
          applyDateFilter(incidents, (record) => record.date, args.where?.date),
        ),
      ),
    },
  } as unknown as PrismaService;

  const service = new DashboardService(prisma);

  return { service, prisma };
}

describe('DashboardService', () => {
  describe('getDriverIndicators', () => {
    it('calcula KM total, horas dirigidas, ocorrências e ranking por motorista', async () => {
      const drivers = [
        buildDriver({ id: 'driver-1', name: 'Motorista A' }),
        buildDriver({ id: 'driver-2', name: 'Motorista B' }),
      ];
      const dailyLogs = [
        buildDailyLog({
          driverId: 'driver-1',
          kmDriven: new Prisma.Decimal(100),
          totalDurationMinutes: 120,
        }),
        buildDailyLog({
          driverId: 'driver-2',
          kmDriven: new Prisma.Decimal(300),
          totalDurationMinutes: 180,
        }),
      ];
      const incidents = [
        buildIncident({ driverId: 'driver-1' }),
        buildIncident({ driverId: 'driver-1' }),
      ];

      const { service } = buildService({ drivers, dailyLogs, incidents });

      const result = await service.getDriverIndicators({});

      expect(result).toEqual([
        {
          driverId: 'driver-2',
          driverName: 'Motorista B',
          kmTotal: 300,
          drivingHours: 3,
          incidentCount: 0,
          incidentRatePer1000Km: 0,
          rank: 1,
        },
        {
          driverId: 'driver-1',
          driverName: 'Motorista A',
          kmTotal: 100,
          drivingHours: 2,
          incidentCount: 2,
          incidentRatePer1000Km: 20,
          rank: 2,
        },
      ]);
    });

    it('inclui motoristas sem nenhum registro com valores zerados', async () => {
      const drivers = [buildDriver({ id: 'driver-1', name: 'Sem viagens' })];

      const { service } = buildService({ drivers, dailyLogs: [] });

      const result = await service.getDriverIndicators({});

      expect(result).toEqual([
        {
          driverId: 'driver-1',
          driverName: 'Sem viagens',
          kmTotal: 0,
          drivingHours: 0,
          incidentCount: 0,
          incidentRatePer1000Km: null,
          rank: 1,
        },
      ]);
    });

    it('respeita o filtro de período (from/to)', async () => {
      const drivers = [buildDriver({ id: 'driver-1', name: 'Motorista A' })];
      const dailyLogs = [
        buildDailyLog({
          driverId: 'driver-1',
          departureAt: new Date('2026-05-01T08:00:00Z'),
          kmDriven: new Prisma.Decimal(100),
        }),
        buildDailyLog({
          driverId: 'driver-1',
          departureAt: new Date('2026-06-10T08:00:00Z'),
          kmDriven: new Prisma.Decimal(50),
        }),
      ];

      const { service } = buildService({ drivers, dailyLogs });

      const result = await service.getDriverIndicators({
        from: '2026-06-01',
        to: '2026-06-30',
      });

      expect(result[0].kmTotal).toBe(50);
    });
  });

  describe('getVehicleIndicators', () => {
    it('soma custos de combustível e manutenção e calcula custo/km', async () => {
      const vehicles = [buildVehicle({ id: 'vehicle-1', plate: 'ABC1D23' })];
      const dailyLogs = [
        buildDailyLog({
          vehicleId: 'vehicle-1',
          kmDriven: new Prisma.Decimal(100),
          totalDurationMinutes: 120,
        }),
      ];
      const fuelRecords = [
        buildFuel({
          vehicleId: 'vehicle-1',
          amountPaid: new Prisma.Decimal(200),
        }),
      ];
      const maintenances = [
        buildMaintenance({
          vehicleId: 'vehicle-1',
          cost: new Prisma.Decimal(100),
        }),
      ];

      const { service } = buildService({
        vehicles,
        dailyLogs,
        fuelRecords,
        maintenances,
      });

      const result = await service.getVehicleIndicators({});

      expect(result.vehicles).toEqual([
        {
          vehicleId: 'vehicle-1',
          plate: 'ABC1D23',
          model: 'Fiat Strada',
          currentKm: '50000',
          kmTotal: 100,
          usageMinutes: 120,
          usageCount: 1,
          totalCost: 300,
          costPerKm: 3,
        },
      ]);
      expect(result.mostUsed?.vehicleId).toBe('vehicle-1');
      expect(result.mostExpensive?.vehicleId).toBe('vehicle-1');
    });

    it('retorna mostUsed e mostExpensive nulos quando não há uso/custo', async () => {
      const vehicles = [buildVehicle({ id: 'vehicle-1', plate: 'ABC1D23' })];

      const { service } = buildService({
        vehicles,
        dailyLogs: [],
        fuelRecords: [],
        maintenances: [],
      });

      const result = await service.getVehicleIndicators({});

      expect(result.vehicles[0].costPerKm).toBeNull();
      expect(result.mostUsed).toBeNull();
      expect(result.mostExpensive).toBeNull();
    });

    it('identifica o veículo mais utilizado e o mais caro entre vários', async () => {
      const vehicles = [
        buildVehicle({ id: 'vehicle-1', plate: 'AAA1A11' }),
        buildVehicle({ id: 'vehicle-2', plate: 'BBB2B22' }),
      ];
      const dailyLogs = [
        buildDailyLog({
          vehicleId: 'vehicle-1',
          kmDriven: new Prisma.Decimal(100),
        }),
        buildDailyLog({
          vehicleId: 'vehicle-2',
          kmDriven: new Prisma.Decimal(50),
        }),
        buildDailyLog({
          vehicleId: 'vehicle-2',
          kmDriven: new Prisma.Decimal(50),
        }),
      ];
      const fuelRecords = [
        buildFuel({
          vehicleId: 'vehicle-1',
          amountPaid: new Prisma.Decimal(1000),
        }),
        buildFuel({
          vehicleId: 'vehicle-2',
          amountPaid: new Prisma.Decimal(50),
        }),
      ];

      const { service } = buildService({
        vehicles,
        dailyLogs,
        fuelRecords,
        maintenances: [],
      });

      const result = await service.getVehicleIndicators({});

      expect(result.mostUsed?.vehicleId).toBe('vehicle-2');
      expect(result.mostExpensive?.vehicleId).toBe('vehicle-1');
    });
  });

  describe('getRouteIndicators', () => {
    it('calcula uso, médias e custo estimado por rota com base no custo/km da frota', async () => {
      const routes = [buildRoute({ id: 'route-1', name: 'Centro - Filial' })];
      const vehicles = [buildVehicle({ id: 'vehicle-1', plate: 'ABC1D23' })];
      const dailyLogs = [
        buildDailyLog({
          routeId: 'route-1',
          vehicleId: 'vehicle-1',
          kmDriven: new Prisma.Decimal(100),
          totalDurationMinutes: 120,
        }),
        buildDailyLog({
          routeId: 'route-1',
          vehicleId: 'vehicle-1',
          kmDriven: new Prisma.Decimal(200),
          totalDurationMinutes: 180,
        }),
      ];
      const fuelRecords = [
        buildFuel({
          vehicleId: 'vehicle-1',
          amountPaid: new Prisma.Decimal(300),
        }),
      ];

      const { service } = buildService({
        routes,
        vehicles,
        dailyLogs,
        fuelRecords,
      });

      const result = await service.getRouteIndicators({});

      // fleetKm = 300, fleetCost = 300 -> custo/km = 1
      expect(result).toEqual([
        {
          routeId: 'route-1',
          name: 'Centro - Filial',
          usageCount: 2,
          totalKm: 300,
          avgDistanceKm: 150,
          avgDurationMinutes: 150,
          estimatedCost: 150,
        },
      ]);
    });

    it('retorna estimatedCost null para rotas sem uso e sem custo de frota', async () => {
      const routes = [buildRoute({ id: 'route-1', name: 'Sem uso' })];

      const { service } = buildService({
        routes,
        dailyLogs: [],
        fuelRecords: [],
        maintenances: [],
      });

      const result = await service.getRouteIndicators({});

      expect(result).toEqual([
        {
          routeId: 'route-1',
          name: 'Sem uso',
          usageCount: 0,
          totalKm: 0,
          avgDistanceKm: null,
          avgDurationMinutes: null,
          estimatedCost: null,
        },
      ]);
    });

    it('ordena rotas por quantidade de uso (mais utilizadas primeiro)', async () => {
      const routes = [
        buildRoute({ id: 'route-1', name: 'Rota pouco usada' }),
        buildRoute({ id: 'route-2', name: 'Rota muito usada' }),
      ];
      const dailyLogs = [
        buildDailyLog({ routeId: 'route-1', kmDriven: new Prisma.Decimal(10) }),
        buildDailyLog({ routeId: 'route-2', kmDriven: new Prisma.Decimal(10) }),
        buildDailyLog({ routeId: 'route-2', kmDriven: new Prisma.Decimal(10) }),
      ];

      const { service } = buildService({
        routes,
        dailyLogs,
        fuelRecords: [],
        maintenances: [],
      });

      const result = await service.getRouteIndicators({});

      expect(result.map((route) => route.routeId)).toEqual([
        'route-2',
        'route-1',
      ]);
    });
  });
});
