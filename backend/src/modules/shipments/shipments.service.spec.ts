import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Driver,
  Prisma,
  Role,
  Shipment,
  ShipmentStatus,
  ShipmentStatusHistory,
  Unit,
  User,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ShipmentsService } from './shipments.service';

const adminUser: AuthenticatedUser = {
  sub: 'user-admin',
  email: 'admin@logflow.com',
  role: Role.ADMIN,
};

function buildUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    id: 'unit-1',
    name: 'Unidade Central',
    address: 'Rua A, 100',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-admin',
    name: 'Administrador',
    email: 'admin@logflow.com',
    passwordHash: 'hash',
    role: Role.ADMIN,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function buildDriver(overrides: Partial<Driver> = {}): Driver {
  return {
    id: 'driver-1',
    name: 'Carlos Pereira',
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

function buildShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 'shipment-1',
    protocolNumber: '20260610-0001',
    destinationUnitId: 'unit-1',
    items: [{ description: 'Caixa de documentos', quantity: 2 }],
    senderId: 'user-admin',
    transporterId: null,
    observations: null,
    status: ShipmentStatus.PENDENTE,
    createdBy: 'user-admin',
    createdAt: new Date('2026-06-10T10:00:00Z'),
    updatedAt: new Date('2026-06-10T10:00:00Z'),
    ...overrides,
  };
}

interface FindManyShipmentArgs {
  where?: {
    status?: ShipmentStatus;
    destinationUnitId?: string;
    createdAt?: { gte?: Date; lte?: Date };
  };
}

interface FindUniqueShipmentArgs {
  where: { id?: string; protocolNumber?: string };
  include?: Record<string, unknown>;
}

interface UpdateShipmentArgs {
  where: { id: string };
  data: Record<string, unknown>;
}

