import 'dotenv/config';
import * as bcrypt from 'bcrypt';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient, Role } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Apaga todos os registros de teste (em ordem que respeita as FKs) e cadastra
// o super admin de produção, mantendo o schema/migrations intactos.
async function main() {
  await prisma.$transaction([
    prisma.shipmentReceipt.deleteMany(),
    prisma.shipmentFile.deleteMany(),
    prisma.shipmentItem.deleteMany(),
    prisma.shipmentStatusHistory.deleteMany(),
    prisma.shipment.deleteMany(),
    prisma.goal.deleteMany(),
    prisma.incident.deleteMany(),
    prisma.maintenance.deleteMany(),
    prisma.fuel.deleteMany(),
    prisma.dailyLog.deleteMany(),
    prisma.alert.deleteMany(),
    prisma.report.deleteMany(),
    prisma.protocolCounter.deleteMany(),
    prisma.driver.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.route.deleteMany(),
    prisma.user.deleteMany(),
    prisma.unit.deleteMany(),
  ]);

  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
  const email = 'admlogflow@labocliv.com.br';
  const passwordHash = await bcrypt.hash('Adm@2026', rounds);

  const admin = await prisma.user.create({
    data: {
      name: 'Super Administrador',
      email,
      passwordHash,
      role: Role.ADMIN,
    },
  });

  console.log(`Banco limpo. Super admin criado: ${admin.email} (${admin.id})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
