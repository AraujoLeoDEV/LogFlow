import 'dotenv/config';
import * as bcrypt from 'bcrypt';

import { PrismaPg } from '@prisma/adapter-pg';

import { FuelType, PrismaClient, Role } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function seedUsers() {
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

  const users: Record<string, { id: string; role: Role }> = {};

  for (const data of usersToSeed) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: data,
    });
    console.log(`Usuário ${user.role} disponível: ${user.email}`);
    users[data.email] = user;
  }

  return users;
}

async function seedUnits() {
  const unitsToSeed = [
    { name: 'Matriz - Centro', address: 'Av. Principal, 1000 - Centro' },
    {
      name: 'Filial - Zona Sul',
      address: 'Rua das Indústrias, 250 - Zona Sul',
    },
  ];

  const units: Record<string, { id: string }> = {};

  for (const data of unitsToSeed) {
    let unit = await prisma.unit.findFirst({ where: { name: data.name } });
    unit ??= await prisma.unit.create({ data });
    units[data.name] = unit;
  }

  return units;
}

async function seedRoutes() {
  const routesToSeed = [
    {
      name: 'Centro - Zona Sul',
      origin: 'Matriz - Centro',
      destination: 'Filial - Zona Sul',
      estimatedDistanceKm: 18.5,
      estimatedDurationMinutes: 45,
    },
    {
      name: 'Centro - Aeroporto',
      origin: 'Matriz - Centro',
      destination: 'Aeroporto',
      estimatedDistanceKm: 32,
      estimatedDurationMinutes: 50,
    },
  ];

  const routes: Record<string, { id: string }> = {};

  for (const data of routesToSeed) {
    let route = await prisma.route.findFirst({ where: { name: data.name } });
    route ??= await prisma.route.create({ data });
    routes[data.name] = route;
  }

  return routes;
}

async function seedVehicles(
  routes: Record<string, { id: string }>,
  adminId: string,
) {
  const vehiclesToSeed = [
    {
      plate: 'ABC1D23',
      fuelType: FuelType.FLEX,
      tankCapacityLiters: 55,
      yearModel: 2022,
      mainRouteId: routes['Centro - Zona Sul'].id,
      acquisitionValue: 95000,
      usefulLifeMonths: 60,
      residualValue: 35000,
      currentKm: 15234.5,
      licensingExpiration: new Date('2027-03-15'),
      insuranceExpiration: new Date('2026-12-01'),
    },
    {
      plate: 'XYZ9876',
      fuelType: FuelType.DIESEL,
      tankCapacityLiters: 120,
      yearModel: 2020,
      mainRouteId: routes['Centro - Aeroporto'].id,
      acquisitionValue: 180000,
      usefulLifeMonths: 96,
      residualValue: 60000,
      currentKm: 84210,
      licensingExpiration: new Date('2026-09-20'),
      insuranceExpiration: new Date('2026-10-10'),
    },
  ];

  const vehicles: Record<string, { id: string }> = {};

  for (const data of vehiclesToSeed) {
    const vehicle = await prisma.vehicle.upsert({
      where: { plate: data.plate },
      update: {},
      create: { ...data, createdBy: adminId, updatedBy: adminId },
    });
    vehicles[data.plate] = vehicle;
  }

  return vehicles;
}

async function seedDrivers(
  vehicles: Record<string, { id: string }>,
  routes: Record<string, { id: string }>,
  motoristaUserId: string,
  adminId: string,
) {
  const driversToSeed = [
    {
      name: 'Motorista Teste',
      position: 'Motorista',
      vehicleId: vehicles['ABC1D23'].id,
      currentKm: 15234.5,
      defaultRouteId: routes['Centro - Zona Sul'].id,
      cnhExpiration: new Date('2028-05-10'),
      userId: motoristaUserId as string | null,
    },
    {
      name: 'Carlos Pereira',
      position: 'Motorista',
      vehicleId: vehicles['XYZ9876'].id,
      currentKm: 84210,
      defaultRouteId: routes['Centro - Aeroporto'].id,
      cnhExpiration: new Date('2027-08-22'),
      userId: null,
    },
  ];

  for (const data of driversToSeed) {
    const existing = await prisma.driver.findFirst({
      where: { name: data.name },
    });
    if (!existing) {
      await prisma.driver.create({
        data: { ...data, createdBy: adminId, updatedBy: adminId },
      });
    }
  }
}

async function main() {
  const users = await seedUsers();
  const units = await seedUnits();
  const routes = await seedRoutes();
  const vehicles = await seedVehicles(routes, users['admin@logflow.com'].id);
  await seedDrivers(
    vehicles,
    routes,
    users['motorista@logflow.com'].id,
    users['admin@logflow.com'].id,
  );

  console.log(`Unidades disponíveis: ${Object.keys(units).join(', ')}`);
  console.log(`Rotas disponíveis: ${Object.keys(routes).join(', ')}`);
  console.log(`Veículos disponíveis: ${Object.keys(vehicles).join(', ')}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
