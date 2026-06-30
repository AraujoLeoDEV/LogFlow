import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Driver,
  Prisma,
  Role,
  Shipment,
  ShipmentFile,
  ShipmentItem,
  ShipmentItemUnit,
  ShipmentPriority,
  ShipmentReceipt,
  ShipmentStatus,
  ShipmentStatusHistory,
  Unit,
  User,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { AlertsMailerService } from '../alerts/alerts-mailer.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { GENERATE_SHIPMENT_PDF_JOB } from './shipment-pdf.constants';
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
    phone: null,
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
    unitId: null,
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
    originUnitId: null,
    destinationUnitId: 'unit-1',
    senderId: 'user-admin',
    transporterId: null,
    shippedAt: new Date('2026-06-10T10:00:00Z'),
    observations: null,
    status: ShipmentStatus.PENDENTE,
    priority: ShipmentPriority.MODERADO,
    createdBy: 'user-admin',
    createdAt: new Date('2026-06-10T10:00:00Z'),
    updatedAt: new Date('2026-06-10T10:00:00Z'),
    ...overrides,
  };
}

function buildShipmentItem(
  overrides: Partial<ShipmentItem> = {},
): ShipmentItem {
  return {
    id: 'item-1',
    shipmentId: 'shipment-1',
    description: 'Caixa de documentos',
    category: null,
    quantity: new Prisma.Decimal(2),
    unit: ShipmentItemUnit.UND,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

interface ShipmentWhere {
  status?: ShipmentStatus | { in: ShipmentStatus[] };
  destinationUnitId?: string;
  createdAt?: { gte?: Date; lte?: Date };
}

interface FindManyShipmentArgs {
  where?: ShipmentWhere;
  skip?: number;
  take?: number;
  orderBy?: { shippedAt?: 'asc' | 'desc' };
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
    items?: ShipmentItem[];
    files?: ShipmentFile[];
    receipts?: ShipmentReceipt[];
    units?: Unit[];
    drivers?: Driver[];
    users?: User[];
    statusHistory?: ShipmentStatusHistory[];
  } = {},
) {
  const shipments = [...(options.shipments ?? [])];
  const items = [...(options.items ?? [])];
  const files = [...(options.files ?? [])];
  const receipts = [...(options.receipts ?? [])];
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
      phone: findUnitById(shipment.destinationUnitId)?.phone ?? null,
    },
    originUnit: shipment.originUnitId
      ? {
          id: shipment.originUnitId,
          name: findUnitById(shipment.originUnitId)?.name ?? 'UNKNOWN',
        }
      : null,
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
    items: items.filter((item) => item.shipmentId === shipment.id),
    files: files.filter((file) => file.shipmentId === shipment.id),
    receipt: (() => {
      const receipt = receipts.find(
        (entry) => entry.shipmentId === shipment.id,
      );
      if (!receipt) return null;
      return {
        ...receipt,
        confirmedByUser: {
          id: receipt.confirmedBy,
          name: findUserById(receipt.confirmedBy)?.name ?? 'UNKNOWN',
        },
      };
    })(),
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

  const findUniqueUser = jest.fn((args: { where: { id: string } }) => {
    const found = findUserById(args.where.id);
    return Promise.resolve(found ? { unitId: found.unitId ?? null } : null);
  });

  let protocolSeq = 0;
  const queryRaw = jest.fn(() => {
    protocolSeq += 1;
    return Promise.resolve([{ lastSeq: protocolSeq }]);
  });

  const createShipment = jest.fn((args: { data: Record<string, unknown> }) => {
    const { items: itemsInput, ...rest } = args.data as Record<
      string,
      unknown
    > & {
      items?: { create: Array<Record<string, unknown>> };
    };

    const created = buildShipment({
      id: `shipment-${shipments.length + 1}`,
      ...rest,
    });
    shipments.push(created);

    (itemsInput?.create ?? []).forEach((itemData) => {
      items.push(
        buildShipmentItem({
          id: `item-${items.length + 1}`,
          shipmentId: created.id,
          ...itemData,
          quantity: new Prisma.Decimal(itemData.quantity as number),
        }),
      );
    });

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

  const createShipmentReceipt = jest.fn(
    (args: { data: Record<string, unknown> }) => {
      const created: ShipmentReceipt = {
        id: `receipt-${receipts.length + 1}`,
        shipmentId: args.data.shipmentId as string,
        confirmedBy: args.data.confirmedBy as string,
        confirmedAt: new Date(),
        notes: (args.data.notes as string | null) ?? null,
        ipAddress: (args.data.ipAddress as string | null) ?? null,
      };
      receipts.push(created);
      return Promise.resolve(created);
    },
  );

  const filterShipments = (where?: ShipmentWhere) => {
    let results = [...shipments];
    where = where ?? {};

    if (where.status) {
      results = results.filter((item) =>
        typeof where?.status === 'object' && where.status !== null
          ? where.status.in.includes(item.status)
          : item.status === where?.status,
      );
    }
    if (where.destinationUnitId) {
      results = results.filter(
        (item) => item.destinationUnitId === where?.destinationUnitId,
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

    return [...results].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  };

  const findManyShipment = jest.fn((args: FindManyShipmentArgs = {}) => {
    let results = filterShipments(args.where);

    if (args.skip !== undefined || args.take !== undefined) {
      const skip = args.skip ?? 0;
      const take = args.take ?? results.length;
      results = results.slice(skip, skip + take);
    }

    return Promise.resolve(results.map(withRelations));
  });

  const countShipment = jest.fn((args: { where?: ShipmentWhere } = {}) =>
    Promise.resolve(filterShipments(args.where).length),
  );

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

    const { items: itemsInput, ...rest } = args.data as Record<
      string,
      unknown
    > & {
      items?: { create: Array<Record<string, unknown>> };
    };

    shipments[index] = { ...shipments[index], ...rest };

    (itemsInput?.create ?? []).forEach((itemData) => {
      items.push(
        buildShipmentItem({
          id: `item-${items.length + 1}`,
          shipmentId: shipments[index].id,
          ...itemData,
          quantity: new Prisma.Decimal(itemData.quantity as number),
        }),
      );
    });

    return Promise.resolve(withRelations(shipments[index]));
  });

  const deleteManyShipmentItem = jest.fn(
    (args: { where: { shipmentId: string } }) => {
      const remaining = items.filter(
        (item) => item.shipmentId !== args.where.shipmentId,
      );
      const removedCount = items.length - remaining.length;
      items.length = 0;
      items.push(...remaining);
      return Promise.resolve({ count: removedCount });
    },
  );

  const deleteShipment = jest.fn((args: { where: { id: string } }) => {
    const index = shipments.findIndex((item) => item.id === args.where.id);
    const [removed] = shipments.splice(index, 1);
    return Promise.resolve(removed);
  });

  const prisma = {
    shipment: {
      create: createShipment,
      findMany: findManyShipment,
      count: countShipment,
      findUnique: findUniqueShipment,
      update: updateShipment,
      delete: deleteShipment,
    },
    shipmentItem: {
      deleteMany: deleteManyShipmentItem,
    },
    shipmentStatusHistory: {
      create: createStatusHistory,
    },
    shipmentReceipt: {
      create: createShipmentReceipt,
    },
    unit: {
      findFirst: findFirstUnit,
    },
    driver: {
      findFirst: findFirstDriver,
    },
    user: {
      findUnique: findUniqueUser,
    },
    $queryRaw: queryRaw,
    $transaction: jest.fn((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  } as unknown as PrismaService;

  const pdfQueue = { add: jest.fn() } as unknown as Queue;
  const mailer = {
    isEnabled: jest.fn().mockReturnValue(false),
    sendAlertEmail: jest.fn().mockResolvedValue(true),
  } as unknown as AlertsMailerService;

  const service = new ShipmentsService(prisma, pdfQueue, mailer);

  return {
    service,
    prisma,
    pdfQueue,
    shipments,
    items,
    files,
    receipts,
    units,
    drivers,
    users,
    statusHistory,
  };
}

const baseCreateDto: CreateShipmentDto = {
  destinationUnitId: 'unit-1',
  items: [
    {
      description: 'Caixa de documentos',
      quantity: 2,
      unit: ShipmentItemUnit.UND,
    },
  ],
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

    it('registra o envio com protocolo AAAAMMDD-SEQ, status PENDENTE, itens estruturados e timeline inicial', async () => {
      const { service, statusHistory } = buildService();

      const created = await service.create(
        {
          ...baseCreateDto,
          items: [
            {
              description: 'Caixa de documentos',
              category: 'Material de escritório',
              quantity: 2,
              unit: ShipmentItemUnit.CX,
              notes: 'Frágil',
            },
          ],
        },
        adminUser,
      );

      expect(created.protocolNumber).toMatch(/^\d{8}-0001$/);
      expect(created.status).toBe(ShipmentStatus.PENDENTE);
      expect(created.senderId).toBe(adminUser.sub);
      expect(created.createdBy).toBe(adminUser.sub);
      expect(created.destinationUnit).toEqual({
        id: 'unit-1',
        name: 'Unidade Central',
        phone: null,
      });

      expect(created.items).toHaveLength(1);
      expect(created.items[0]).toMatchObject({
        description: 'Caixa de documentos',
        category: 'Material de escritório',
        unit: ShipmentItemUnit.CX,
        notes: 'Frágil',
      });
      expect(created.items[0].quantity.toNumber()).toBe(2);

      expect(statusHistory).toHaveLength(1);
      expect(statusHistory[0]).toMatchObject({
        shipmentId: created.id,
        status: ShipmentStatus.PENDENTE,
        changedBy: adminUser.sub,
      });
    });

    it('aceita unidade de origem e data do envio', async () => {
      const { service } = buildService({
        units: [
          buildUnit(),
          buildUnit({ id: 'unit-2', name: 'Unidade Norte' }),
        ],
      });

      const created = await service.create(
        {
          ...baseCreateDto,
          originUnitId: 'unit-2',
          shippedAt: '2026-06-12T08:00:00Z',
        },
        adminUser,
      );

      expect(created.originUnit).toEqual({
        id: 'unit-2',
        name: 'Unidade Norte',
      });
      expect(created.shippedAt.toISOString()).toBe('2026-06-12T08:00:00.000Z');
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

      const byStatus = await service.findAll(
        { status: ShipmentStatus.ENTREGUE },
        adminUser,
      );
      expect(byStatus.data.map((item) => item.id)).toEqual(['shipment-2']);

      const byUnit = await service.findAll(
        { destinationUnitId: 'unit-1' },
        adminUser,
      );
      expect(byUnit.data.map((item) => item.id)).toEqual(['shipment-1']);
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

      const result = await service.findAll(
        { from: '2026-06-05', to: '2026-06-15' },
        adminUser,
      );

      expect(result.data.map((item) => item.id)).toEqual(['shipment-2']);
    });

    it('Conferente só vê envios destinados à sua unidade, ignorando outros filtros', async () => {
      const conferenteUser: AuthenticatedUser = {
        sub: 'user-conferente',
        email: 'conf@logflow.com',
        role: Role.CONFERENTE,
      };

      const { service } = buildService({
        shipments: [
          buildShipment({ id: 'shipment-1', destinationUnitId: 'unit-1' }),
          buildShipment({ id: 'shipment-2', destinationUnitId: 'unit-2' }),
        ],
        units: [
          buildUnit(),
          buildUnit({ id: 'unit-2', name: 'Unidade Norte' }),
        ],
        users: [
          buildUser(),
          buildUser({
            id: 'user-conferente',
            name: 'Conferente Norte',
            email: 'conf@logflow.com',
            role: Role.CONFERENTE,
            unitId: 'unit-2',
          }),
        ],
      });

      const result = await service.findAll(
        { destinationUnitId: 'unit-1' },
        conferenteUser,
      );

      expect(result.data.map((item) => item.id)).toEqual(['shipment-2']);
    });

    it('lança 403 se o Conferente não estiver vinculado a uma unidade', async () => {
      const conferenteUser: AuthenticatedUser = {
        sub: 'user-conferente',
        email: 'conf@logflow.com',
        role: Role.CONFERENTE,
      };

      const { service } = buildService({
        users: [
          buildUser(),
          buildUser({
            id: 'user-conferente',
            name: 'Conferente sem unidade',
            email: 'conf@logflow.com',
            role: Role.CONFERENTE,
            unitId: null,
          }),
        ],
      });

      await expect(service.findAll({}, conferenteUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findMonitoring', () => {
    it('marca como overdue um envio Urgente com 24h+ de espera ainda não confirmado', async () => {
      const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
      const { service } = buildService({
        shipments: [
          buildShipment({
            id: 'shipment-urgente-vencido',
            priority: ShipmentPriority.URGENTE,
            status: ShipmentStatus.EM_TRANSITO,
            shippedAt: thirtyHoursAgo,
          }),
        ],
      });

      const result = await service.findMonitoring();
      const found = result.find((s) => s.id === 'shipment-urgente-vencido');

      expect(found?.overdue).toBe(true);
      expect(found?.hoursWaiting).toBeGreaterThanOrEqual(24);
    });

    it('não marca como overdue um envio Urgente recente (menos de 24h)', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const { service } = buildService({
        shipments: [
          buildShipment({
            id: 'shipment-urgente-recente',
            priority: ShipmentPriority.URGENTE,
            status: ShipmentStatus.PENDENTE,
            shippedAt: twoHoursAgo,
          }),
        ],
      });

      const result = await service.findMonitoring();
      const found = result.find((s) => s.id === 'shipment-urgente-recente');

      expect(found?.overdue).toBe(false);
    });

    it('não inclui envios CONFIRMADO ou CANCELADO, mesmo antigos e Urgentes', async () => {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const { service } = buildService({
        shipments: [
          buildShipment({
            id: 'shipment-confirmado',
            priority: ShipmentPriority.URGENTE,
            status: ShipmentStatus.CONFIRMADO,
            shippedAt: fortyEightHoursAgo,
          }),
          buildShipment({
            id: 'shipment-cancelado',
            priority: ShipmentPriority.URGENTE,
            status: ShipmentStatus.CANCELADO,
            shippedAt: fortyEightHoursAgo,
          }),
        ],
      });

      const result = await service.findMonitoring();

      expect(result).toHaveLength(0);
    });
  });

  describe('findByProtocolNumber', () => {
    it('lança 404 para protocolo inexistente', async () => {
      const { service } = buildService();

      await expect(
        service.findByProtocolNumber('00000000-0000', adminUser),
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
        adminUser,
      );

      expect(result.statusHistory.map((entry) => entry.status)).toEqual([
        ShipmentStatus.PENDENTE,
        ShipmentStatus.EM_TRANSITO,
      ]);
    });

    it('lança 403 quando o Conferente busca um envio de outra unidade', async () => {
      const conferenteUser: AuthenticatedUser = {
        sub: 'user-conferente',
        email: 'conf@logflow.com',
        role: Role.CONFERENTE,
      };

      const shipment = buildShipment({ destinationUnitId: 'unit-1' });
      const { service } = buildService({
        shipments: [shipment],
        users: [
          buildUser(),
          buildUser({
            id: 'user-conferente',
            name: 'Conferente Norte',
            email: 'conf@logflow.com',
            role: Role.CONFERENTE,
            unitId: 'unit-2',
          }),
        ],
      });

      await expect(
        service.findByProtocolNumber(shipment.protocolNumber, conferenteUser),
      ).rejects.toThrow(ForbiddenException);
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

    it('EM_TRANSITO -> ENTREGUE enfileira a geração do PDF de comprovante', async () => {
      const { service, pdfQueue } = buildService({
        shipments: [
          buildShipment({
            status: ShipmentStatus.EM_TRANSITO,
            transporterId: 'driver-1',
          }),
        ],
      });

      const updated = await service.updateStatus(
        'shipment-1',
        { status: ShipmentStatus.ENTREGUE },
        adminUser,
      );

      expect(updated.status).toBe(ShipmentStatus.ENTREGUE);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(pdfQueue.add).toHaveBeenCalledWith(GENERATE_SHIPMENT_PDF_JOB, {
        shipmentId: 'shipment-1',
      });
    });
  });

  describe('confirmReceipt', () => {
    const conferenteUser: AuthenticatedUser = {
      sub: 'user-conferente',
      email: 'conf@logflow.com',
      role: Role.CONFERENTE,
    };

    it('lança 404 para envio inexistente', async () => {
      const { service } = buildService();

      await expect(
        service.confirmReceipt('nonexistent', {}, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança 409 quando o envio já está CONFIRMADO', async () => {
      const { service } = buildService({
        shipments: [buildShipment({ status: ShipmentStatus.CONFIRMADO })],
      });

      await expect(
        service.confirmReceipt('shipment-1', {}, adminUser),
      ).rejects.toThrow(ConflictException);
    });

    it('lança 409 quando o envio está CANCELADO', async () => {
      const { service } = buildService({
        shipments: [buildShipment({ status: ShipmentStatus.CANCELADO })],
      });

      await expect(
        service.confirmReceipt('shipment-1', {}, adminUser),
      ).rejects.toThrow(ConflictException);
    });

    it('lança 403 quando o Conferente não pertence à unidade de destino', async () => {
      const { service } = buildService({
        shipments: [
          buildShipment({
            status: ShipmentStatus.ENTREGUE,
            destinationUnitId: 'unit-1',
          }),
        ],
        users: [
          buildUser(),
          buildUser({
            id: 'user-conferente',
            name: 'Conferente Norte',
            email: 'conf@logflow.com',
            role: Role.CONFERENTE,
            unitId: 'unit-2',
          }),
        ],
      });

      await expect(
        service.confirmReceipt('shipment-1', {}, conferenteUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('confirma o recebimento, cria o ShipmentReceipt e registra CONFIRMADO na timeline', async () => {
      const { service, receipts, statusHistory } = buildService({
        shipments: [
          buildShipment({
            status: ShipmentStatus.ENTREGUE,
            destinationUnitId: 'unit-1',
          }),
        ],
        users: [
          buildUser(),
          buildUser({
            id: 'user-conferente',
            name: 'Conferente Central',
            email: 'conf@logflow.com',
            role: Role.CONFERENTE,
            unitId: 'unit-1',
          }),
        ],
      });

      const updated = await service.confirmReceipt(
        'shipment-1',
        { notes: 'Recebido sem avarias' },
        conferenteUser,
        '127.0.0.1',
      );

      expect(updated.status).toBe(ShipmentStatus.CONFIRMADO);
      expect(updated.receipt).toMatchObject({
        shipmentId: 'shipment-1',
        confirmedBy: 'user-conferente',
        notes: 'Recebido sem avarias',
        ipAddress: '127.0.0.1',
      });

      expect(receipts).toHaveLength(1);
      expect(statusHistory).toHaveLength(1);
      expect(statusHistory[0]).toMatchObject({
        shipmentId: 'shipment-1',
        status: ShipmentStatus.CONFIRMADO,
        changedBy: 'user-conferente',
        notes: 'Recebido sem avarias',
      });
    });

    it('a partir de PENDENTE/EM_TRANSITO, marca como ENTREGUE e confirma o recebimento em uma única ação', async () => {
      const { service, receipts, statusHistory, pdfQueue } = buildService({
        shipments: [
          buildShipment({
            status: ShipmentStatus.PENDENTE,
            destinationUnitId: 'unit-1',
          }),
        ],
        users: [
          buildUser(),
          buildUser({
            id: 'user-conferente',
            name: 'Conferente Central',
            email: 'conf@logflow.com',
            role: Role.CONFERENTE,
            unitId: 'unit-1',
          }),
        ],
      });

      const updated = await service.confirmReceipt(
        'shipment-1',
        { notes: 'Chegou na unidade' },
        conferenteUser,
        '127.0.0.1',
      );

      expect(updated.status).toBe(ShipmentStatus.CONFIRMADO);
      expect(receipts).toHaveLength(1);
      expect(statusHistory).toHaveLength(2);
      expect(statusHistory[0]).toMatchObject({
        shipmentId: 'shipment-1',
        status: ShipmentStatus.ENTREGUE,
        changedBy: 'user-conferente',
      });
      expect(statusHistory[1]).toMatchObject({
        shipmentId: 'shipment-1',
        status: ShipmentStatus.CONFIRMADO,
        changedBy: 'user-conferente',
        notes: 'Chegou na unidade',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(pdfQueue.add).toHaveBeenCalledWith(GENERATE_SHIPMENT_PDF_JOB, {
        shipmentId: 'shipment-1',
      });
    });
  });

  describe('update', () => {
    it('lança 404 para envio inexistente', async () => {
      const { service } = buildService();

      await expect(
        service.update(
          'nonexistent',
          { observations: 'Nova observação' },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança 409 quando o envio está CANCELADO', async () => {
      const { service } = buildService({
        shipments: [buildShipment({ status: ShipmentStatus.CANCELADO })],
      });

      await expect(
        service.update(
          'shipment-1',
          { observations: 'Nova observação' },
          adminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejeita motorista (transportador) inexistente', async () => {
      const { service } = buildService({
        shipments: [buildShipment()],
        items: [buildShipmentItem()],
      });

      await expect(
        service.update('shipment-1', { transporterId: 'driver-x' }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('não altera nada e não cria entrada na timeline quando nenhum campo é informado', async () => {
      const { service, statusHistory } = buildService({
        shipments: [buildShipment()],
        items: [buildShipmentItem()],
      });

      const result = await service.update('shipment-1', {}, adminUser);

      expect(result.observations).toBeNull();
      expect(statusHistory).toHaveLength(0);
    });

    it('atualiza itens, observações e transportador, registrando a edição na timeline com o status atual', async () => {
      const { service, items, statusHistory } = buildService({
        shipments: [buildShipment({ status: ShipmentStatus.EM_TRANSITO })],
        items: [buildShipmentItem()],
      });

      const updated = await service.update(
        'shipment-1',
        {
          items: [
            {
              description: 'Caixa revisada',
              quantity: 3,
              unit: ShipmentItemUnit.CX,
            },
          ],
          observations: 'Corrigido endereço de entrega',
          transporterId: 'driver-1',
        },
        adminUser,
      );

      expect(updated.observations).toBe('Corrigido endereço de entrega');
      expect(updated.transporterId).toBe('driver-1');
      expect(updated.items).toHaveLength(1);
      expect(updated.items[0]).toMatchObject({
        description: 'Caixa revisada',
        unit: ShipmentItemUnit.CX,
      });
      expect(items).toHaveLength(1);

      expect(statusHistory).toHaveLength(1);
      expect(statusHistory[0]).toMatchObject({
        shipmentId: 'shipment-1',
        status: ShipmentStatus.EM_TRANSITO,
        changedBy: adminUser.sub,
        notes: 'Envio editado (itens, observações, transportador).',
      });
    });

    it('permite editar um envio CONFIRMADO e registra a edição na timeline para auditoria', async () => {
      const { service, statusHistory } = buildService({
        shipments: [buildShipment({ status: ShipmentStatus.CONFIRMADO })],
        items: [buildShipmentItem()],
      });

      const updated = await service.update(
        'shipment-1',
        { observations: 'Ajuste pós-confirmação' },
        adminUser,
      );

      expect(updated.status).toBe(ShipmentStatus.CONFIRMADO);
      expect(updated.observations).toBe('Ajuste pós-confirmação');

      expect(statusHistory).toHaveLength(1);
      expect(statusHistory[0]).toMatchObject({
        shipmentId: 'shipment-1',
        status: ShipmentStatus.CONFIRMADO,
        changedBy: adminUser.sub,
        notes: 'Envio editado (observações).',
      });
    });
  });

  describe('remove', () => {
    it('exclui definitivamente um envio existente', async () => {
      const { service, shipments } = buildService({
        shipments: [buildShipment({ id: 'shipment-1' })],
      });

      await service.remove('shipment-1');

      expect(shipments).toHaveLength(0);
    });

    it('lança 404 ao excluir envio inexistente', async () => {
      const { service } = buildService();

      await expect(service.remove('shipment-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
