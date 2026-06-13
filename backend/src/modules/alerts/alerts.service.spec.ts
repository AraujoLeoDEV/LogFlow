import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertType,
  Prisma,
  Role,
  TripStatus,
} from '../../../generated/prisma/client';
import type { AuthenticatedUser } from '../../common/types/jwt-payload.interface';
import { AlertsMailerService } from './alerts-mailer.service';
import { AlertsService } from './alerts.service';

const adminUser: AuthenticatedUser = {
  sub: 'user-admin',
  email: 'admin@empresa.com',
  role: Role.ADMIN,
};

const coordUser: AuthenticatedUser = {
  sub: 'user-coord',
  email: 'coord@empresa.com',
  role: Role.COORDENACAO,
};

const driverUser: AuthenticatedUser = {
  sub: 'user-driver',
  email: 'driver@empresa.com',
  role: Role.MOTORISTA,
};

function buildAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-1',
    type: AlertType.LICENSING,
    referenceType: 'VEHICLE',
    referenceId: 'vehicle-1',
    message:
      'Licenciamento do veículo ABC1D23 vence em 10 dia(s) (23/06/2026).',
    severity: AlertSeverity.AVISO,
    dueDate: new Date('2026-06-23T00:00:00.000Z'),
    status: AlertStatus.PENDENTE,
    targetRole: Role.COORDENACAO,
    targetUserId: null,
    createdAt: new Date('2026-06-13T06:00:00.000Z'),
    ...overrides,
  };
}

interface BuildServiceOptions {
  vehicles?: unknown[];
  drivers?: unknown[];
  delayedTrips?: unknown[];
  pendingAlerts?: Alert[];
  alerts?: Alert[];
  mailerEnabled?: boolean;
  coordEmails?: string[];
  sendResultByAlertId?: Record<string, boolean>;
}

function buildService(options: BuildServiceOptions = {}) {
  const vehicles = options.vehicles ?? [];
  const drivers = options.drivers ?? [];
  const delayedTrips = options.delayedTrips ?? [];
  const pendingAlerts = options.pendingAlerts ?? [];
  const alerts = options.alerts ?? [];
  const coordEmails = options.coordEmails ?? ['coord@empresa.com'];

  const createManyAlert = jest.fn(() => Promise.resolve({ count: 1 }));
  const findManyAlertPending = jest.fn(() => Promise.resolve(pendingAlerts));
  const updateAlert = jest.fn(
    (args: { where: { id: string }; data: { status: AlertStatus } }) =>
      Promise.resolve(buildAlert({ id: args.where.id, ...args.data })),
  );
  const findFirstAlert = jest.fn(
    (args: { where: { id: string; OR?: Array<Record<string, unknown>> } }) => {
      const alert = alerts.find((item) => item.id === args.where.id);
      if (!alert) {
        return Promise.resolve(null);
      }
      if (!args.where.OR) {
        return Promise.resolve(alert);
      }
      const visible = args.where.OR.some((cond) => {
        if ('targetRole' in cond) {
          return alert.targetRole === cond.targetRole;
        }
        if ('targetUserId' in cond) {
          return alert.targetUserId === cond.targetUserId;
        }
        return false;
      });
      return Promise.resolve(visible ? alert : null);
    },
  );
  const findManyAlertForFindAll = jest.fn(() => Promise.resolve(alerts));

  const findManyVehicle = jest.fn(() => Promise.resolve(vehicles));
  const findManyDriver = jest.fn(() => Promise.resolve(drivers));
  const findManyTrip = jest.fn(() => Promise.resolve(delayedTrips));

  const findManyUser = jest.fn((args: { where: { role: Role } }) => {
    if (args.where.role === Role.COORDENACAO) {
      return Promise.resolve(coordEmails.map((email) => ({ email })));
    }
    return Promise.resolve([]);
  });
  const findFirstUser = jest.fn(() => Promise.resolve(null));

  const prisma = {
    vehicle: { findMany: findManyVehicle },
    driver: { findMany: findManyDriver },
    trip: { findMany: findManyTrip },
    user: { findMany: findManyUser, findFirst: findFirstUser },
    alert: {
      createMany: createManyAlert,
      findMany: jest.fn((args: { where: { status?: AlertStatus } }) => {
        if (args.where?.status === AlertStatus.PENDENTE) {
          return findManyAlertPending();
        }
        return findManyAlertForFindAll();
      }),
      findFirst: findFirstAlert,
      update: updateAlert,
    },
  } as unknown as PrismaService;

  const mailerEnabled = options.mailerEnabled ?? false;
  const sendResultByAlertId = options.sendResultByAlertId ?? {};
  const sendAlertEmail = jest.fn(
    (to: string, _subject: string, message: string) => {
      const alert = pendingAlerts.find((item) => item.message === message);
      const result = alert ? (sendResultByAlertId[alert.id] ?? true) : true;
      return Promise.resolve(result);
    },
  );

  const mailer = {
    isEnabled: jest.fn(() => mailerEnabled),
    sendAlertEmail,
  } as unknown as AlertsMailerService;

  const service = new AlertsService(prisma, mailer);

  return {
    service,
    createManyAlert,
    updateAlert,
    findFirstAlert,
    findManyAlertForFindAll,
    findManyUser,
    sendAlertEmail,
  };
}

