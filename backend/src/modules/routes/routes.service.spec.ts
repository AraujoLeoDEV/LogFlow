import { ConflictException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Route, RouteStop } from '../../../generated/prisma/client';
import { RoutesService } from './routes.service';

function buildRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: 'route-1',
    name: 'Centro - Filial',
    estimatedDistanceKm: null,
    estimatedDurationMinutes: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildStop(overrides: Partial<RouteStop> = {}): RouteStop {
  return {
    id: 'stop-1',
    routeId: 'route-1',
    name: 'Parada 1',
    sequence: 1,
    createdAt: new Date(),
    ...overrides,
  };
}

function buildService(
  options: {
    routes?: Route[];
    stops?: RouteStop[];
    blockedDeleteIds?: string[];
  } = {},
) {
  const routes = [...(options.routes ?? [])];
  const stops = [...(options.stops ?? [])];
  const blockedDeleteIds = new Set(options.blockedDeleteIds ?? []);

  const withStops = (route: Route) => ({
    ...route,
    stops: stops
      .filter((stop) => stop.routeId === route.id)
      .sort((a, b) => a.sequence - b.sequence),
  });

  const createRoute = jest.fn(
    (args: {
      data: {
        name: string;
        active?: boolean;
        stops?: { create: { name: string; sequence: number }[] };
      };
    }) => {
      const created = buildRoute({
        id: `route-${routes.length + 1}`,
        name: args.data.name,
        active: args.data.active ?? true,
      });
      routes.push(created);

      (args.data.stops?.create ?? []).forEach((stop) => {
        stops.push(
          buildStop({
            id: `stop-${stops.length + 1}`,
            routeId: created.id,
            name: stop.name,
            sequence: stop.sequence,
          }),
        );
      });

      return Promise.resolve(withStops(created));
    },
  );

  const findUniqueRoute = jest.fn((args: { where: { id: string } }) => {
    const found = routes.find((route) => route.id === args.where.id);
    return Promise.resolve(found ? withStops(found) : null);
  });

  const updateRoute = jest.fn(
    (args: {
      where: { id: string };
      data: {
        name?: string;
        active?: boolean;
        stops?: { create: { name: string; sequence: number }[] };
      };
    }) => {
      const index = routes.findIndex((route) => route.id === args.where.id);
      routes[index] = {
        ...routes[index],
        ...(args.data.name !== undefined ? { name: args.data.name } : {}),
        ...(args.data.active !== undefined ? { active: args.data.active } : {}),
      };

      (args.data.stops?.create ?? []).forEach((stop) => {
        stops.push(
          buildStop({
            id: `stop-${stops.length + 1}`,
            routeId: args.where.id,
            name: stop.name,
            sequence: stop.sequence,
          }),
        );
      });

      return Promise.resolve(withStops(routes[index]));
    },
  );

  const deleteManyRouteStop = jest.fn(
    (args: { where: { routeId: string } }) => {
      const remaining = stops.filter(
        (stop) => stop.routeId !== args.where.routeId,
      );
      const removedCount = stops.length - remaining.length;
      stops.length = 0;
      stops.push(...remaining);
      return Promise.resolve({ count: removedCount });
    },
  );

  const deleteRoute = jest.fn((args: { where: { id: string } }) => {
    if (blockedDeleteIds.has(args.where.id)) {
      return Promise.reject(
        new Prisma.PrismaClientKnownRequestError('FK violation', {
          code: 'P2003',
          clientVersion: '7.8.0',
        }),
      );
    }

    const index = routes.findIndex((route) => route.id === args.where.id);
    const [removed] = routes.splice(index, 1);
    return Promise.resolve(removed);
  });

  const prisma = {
    route: {
      create: createRoute,
      findUnique: findUniqueRoute,
      update: updateRoute,
      delete: deleteRoute,
      findMany: jest.fn(() => Promise.resolve(routes.map(withStops))),
    },
    routeStop: {
      deleteMany: deleteManyRouteStop,
    },
    dailyLog: {
      findMany: jest.fn(() => Promise.resolve([])),
    },
    $transaction: jest.fn((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  } as unknown as PrismaService;

  const service = new RoutesService(prisma);

  return { service, routes, stops };
}

describe('RoutesService', () => {
  describe('create', () => {
    it('cria a rota apenas com nome quando não há paradas', async () => {
      const { service } = buildService();

      const created = await service.create({
        name: 'Rota sem paradas',
      });

      expect(created.name).toBe('Rota sem paradas');
      expect(created.stops).toHaveLength(0);
    });

    it('cria as paradas em sequência, na ordem informada', async () => {
      const { service } = buildService();

      const created = await service.create({
        name: 'Rota com paradas',
        stops: [
          { name: 'Depósito' },
          { name: 'Filial Norte' },
          { name: 'Filial Sul' },
        ],
      });

      expect(created.stops.map((stop) => stop.name)).toEqual([
        'Depósito',
        'Filial Norte',
        'Filial Sul',
      ]);
      expect(created.stops.map((stop) => stop.sequence)).toEqual([1, 2, 3]);
    });
  });

  describe('update', () => {
    it('substitui a lista de paradas quando informada', async () => {
      const route = buildRoute();
      const stops = [
        buildStop({ id: 'stop-1', name: 'Antiga 1', sequence: 1 }),
        buildStop({ id: 'stop-2', name: 'Antiga 2', sequence: 2 }),
      ];
      const { service } = buildService({ routes: [route], stops });

      const updated = await service.update(route.id, {
        stops: [{ name: 'Nova única parada' }],
      });

      expect(updated.stops.map((stop) => stop.name)).toEqual([
        'Nova única parada',
      ]);
    });

    it('mantém as paradas existentes quando stops não é informado', async () => {
      const route = buildRoute();
      const stops = [buildStop({ id: 'stop-1', name: 'Mantida', sequence: 1 })];
      const { service } = buildService({ routes: [route], stops });

      const updated = await service.update(route.id, { name: 'Novo nome' });

      expect(updated.name).toBe('Novo nome');
      expect(updated.stops.map((stop) => stop.name)).toEqual(['Mantida']);
    });

    it('lança 404 ao atualizar rota inexistente', async () => {
      const { service } = buildService();

      await expect(
        service.update('rota-inexistente', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removePermanently', () => {
    it('exclui definitivamente a rota quando não há registros vinculados', async () => {
      const route = buildRoute();
      const { service, routes } = buildService({ routes: [route] });

      await service.removePermanently(route.id);

      expect(routes).toHaveLength(0);
    });

    it('lança ConflictException (mensagem amigável) quando há registros vinculados', async () => {
      const route = buildRoute();
      const { service } = buildService({
        routes: [route],
        blockedDeleteIds: [route.id],
      });

      await expect(service.removePermanently(route.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('lança NotFoundException ao excluir rota inexistente', async () => {
      const { service } = buildService();

      await expect(
        service.removePermanently('rota-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
