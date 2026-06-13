import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  DailyLog,
  DailyLogStatus,
  Driver,
  FuelType,
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentType,
  Prisma,
  Role,
  Vehicle,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { IncidentsService } from './incidents.service';

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

function buildVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'vehicle-1',
    plate: 'ABC1D23',
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

interface FindFirstVehicleArgs {
  where: { id: string; deletedAt?: Date | null };
}

interface FindFirstDriverArgs {
  where: { id?: string; userId?: string; deletedAt?: Date | null };
}

interface FindManyIncidentArgs {
  where?: {
    vehicleId?: string;
    driverId?: string;
    category?: IncidentCategory;
    type?: IncidentType;
    severity?: IncidentSeverity;
    date?: { gte?: Date; lte?: Date };
  };
}

interface CreateIncidentArgs {
  data: {
    vehicleId: string;
    driverId: string;
    category: IncidentCategory;
    type: IncidentType;
    severity: IncidentSeverity;
    responsible: string;
    cost?: number | null;
    observations: string;
    date: Date;
    createdBy: string;
    updatedBy: string;
  };
}

interface UpdateIncidentArgs {
  where: { id: string };
  data: Record<string, unknown>;
}

interface FindManyDailyLogArgs {
  where: {
    status: DailyLogStatus;
    kmDriven: { not: null };
    departureAt?: { gte?: Date; lte?: Date };
  };
}

function buildService(
  options: {
    incidents?: Incident[];
    vehicles?: Vehicle[];
    drivers?: Driver[];
    dailyLogs?: DailyLog[];
  } = {},
) {
  const incidents = [...(options.incidents ?? [])];
  const vehicles = options.vehicles ?? [buildVehicle()];
  const drivers = options.drivers ?? [buildDriver()];
  const dailyLogs = options.dailyLogs ?? [];

  const findVehicle = (id: string) =>
    vehicles.find((vehicle) => vehicle.id === id);
  const findDriver = (id: string) => drivers.find((driver) => driver.id === id);

  const withRelations = (incident: Incident) => ({
    ...incident,
    vehicle: {
      id: incident.vehicleId,
      plate: findVehicle(incident.vehicleId)?.plate ?? 'UNKNOWN',
    },
    driver: {
      id: incident.driverId,
      name: findDriver(incident.driverId)?.name ?? 'UNKNOWN',
    },
  });

  const findFirstVehicle = jest.fn(
    (args: FindFirstVehicleArgs): Promise<Vehicle | null> => {
      return Promise.resolve(findVehicle(args.where.id) ?? null);
    },
  );

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

  const createIncident = jest.fn((args: CreateIncidentArgs) => {
    const created = buildIncident({
      id: `incident-${incidents.length + 1}`,
      ...args.data,
      cost:
        args.data.cost != null && args.data.cost !== undefined
          ? new Prisma.Decimal(args.data.cost)
          : null,
    });
    incidents.push(created);
    return Promise.resolve(withRelations(created));
  });

  const findManyIncident = jest.fn((args: FindManyIncidentArgs = {}) => {
    let results = [...incidents];
    const where = args.where ?? {};

    if (where.vehicleId) {
      results = results.filter((item) => item.vehicleId === where.vehicleId);
    }
    if (where.driverId) {
      results = results.filter((item) => item.driverId === where.driverId);
    }
    if (where.category) {
      results = results.filter((item) => item.category === where.category);
    }
    if (where.type) {
      results = results.filter((item) => item.type === where.type);
    }
    if (where.severity) {
      results = results.filter((item) => item.severity === where.severity);
    }
    if (where.date?.gte) {
      const gte = where.date.gte;
      results = results.filter((item) => item.date >= gte);
    }
    if (where.date?.lte) {
      const lte = where.date.lte;
      results = results.filter((item) => item.date <= lte);
    }

    return Promise.resolve(
      [...results]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .map(withRelations),
    );
  });

  const findUniqueIncident = jest.fn((args: { where: { id: string } }) => {
    const found = incidents.find((item) => item.id === args.where.id);
    return Promise.resolve(found ? withRelations(found) : null);
  });

  const updateIncident = jest.fn((args: UpdateIncidentArgs) => {
    const index = incidents.findIndex((item) => item.id === args.where.id);
    if (index === -1) {
      throw new Error('Incident não encontrado no mock.');
    }
    incidents[index] = { ...incidents[index], ...args.data };
    return Promise.resolve(withRelations(incidents[index]));
  });

  const deleteIncident = jest.fn((args: { where: { id: string } }) => {
    const index = incidents.findIndex((item) => item.id === args.where.id);
    if (index === -1) {
      throw new Error('Incident não encontrado no mock.');
    }
    const [removed] = incidents.splice(index, 1);
    return Promise.resolve(removed);
  });

  const findManyDailyLog = jest.fn((args: FindManyDailyLogArgs) => {
    let results = [...dailyLogs];

    if (args.where.departureAt?.gte) {
      const gte = args.where.departureAt.gte;
      results = results.filter((log) => log.departureAt >= gte);
    }
    if (args.where.departureAt?.lte) {
      const lte = args.where.departureAt.lte;
      results = results.filter((log) => log.departureAt <= lte);
    }

    return Promise.resolve(
      results.map((log) => ({
        ...log,
        vehicle: {
          id: log.vehicleId,
          plate: findVehicle(log.vehicleId)?.plate ?? 'UNKNOWN',
        },
      })),
    );
  });

  const prisma = {
    incident: {
      create: createIncident,
      findMany: findManyIncident,
      findUnique: findUniqueIncident,
      update: updateIncident,
      delete: deleteIncident,
    },
    vehicle: {
      findFirst: findFirstVehicle,
    },
    driver: {
      findFirst: findFirstDriver,
    },
    dailyLog: {
      findMany: findManyDailyLog,
    },
  } as unknown as PrismaService;

  const service = new IncidentsService(prisma);

  return { service, prisma, incidents, vehicles, drivers, dailyLogs };
}

