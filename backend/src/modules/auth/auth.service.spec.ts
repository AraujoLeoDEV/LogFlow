import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PasswordService } from '../../common/utils/password.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../../../generated/prisma/client';
import { AuthService } from './auth.service';

const baseUser = {
  id: 'user-1',
  name: 'Usuário Teste',
  email: 'teste@logflow.com',
  passwordHash: 'hashed',
  role: Role.ADMIN,
  isActive: true,
  failedLoginAttempts: 0,
  lockedUntil: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null as Date | null,
};

interface BuildOptions {
  user?: Partial<typeof baseUser>;
  passwordMatches?: boolean;
  config?: Record<string, unknown>;
}

interface UpdateUserCallArgs {
  where: { id: string };
  data: { failedLoginAttempts: number; lockedUntil: Date | null };
}

function buildService(options: BuildOptions = {}) {
  const user = { ...baseUser, ...options.user };

  const findUniqueMock = jest.fn().mockResolvedValue(user);
  const updateMock = jest
    .fn<Promise<typeof user>, [UpdateUserCallArgs]>()
    .mockResolvedValue(user);
  const verifyPasswordMock = jest
    .fn()
    .mockResolvedValue(options.passwordMatches ?? true);
  const signMock = jest.fn().mockReturnValue('signed-token');
  const verifyTokenMock = jest.fn();

  const prisma = {
    user: {
      findUnique: findUniqueMock,
      update: updateMock,
    },
  } as unknown as PrismaService;

  const jwtService = {
    sign: signMock,
    verify: verifyTokenMock,
  } as unknown as JwtService;

  const passwordService = {
    verify: verifyPasswordMock,
  } as unknown as PasswordService;

  const configValues: Record<string, unknown> = {
    LOGIN_MAX_ATTEMPTS: 3,
    LOGIN_LOCKOUT_MINUTES: 15,
    JWT_SECRET: 'access-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_REFRESH_EXPIRES_IN: '7d',
    ...options.config,
  };

  const config = {
    get: jest.fn(
      (key: string, defaultValue?: unknown) =>
        configValues[key] ?? defaultValue,
    ),
  } as unknown as ConfigService;

  const mailer = {
    isEnabled: jest.fn().mockReturnValue(false),
    sendAlertEmail: jest.fn().mockResolvedValue(true),
  } as unknown as import('../alerts/alerts-mailer.service').AlertsMailerService;

  const service = new AuthService(
    prisma,
    jwtService,
    passwordService,
    config,
    mailer,
  );

  return {
    service,
    user,
    findUniqueMock,
    updateMock,
    verifyPasswordMock,
    signMock,
    verifyTokenMock,
  };
}

describe('AuthService', () => {
  describe('login', () => {
    it('autentica com sucesso e zera tentativas de login anteriores', async () => {
      const { service, updateMock } = buildService({
        user: { failedLoginAttempts: 2 },
      });

      const result = await service.login({
        email: baseUser.email,
        password: 'senha123',
      });

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user.email).toBe(baseUser.email);
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });

    it('rejeita credenciais inválidas e incrementa as tentativas falhas', async () => {
      const { service, updateMock } = buildService({ passwordMatches: false });

      await expect(
        service.login({ email: baseUser.email, password: 'errada' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(updateMock).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { failedLoginAttempts: 1, lockedUntil: null },
      });
    });

    it('bloqueia a conta ao atingir o número máximo de tentativas configurado', async () => {
      const { service, updateMock } = buildService({
        passwordMatches: false,
        user: { failedLoginAttempts: 2 },
      });

      await expect(
        service.login({ email: baseUser.email, password: 'errada' }),
      ).rejects.toThrow(UnauthorizedException);

      const updateCall = updateMock.mock.calls[0][0];
      expect(updateCall.data.failedLoginAttempts).toBe(3);
      expect(updateCall.data.lockedUntil).toBeInstanceOf(Date);
    });

    it('rejeita login enquanto a conta estiver bloqueada', async () => {
      const { service, verifyPasswordMock } = buildService({
        user: { lockedUntil: new Date(Date.now() + 60_000) },
      });

      await expect(
        service.login({ email: baseUser.email, password: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(verifyPasswordMock).not.toHaveBeenCalled();
    });

    it('permite login após o bloqueio expirar', async () => {
      const { service } = buildService({
        user: {
          lockedUntil: new Date(Date.now() - 60_000),
          failedLoginAttempts: 3,
        },
      });

      const result = await service.login({
        email: baseUser.email,
        password: 'senha123',
      });

      expect(result.accessToken).toBe('signed-token');
    });
  });

  describe('refresh', () => {
    it('renova os tokens a partir de um refresh token válido', async () => {
      const { service, verifyTokenMock } = buildService();
      verifyTokenMock.mockReturnValue({
        sub: baseUser.id,
        email: baseUser.email,
        role: baseUser.role,
      });

      const result = await service.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('signed-token');
      expect(verifyTokenMock).toHaveBeenCalledWith('valid-refresh-token', {
        secret: 'refresh-secret',
      });
    });

    it('rejeita um refresh token inválido ou expirado', async () => {
      const { service, verifyTokenMock } = buildService();
      verifyTokenMock.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refresh('token-invalido')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