function buildVehicleSelect(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vehicle-1',
    plate: 'ABC1D23',
    currentKm: new Prisma.Decimal(9000),
    licensingExpiration: null,
    insuranceExpiration: null,
    nextOilChangeKm: null,
    nextOilChangeDate: null,
    nextTireChangeKm: null,
    nextTireChangeDate: null,
    nextReviewKm: null,
    nextReviewDate: null,
    ...overrides,
  };
}

describe('AlertsService.generateAlerts', () => {
  it('gera e persiste candidatos a partir dos vencimentos dos veículos', async () => {
    const vehicle = buildVehicleSelect({
      licensingExpiration: new Date('2026-06-23T00:00:00.000Z'), // +10 dias
    });
    const { service, createManyAlert } = buildService({
      vehicles: [vehicle],
    });

    const result = await service.generateAlerts();

    expect(result.created).toBe(1);
    expect(result.emailed).toBe(0);
    expect(createManyAlert).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: AlertType.LICENSING,
          referenceType: 'VEHICLE',
          referenceId: 'vehicle-1',
          targetRole: Role.COORDENACAO,
          targetUserId: null,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('não chama createMany quando não há candidatos', async () => {
    const { service, createManyAlert } = buildService();

    const result = await service.generateAlerts();

    expect(result.created).toBe(0);
    expect(createManyAlert).not.toHaveBeenCalled();
  });

  it('não envia e-mails quando ENABLE_EMAIL_ALERTS está desabilitado', async () => {
    const { service, sendAlertEmail } = buildService({
      pendingAlerts: [buildAlert()],
      mailerEnabled: false,
    });

    const result = await service.generateAlerts();

    expect(result.emailed).toBe(0);
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it('envia e-mail para alerta PENDENTE com destinatário e marca como ENVIADO', async () => {
    const pending = buildAlert({
      id: 'alert-coord',
      targetRole: Role.COORDENACAO,
      targetUserId: null,
    });
    const { service, sendAlertEmail, updateAlert } = buildService({
      pendingAlerts: [pending],
      mailerEnabled: true,
      coordEmails: ['coord@empresa.com'],
    });

    const result = await service.generateAlerts();

    expect(sendAlertEmail).toHaveBeenCalledWith(
      'coord@empresa.com',
      expect.stringContaining('Licenciamento'),
      pending.message,
    );
    expect(updateAlert).toHaveBeenCalledWith({
      where: { id: 'alert-coord' },
      data: { status: AlertStatus.ENVIADO },
    });
    expect(result.emailed).toBe(1);
  });

  it('marca como ENVIADO (sem enviar e-mail) quando não há destinatário com e-mail', async () => {
    const pending = buildAlert({
      id: 'alert-no-target',
      targetRole: Role.FINANCEIRO,
      targetUserId: null,
    });
    const { service, sendAlertEmail, updateAlert } = buildService({
      pendingAlerts: [pending],
      mailerEnabled: true,
      coordEmails: ['coord@empresa.com'],
    });

    const result = await service.generateAlerts();

    expect(sendAlertEmail).not.toHaveBeenCalled();
    expect(updateAlert).toHaveBeenCalledWith({
      where: { id: 'alert-no-target' },
      data: { status: AlertStatus.ENVIADO },
    });
    expect(result.emailed).toBe(0);
  });

  it('mantém PENDENTE (para retry) quando o envio do e-mail falha', async () => {
    const pending = buildAlert({
      id: 'alert-fail',
      targetRole: Role.COORDENACAO,
      targetUserId: null,
    });
    const { service, updateAlert } = buildService({
      pendingAlerts: [pending],
      mailerEnabled: true,
      coordEmails: ['coord@empresa.com'],
      sendResultByAlertId: { 'alert-fail': false },
    });

    const result = await service.generateAlerts();

    expect(updateAlert).not.toHaveBeenCalled();
    expect(result.emailed).toBe(0);
  });

  it('gera alerta TRIP_DELAYED para viagens com status ATRASADA', async () => {
    const trip = {
      id: 'trip-1',
      destination: 'Filial - Zona Sul',
      startedAt: new Date('2026-06-12T08:00:00.000Z'),
      status: TripStatus.ATRASADA,
      driver: { name: 'Motorista Teste', userId: 'user-driver' },
      vehicle: { plate: 'ABC1D23' },
      route: { estimatedDurationMinutes: 120 },
    };
    const { service, createManyAlert } = buildService({ delayedTrips: [trip] });

    const result = await service.generateAlerts();

    expect(result.created).toBe(1);
    expect(createManyAlert).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: AlertType.TRIP_DELAYED,
          referenceType: 'TRIP',
          referenceId: 'trip-1',
          severity: AlertSeverity.CRITICO,
          targetRole: Role.COORDENACAO,
          targetUserId: 'user-driver',
        }),
      ],
      skipDuplicates: true,
    });
  });
});

