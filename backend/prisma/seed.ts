import 'dotenv/config';
import * as bcrypt from 'bcrypt';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient, Role } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
  const adminPasswordHash = await bcrypt.hash(adminPassword, rounds);

  const usersToSeed = [
    {
      name: 'Administrador',
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@logflow.com',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
    {
      name: 'Coordenação',
      email: 'coordenacao@logflow.com',
      passwordHash: await bcrypt.hash('Coord@123', rounds),
      role: Role.COORDENACAO,
    },
    {
      name: 'Motorista Teste',
      email: 'motorista@logflow.com',
      passwordHash: await bcrypt.hash('Motorista@123', rounds),
      role: Role.MOTORISTA,
    },
    {
      name: 'Financeiro',
      email: 'financeiro@logflow.com',
      passwordHash: await bcrypt.hash('Financeiro@123', rounds),
      role: Role.FINANCEIRO,
    },
  ];

  for (const data of usersToSeed) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: data,
    });
    console.log(`Usuário ${user.role} disponível: ${user.email}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
