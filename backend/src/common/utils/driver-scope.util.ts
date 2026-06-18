import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { Driver, Role } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../types/jwt-payload.interface';

// Busca o Driver vinculado ao usuário autenticado (relação User -> Driver
// via userId), usado por daily-logs/fuel/incidents para restringir
// listagens/criação ao motorista logado.
export function findOwnDriver(
  prisma: PrismaService,
  user: AuthenticatedUser,
): Promise<Driver | null> {
  return prisma.driver.findFirst({
    where: { userId: user.sub, deletedAt: null },
  });
}

// Resolve o motorista de um registro a ser criado: se o usuário é
// MOTORISTA, força o próprio vínculo (403 se não houver Driver associado
// ao usuário); senão, exige `dtoDriverId` explícito e valida que existe
// (400 em ambos os casos de ausência/inexistência).
export async function resolveDriverForCreate(
  prisma: PrismaService,
  user: AuthenticatedUser,
  dtoDriverId: string | null | undefined,
  missingDriverMessage: string,
): Promise<Driver> {
  if (user.role === Role.MOTORISTA) {
    const driver = await findOwnDriver(prisma, user);

    if (!driver) {
      throw new ForbiddenException(
        'Usuário autenticado não está vinculado a um motorista.',
      );
    }

    return driver;
  }

  if (!dtoDriverId) {
    throw new BadRequestException(missingDriverMessage);
  }

  const driver = await prisma.driver.findFirst({
    where: { id: dtoDriverId, deletedAt: null },
  });

  if (!driver) {
    throw new BadRequestException('Motorista informado não existe.');
  }

  return driver;
}
