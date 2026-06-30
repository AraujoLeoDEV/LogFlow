import { ConflictException, NotFoundException } from '@nestjs/common';

import { PasswordService } from '../../common/utils/password.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Role, User } from '../../../generated/prisma/client';
import { UsersService } from './users.service';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
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

function buildService(options: { blockedDeleteIds?: string[] } = {}) {
  const store = new Map<string, User>();
  store.set('user-1', buildUser());
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
    user: {
      findFirst: findFirstMock,
      delete: deleteMock,
    },
  } as unknown as PrismaService;

  const passwordService = {} as PasswordService;
  const service = new UsersService(prisma, passwordService);

  return { service, store };
}

describe('UsersService', () => {
  describe('removePermanently', () => {
    it('exclui definitivamente o usuário quando não há registros vinculados', async () => {
      const { service, store } = buildService();

      await service.removePermanently('user-1');

      expect(store.has('user-1')).toBe(false);
    });

    it('lança ConflictException (mensagem amigável) quando há registros vinculados', async () => {
      const { service } = buildService({ blockedDeleteIds: ['user-1'] });

      await expect(service.removePermanently('user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lança NotFoundException ao excluir usuário inexistente', async () => {
      const { service } = buildService();

      await expect(service.removePermanently('user-x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
