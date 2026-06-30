import { ConflictException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { Driver, Prisma } from '../../../generated/prisma/client';
import { DriversService } from './drivers.service';

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

function buildService(options: { blockedDeleteIds?: string[] } = {}) {
  const store = new Map<string, Driver>();
  store.set('driver-1', buildDriver());
  const blockedDeleteIds = new Set(options.blockedDeleteIds ?? []);

  const findFirstMock = jest.fn(
    (args: { where: { id: string; deletedAt?: Date | null } }) => {
      const found = store.get(args.where.id);
      if (
        !found ||
        (args.where.deletedAt === null && found.deletedAt !== null)
      ) {
        return Promise.resolve(null);
      }
      return Promise.resolve(found);
    },
  );

  const deleteMock = jest.fn((args: { where: { id: string } }) => {
    if (blockedDeleteIds.has(args.where.id)) {
      return Promise.reject(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: '7.8.0',
        }),
      );
    }

    store.delete(args.where.id);
    return Promise.resolve(undefined);
  });

  const prisma = {
    driver: {
      findFirst: findFirstMock,
      delete: deleteMock,
    },
  } as unknown as PrismaService;

  const service = new DriversService(prisma);

  return { service, store };
}

describe('DriversService', () => {
  describe('removePermanently', () => {
    it('exclui definitivamente o motorista quando não há registros vinculados', async () => {
      const { service, store } = buildService();

      await service.removePermanently('driver-1');

      expect(store.has('driver-1')).toBe(false);
    });

    it('lança ConflictException (mensagem amigável) quando há registros vinculados', async () => {
      const { service } = buildService({ blockedDeleteIds: ['driver-1'] });

      await expect(service.removePermanently('driver-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lança NotFoundException ao excluir motorista inexistente', async () => {
      const { service } = buildService();

      await expect(service.removePermanently('driver-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