function buildService(
  options: {
    shipments?: Shipment[];
    units?: Unit[];
    drivers?: Driver[];
    users?: User[];
    statusHistory?: ShipmentStatusHistory[];
  } = {},
) {
  const shipments = [...(options.shipments ?? [])];
  const units = options.units ?? [buildUnit()];
  const drivers = options.drivers ?? [buildDriver()];
  const users = options.users ?? [buildUser()];
  const statusHistory = [...(options.statusHistory ?? [])];

  const findUnitById = (id: string) => units.find((unit) => unit.id === id);
  const findDriverById = (id: string) =>
    drivers.find((driver) => driver.id === id);
  const findUserById = (id: string) => users.find((user) => user.id === id);

  const withRelations = (shipment: Shipment) => ({
    ...shipment,
    destinationUnit: {
      id: shipment.destinationUnitId,
      name: findUnitById(shipment.destinationUnitId)?.name ?? 'UNKNOWN',
    },
    sender: {
      id: shipment.senderId,
      name: findUserById(shipment.senderId)?.name ?? 'UNKNOWN',
    },
    transporter: shipment.transporterId
      ? {
          id: shipment.transporterId,
          name: findDriverById(shipment.transporterId)?.name ?? 'UNKNOWN',
        }
      : null,
  });

  const findFirstUnit = jest.fn(
    (args: { where: { id: string; active?: boolean } }) => {
      const found = findUnitById(args.where.id);
      if (!found) return Promise.resolve(null);
      if (
        args.where.active !== undefined &&
        found.active !== args.where.active
      ) {
        return Promise.resolve(null);
      }
      return Promise.resolve(found);
    },
  );

  const findFirstDriver = jest.fn(
    (args: { where: { id?: string; deletedAt?: null } }) => {
      const found = drivers.find(
        (driver) => driver.id === args.where.id && driver.deletedAt === null,
      );
      return Promise.resolve(found ?? null);
    },
  );

  let protocolSeq = 0;
  const queryRaw = jest.fn(() => {
    protocolSeq += 1;
    return Promise.resolve([{ lastSeq: protocolSeq }]);
  });

  const createShipment = jest.fn((args: { data: Record<string, unknown> }) => {
    const created = buildShipment({
      id: `shipment-${shipments.length + 1}`,
      ...args.data,
    });
    shipments.push(created);
    return Promise.resolve(withRelations(created));
  });

  const createStatusHistory = jest.fn(
    (args: { data: Record<string, unknown> }) => {
      const created = {
        id: `history-${statusHistory.length + 1}`,
        shipmentId: args.data.shipmentId as string,
        status: args.data.status as ShipmentStatus,
        changedAt: new Date(),
        changedBy: (args.data.changedBy as string | null) ?? null,
        notes: (args.data.notes as string | null) ?? null,
      } satisfies ShipmentStatusHistory;
      statusHistory.push(created);
      return Promise.resolve(created);
    },
  );

  const findManyShipment = jest.fn((args: FindManyShipmentArgs = {}) => {
    let results = [...shipments];
    const where = args.where ?? {};

    if (where.status) {
      results = results.filter((item) => item.status === where.status);
    }
    if (where.destinationUnitId) {
      results = results.filter(
        (item) => item.destinationUnitId === where.destinationUnitId,
      );
    }
    if (where.createdAt?.gte) {
      const gte = where.createdAt.gte;
      results = results.filter((item) => item.createdAt >= gte);
    }
    if (where.createdAt?.lte) {
      const lte = where.createdAt.lte;
      results = results.filter((item) => item.createdAt <= lte);
    }

    return Promise.resolve(
      [...results]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(withRelations),
    );
  });

  const findUniqueShipment = jest.fn((args: FindUniqueShipmentArgs) => {
    const found = shipments.find((item) =>
      args.where.id
        ? item.id === args.where.id
        : item.protocolNumber === args.where.protocolNumber,
    );

    if (!found) {
      return Promise.resolve(null);
    }

    const result = withRelations(found);

    if (args.include && 'statusHistory' in args.include) {
      return Promise.resolve({
        ...result,
        statusHistory: statusHistory
          .filter((entry) => entry.shipmentId === found.id)
          .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime()),
      });
    }

    return Promise.resolve(result);
  });

  const updateShipment = jest.fn((args: UpdateShipmentArgs) => {
    const index = shipments.findIndex((item) => item.id === args.where.id);
    if (index === -1) {
      throw new Error('Shipment não encontrado no mock.');
    }
    shipments[index] = { ...shipments[index], ...args.data };
    return Promise.resolve(withRelations(shipments[index]));
  });

  const prisma = {
    shipment: {
      create: createShipment,
      findMany: findManyShipment,
      findUnique: findUniqueShipment,
      update: updateShipment,
    },
    shipmentStatusHistory: {
      create: createStatusHistory,
    },
    unit: {
      findFirst: findFirstUnit,
    },
    driver: {
      findFirst: findFirstDriver,
    },
    $queryRaw: queryRaw,
    $transaction: jest.fn((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  } as unknown as PrismaService;

  const service = new ShipmentsService(prisma);

  return { service, prisma, shipments, units, drivers, users, statusHistory };
}

const baseCreateDto: CreateShipmentDto = {
  destinationUnitId: 'unit-1',
  items: [{ description: 'Caixa de documentos', quantity: 2 }],
};

describe('ShipmentsService', () => {
  describe('create', () => {
    it('rejeita unidade de destino inexistente', async () => {
      const { service } = buildService({ units: [] });

      await expect(service.create(baseCreateDto, adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejeita motorista (transportador) inexistente', async () => {
      const { service } = buildService();

      await expect(
        service.create(
          { ...baseCreateDto, transporterId: 'driver-x' },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('registra o envio com protocolo AAAAMMDD-SEQ, status PENDENTE e timeline inicial', async () => {
      const { service, statusHistory } = buildService();

      const created = await service.create(baseCreateDto, adminUser);

      expect(created.protocolNumber).toMatch(/^\d{8}-0001$/);
      expect(created.status).toBe(ShipmentStatus.PENDENTE);
      expect(created.senderId).toBe(adminUser.sub);
      expect(created.createdBy).toBe(adminUser.sub);
      expect(created.items).toEqual(baseCreateDto.items);
      expect(created.destinationUnit).toEqual({
        id: 'unit-1',
        name: 'Unidade Central',
      });

      expect(statusHistory).toHaveLength(1);
      expect(statusHistory[0]).toMatchObject({
        shipmentId: created.id,
        status: ShipmentStatus.PENDENTE,
        changedBy: adminUser.sub,
      });
    });

    it('gera protocolos únicos sob criação concorrente', async () => {
      const { service } = buildService();

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          service.create(baseCreateDto, adminUser),
        ),
      );

      const protocolNumbers = results.map((result) => result.protocolNumber);

      expect(new Set(protocolNumbers).size).toBe(5);
      protocolNumbers.forEach((protocolNumber) =>
        expect(protocolNumber).toMatch(/^\d{8}-\d{4}$/),
      );
    });
  });

  describe('findAll', () => {
    it('filtra por status e por unidade de destino', async () => {
      const { service } = buildService({
        shipments: [
          buildShipment({ id: 'shipment-1', status: ShipmentStatus.PENDENTE }),
          buildShipment({
            id: 'shipment-2',
            status: ShipmentStatus.ENTREGUE,
            destinationUnitId: 'unit-2',
          }),
        ],
        units: [
          buildUnit(),
          buildUnit({ id: 'unit-2', name: 'Unidade Norte' }),
        ],
      });

      const byStatus = await service.findAll({
        status: ShipmentStatus.ENTREGUE,
      });
      expect(byStatus.map((item) => item.id)).toEqual(['shipment-2']);

      const byUnit = await service.findAll({ destinationUnitId: 'unit-1' });
      expect(byUnit.map((item) => item.id)).toEqual(['shipment-1']);
    });

    it('filtra por período de criação', async () => {
      const { service } = buildService({
        shipments: [
          buildShipment({
            id: 'shipment-1',
            createdAt: new Date('2026-06-01T10:00:00Z'),
          }),
          buildShipment({
            id: 'shipment-2',
            createdAt: new Date('2026-06-10T10:00:00Z'),
          }),
        ],
      });

      const result = await service.findAll({
        from: '2026-06-05',
        to: '2026-06-15',
      });

      expect(result.map((item) => item.id)).toEqual(['shipment-2']);
    });
  });

  describe('findByProtocolNumber', () => {
    it('lança 404 para protocolo inexistente', async () => {
      const { service } = buildService();

      await expect(
        service.findByProtocolNumber('00000000-0000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna o envio com a timeline ordenada por data', async () => {
      const shipment = buildShipment();
      const { service } = buildService({
        shipments: [shipment],
        statusHistory: [
          {
            id: 'history-2',
            shipmentId: shipment.id,
            status: ShipmentStatus.EM_TRANSITO,
            changedAt: new Date('2026-06-11T10:00:00Z'),
            changedBy: 'user-admin',
            notes: null,
          },
          {
            id: 'history-1',
            shipmentId: shipment.id,
            status: ShipmentStatus.PENDENTE,
            changedAt: new Date('2026-06-10T10:00:00Z'),
            changedBy: 'user-admin',
            notes: null,
          },
        ],
      });

      const result = await service.findByProtocolNumber(
        shipment.protocolNumber,
      );

      expect(result.statusHistory.map((entry) => entry.status)).toEqual([
        ShipmentStatus.PENDENTE,
        ShipmentStatus.EM_TRANSITO,
      ]);
    });
  });

  describe('updateStatus', () => {
    it('lança 404 para envio inexistente', async () => {
      const { service } = buildService();

      await expect(
        service.updateStatus(
          'nonexistent',
          { status: ShipmentStatus.EM_TRANSITO },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança 409 quando o envio já está em status final', async () => {
      const { service } = buildService({
        shipments: [buildShipment({ status: ShipmentStatus.ENTREGUE })],
      });

      await expect(
        service.updateStatus(
          'shipment-1',
          { status: ShipmentStatus.CANCELADO },
          adminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('lança 422 para transição inválida (pular etapas)', async () => {
      const { service } = buildService({
        shipments: [buildShipment({ status: ShipmentStatus.PENDENTE })],
      });

      await expect(
        service.updateStatus(
          'shipment-1',
          { status: ShipmentStatus.ENTREGUE },
          adminUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('PENDENTE -> EM_TRANSITO define o transportador e registra na timeline', async () => {
      const { service, statusHistory } = buildService({
        shipments: [buildShipment({ status: ShipmentStatus.PENDENTE })],
      });

      const updated = await service.updateStatus(
        'shipment-1',
        {
          status: ShipmentStatus.EM_TRANSITO,
          transporterId: 'driver-1',
          notes: 'Saiu para entrega',
        },
        adminUser,
      );

      expect(updated.status).toBe(ShipmentStatus.EM_TRANSITO);
      expect(updated.transporterId).toBe('driver-1');
      expect(updated.transporter).toEqual({
        id: 'driver-1',
        name: 'Carlos Pereira',
      });

      expect(statusHistory).toHaveLength(1);
      expect(statusHistory[0]).toMatchObject({
        shipmentId: 'shipment-1',
        status: ShipmentStatus.EM_TRANSITO,
        changedBy: adminUser.sub,
        notes: 'Saiu para entrega',
      });
    });

    it('EM_TRANSITO -> CANCELADO é uma transição válida', async () => {
      const { service } = buildService({
        shipments: [
          buildShipment({
            status: ShipmentStatus.EM_TRANSITO,
            transporterId: 'driver-1',
          }),
        ],
      });

      const updated = await service.updateStatus(
        'shipment-1',
        { status: ShipmentStatus.CANCELADO },
        adminUser,
      );

      expect(updated.status).toBe(ShipmentStatus.CANCELADO);
    });
  });
});
