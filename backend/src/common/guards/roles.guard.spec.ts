import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Role } from '../../../generated/prisma/client';
import { RolesGuard } from './roles.guard';

function createContext(user?: { role: Role }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('permite acesso quando a rota não exige nenhum perfil', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext({ role: Role.MOTORISTA }))).toBe(
      true,
    );
  });

  it('permite acesso quando o perfil do usuário está entre os exigidos', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([Role.ADMIN, Role.COORDENACAO]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext({ role: Role.COORDENACAO }))).toBe(
      true,
    );
  });

  it('nega acesso (ForbiddenException) para perfil não permitido', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([Role.ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(createContext({ role: Role.MOTORISTA })),
    ).toThrow(ForbiddenException);
  });
});