describe('IncidentsService', () => {
  describe('create', () => {
    it('rejeita veículo inexistente', async () => {
      const { service } = buildService({ vehicles: [] });

      await expect(
        service.create(
          {
            vehicleId: 'vehicle-1',
            driverId: 'driver-1',
            category: IncidentCategory.TRANSITO,
            type: IncidentType.MULTA,
            severity: IncidentSeverity.BAIXA,
            responsible: 'João da Silva',
            observations: 'Multa por excesso de velocidade.',
            date: '2026-06-01T10:00:00Z',
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('exige o motorista quando o usuário não é MOTORISTA', async () => {
      const { service } = buildService();

      await expect(
        service.create(
          {
            vehicleId: 'vehicle-1',
            category: IncidentCategory.TRANSITO,
            type: IncidentType.MULTA,
            severity: IncidentSeverity.BAIXA,
            responsible: 'João da Silva',
            observations: 'Multa por excesso de velocidade.',
            date: '2026-06-01T10:00:00Z',
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita motorista informado inexistente', async () => {
      const { service } = buildService();

      await expect(
        service.create(
          {
            vehicleId: 'vehicle-1',
            driverId: 'driver-inexistente',
            category: IncidentCategory.TRANSITO,
            type: IncidentType.MULTA,
            severity: IncidentSeverity.BAIXA,
            responsible: 'João da Silva',
            observations: 'Multa por excesso de velocidade.',
            date: '2026-06-01T10:00:00Z',
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('MOTORISTA deriva o motorista automaticamente', async () => {
      const { service, incidents } = buildService();

      const created = await service.create(
        {
          vehicleId: 'vehicle-1',
          category: IncidentCategory.MECANICA,
          type: IncidentType.PANE,
          severity: IncidentSeverity.MEDIA,
          responsible: 'João da Silva',
          observations: 'Pane elétrica na estrada.',
          date: '2026-06-01T10:00:00Z',
        },
        motoristaUser,
      );

      expect(created.driverId).toBe('driver-1');
      expect(created.vehicle).toEqual({ id: 'vehicle-1', plate: 'ABC1D23' });
      expect(created.driver).toEqual({ id: 'driver-1', name: 'João da Silva' });
      expect(incidents).toHaveLength(1);
    });

    it('rejeita MOTORISTA sem motorista vinculado', async () => {
      const { service } = buildService({ drivers: [] });

      await expect(
        service.create(
          {
            vehicleId: 'vehicle-1',
            category: IncidentCategory.MECANICA,
            type: IncidentType.PANE,
            severity: IncidentSeverity.MEDIA,
            responsible: 'João da Silva',
            observations: 'Pane elétrica na estrada.',
            date: '2026-06-01T10:00:00Z',
          },
          motoristaUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN registra ocorrência informando o motorista envolvido', async () => {
      const { service } = buildService({
        drivers: [buildDriver({ id: 'driver-2', name: 'Maria Souza' })],
      });

      const created = await service.create(
        {
          vehicleId: 'vehicle-1',
          driverId: 'driver-2',
          category: IncidentCategory.SINISTRO,
          type: IncidentType.ACIDENTE,
          severity: IncidentSeverity.ALTA,
          responsible: 'Maria Souza',
          cost: 1200,
          observations: 'Colisão na rotatória.',
          date: '2026-06-02T10:00:00Z',
        },
        adminUser,
      );

      expect(created.driverId).toBe('driver-2');
      expect(created.cost?.toNumber()).toBe(1200);
    });
  });

  describe('findAll', () => {
    it('MOTORISTA só vê as próprias ocorrências', async () => {
      const { service } = buildService({
        incidents: [
          buildIncident({ id: 'incident-1', driverId: 'driver-1' }),
          buildIncident({ id: 'incident-2', driverId: 'driver-2' }),
        ],
      });

      const result = await service.findAll({}, motoristaUser);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('incident-1');
    });

    it('MOTORISTA sem motorista vinculado recebe lista vazia', async () => {
      const { service } = buildService({
        drivers: [],
        incidents: [buildIncident({ id: 'incident-1' })],
      });

      const result = await service.findAll({}, motoristaUser);

      expect(result).toEqual([]);
    });

    it('filtra pelo veículo informado', async () => {
      const { service } = buildService({
        incidents: [
          buildIncident({ id: 'incident-1', vehicleId: 'vehicle-1' }),
          buildIncident({ id: 'incident-2', vehicleId: 'vehicle-2' }),
        ],
      });

      const result = await service.findAll(
        { vehicleId: 'vehicle-2' },
        adminUser,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('incident-2');
    });
  });

  describe('findOne', () => {
    it('lança NotFoundException quando a ocorrência não existe', async () => {
      const { service } = buildService();

      await expect(service.findOne('incident-x', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('MOTORISTA não pode acessar ocorrência de outro motorista', async () => {
      const { service } = buildService({
        incidents: [buildIncident({ id: 'incident-1', driverId: 'driver-2' })],
      });

      await expect(
        service.findOne('incident-1', motoristaUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('retorna a ocorrência para ADMIN', async () => {
      const { service } = buildService({
        incidents: [buildIncident({ id: 'incident-1' })],
      });

      const result = await service.findOne('incident-1', adminUser);

      expect(result.id).toBe('incident-1');
    });
  });

  describe('update', () => {
    it('lança NotFoundException quando a ocorrência não existe', async () => {
      const { service } = buildService();

      await expect(service.update('incident-x', {}, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejeita veículo inexistente', async () => {
      const { service } = buildService({
        incidents: [buildIncident({ id: 'incident-1' })],
      });

      await expect(
        service.update(
          'incident-1',
          { vehicleId: 'vehicle-inexistente' },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejeita motorista inexistente', async () => {
      const { service } = buildService({
        incidents: [buildIncident({ id: 'incident-1' })],
      });

      await expect(
        service.update(
          'incident-1',
          { driverId: 'driver-inexistente' },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('atualiza campos e converte a data informada', async () => {
      const { service } = buildService({
        incidents: [buildIncident({ id: 'incident-1' })],
      });

      const updated = await service.update(
        'incident-1',
        {
          severity: IncidentSeverity.CRITICA,
          date: '2026-06-10T08:00:00Z',
        },
        adminUser,
      );

      expect(updated.severity).toBe(IncidentSeverity.CRITICA);
      expect(updated.date).toEqual(new Date('2026-06-10T08:00:00Z'));
      expect(updated.updatedBy).toBe('user-admin');
    });
  });

  describe('remove', () => {
    it('lança NotFoundException quando a ocorrência não existe', async () => {
      const { service } = buildService();

      await expect(service.remove('incident-x')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('remove a ocorrência existente', async () => {
      const { service, incidents } = buildService({
        incidents: [buildIncident({ id: 'incident-1' })],
      });

      await service.remove('incident-1');

      expect(incidents).toHaveLength(0);
    });
  });

  describe('getIndicators', () => {
    it('agrega ocorrências por motorista, por veículo e calcula o índice ocorrências/KM', async () => {
      const { service } = buildService({
        vehicles: [
          buildVehicle({ id: 'vehicle-1', plate: 'ABC1D23' }),
          buildVehicle({ id: 'vehicle-2', plate: 'XYZ9876' }),
        ],
        drivers: [
          buildDriver({ id: 'driver-1', name: 'João da Silva' }),
          buildDriver({ id: 'driver-2', name: 'Maria Souza' }),
        ],
        incidents: [
          buildIncident({
            id: 'incident-1',
            vehicleId: 'vehicle-1',
            driverId: 'driver-1',
            cost: new Prisma.Decimal(100),
            date: new Date('2026-06-05T10:00:00Z'),
          }),
          buildIncident({
            id: 'incident-2',
            vehicleId: 'vehicle-1',
            driverId: 'driver-1',
            cost: new Prisma.Decimal(50),
            date: new Date('2026-06-10T10:00:00Z'),
          }),
          buildIncident({
            id: 'incident-3',
            vehicleId: 'vehicle-2',
            driverId: 'driver-2',
            cost: null,
            date: new Date('2026-06-15T10:00:00Z'),
          }),
        ],
        dailyLogs: [
          buildDailyLog({
            id: 'log-1',
            vehicleId: 'vehicle-1',
            kmDriven: new Prisma.Decimal(1000),
            departureAt: new Date('2026-06-04T08:00:00Z'),
          }),
        ],
      });

      const indicators = await service.getIndicators({});

      const driver1 = indicators.byDriver.find(
        (item) => item.driverId === 'driver-1',
      );
      const driver2 = indicators.byDriver.find(
        (item) => item.driverId === 'driver-2',
      );
      expect(driver1).toEqual({
        driverId: 'driver-1',
        driverName: 'João da Silva',
        count: 2,
        totalCost: 150,
      });
      expect(driver2).toEqual({
        driverId: 'driver-2',
        driverName: 'Maria Souza',
        count: 1,
        totalCost: 0,
      });

      const vehicle1 = indicators.byVehicle.find(
        (item) => item.vehicleId === 'vehicle-1',
      );
      const vehicle2 = indicators.byVehicle.find(
        (item) => item.vehicleId === 'vehicle-2',
      );
      expect(vehicle1).toEqual({
        vehicleId: 'vehicle-1',
        plate: 'ABC1D23',
        count: 2,
        totalCost: 150,
      });
      expect(vehicle2).toEqual({
        vehicleId: 'vehicle-2',
        plate: 'XYZ9876',
        count: 1,
        totalCost: 0,
      });

      const rateVehicle1 = indicators.incidentRate.find(
        (item) => item.vehicleId === 'vehicle-1',
      );
      const rateVehicle2 = indicators.incidentRate.find(
        (item) => item.vehicleId === 'vehicle-2',
      );
      expect(rateVehicle1).toEqual({
        vehicleId: 'vehicle-1',
        plate: 'ABC1D23',
        incidentCount: 2,
        kmDriven: 1000,
        ratePer1000Km: 2,
      });
      // vehicle-2 não teve KM rodado no período (divisão por zero -> null)
      expect(rateVehicle2).toEqual({
        vehicleId: 'vehicle-2',
        plate: 'XYZ9876',
        incidentCount: 1,
        kmDriven: 0,
        ratePer1000Km: null,
      });

      expect(indicators.fleetRate).toEqual({
        incidentCount: 3,
        kmDriven: 1000,
        ratePer1000Km: 3,
      });
    });

    it('filtra ocorrências e KM rodado pelo período informado', async () => {
      const { service } = buildService({
        incidents: [
          buildIncident({
            id: 'incident-1',
            date: new Date('2026-05-01T10:00:00Z'),
          }),
          buildIncident({
            id: 'incident-2',
            date: new Date('2026-06-05T10:00:00Z'),
          }),
        ],
        dailyLogs: [
          buildDailyLog({
            id: 'log-1',
            kmDriven: new Prisma.Decimal(500),
            departureAt: new Date('2026-05-02T08:00:00Z'),
          }),
          buildDailyLog({
            id: 'log-2',
            kmDriven: new Prisma.Decimal(1000),
            departureAt: new Date('2026-06-04T08:00:00Z'),
          }),
        ],
      });

      const indicators = await service.getIndicators({
        from: '2026-06-01T00:00:00Z',
        to: '2026-06-30T23:59:59Z',
      });

      expect(indicators.fleetRate.incidentCount).toBe(1);
      expect(indicators.fleetRate.kmDriven).toBe(1000);
    });
  });
});
