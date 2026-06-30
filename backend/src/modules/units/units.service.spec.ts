import { ConflictException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Unit } from '../../../generated/prisma/client';
import { UnitsService } from './units.service';

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

function buildService(options: { blockedDeleteIds?: string[] } = {}) {
  const store = new Map<string, Unit>();
  store.set('unit-1', buildUnit());
  const blockedDeleteIds = new Set(options.blockedDeleteIds ?? []);

  const findUniqueMock = jest.fn((args: { where: { id: string } }) =>
    Promise.resolve(store.get(args.where.id) ?? null),
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
    unit: {
      findUnique: findUniqueMock,
      delete: deleteMock,
    },
  } as unknown as PrismaService;

  const service = new UnitsService(prisma);

  return { service, store };
}

describe('UnitsService', () => {
  describe('removePermanently', () => {
    it('exclui definitivamente a unidade quando não há registros vinculados', async () => {
      const { service, store } = buildService();

      await service.removePermanently('unit-1');

      expect(store.has('unit-1')).toBe(false);
    });

    it('lança ConflictException (mensagem amigável) quando há registros vinculados', async () => {
      const { service } = buildService({ blockedDeleteIds: ['unit-1'] });

      await expect(service.removePermanently('unit-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lança NotFoundException ao excluir unidade inexistente', async () => {
      const { service } = buildService();

      await expect(service.removePermanently('unit-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