describe('AlertsService.findAll', () => {
  it('ADMIN não recebe filtro de visibilidade adicional', async () => {
    const { service, findManyAlertForFindAll } = buildService({ alerts: [] });

    await service.findAll({}, adminUser);

    expect(findManyAlertForFindAll).toHaveBeenCalled();
  });

  it('COORDENACAO recebe apenas alertas direcionados ao seu role ou a ela', async () => {
    const { service } = buildService({ alerts: [] });

    // Não deve lançar e deve aplicar o filtro de visibilidade sem erro
    await expect(
      service.findAll({ status: AlertStatus.PENDENTE }, coordUser),
    ).resolves.toEqual([]);
  });
});

describe('AlertsService.markAsRead', () => {
  it('lança NotFoundException quando o alerta não existe', async () => {
    const { service } = buildService({ alerts: [] });

    await expect(service.markAsRead('alert-1', driverUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança NotFoundException quando o alerta não é visível ao usuário', async () => {
    const alert = buildAlert({
      id: 'alert-1',
      targetRole: Role.COORDENACAO,
      targetUserId: null,
    });
    const { service } = buildService({ alerts: [alert] });

    await expect(service.markAsRead('alert-1', driverUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('marca o alerta como LIDO quando visível ao usuário (targetUserId)', async () => {
    const alert = buildAlert({
      id: 'alert-1',
      targetRole: null,
      targetUserId: 'user-driver',
    });
    const { service, updateAlert } = buildService({ alerts: [alert] });

    const result = await service.markAsRead('alert-1', driverUser);

    expect(result.status).toBe(AlertStatus.LIDO);
    expect(updateAlert).toHaveBeenCalledWith({
      where: { id: 'alert-1' },
      data: { status: AlertStatus.LIDO },
    });
  });
});
