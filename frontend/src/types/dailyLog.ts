import type { PaginationQuery } from './pagination';

export type DailyLogStatus = 'EM_ANDAMENTO' | 'FINALIZADO' | 'ATRASADO';

export interface DailyLog {
  id: string;
  vehicleId: string;
  driverId: string;
  routeId: string;
  departureAt: string;
  returnAt: string | null;
  startKm: string;
  endKm: string | null;
  kmDriven: string | null;
  totalDurationMinutes: number | null;
  avgSpeedKmh: string | null;
  destination: string | null;
  observations: string | null;
  status: DailyLogStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLogWithRelations extends DailyLog {
  vehicle: { id: string; plate: string; model: string; currentKm: string };
  driver: { id: string; name: string };
  route: { id: string; name: string };
}

export interface CreateDailyLogPayload {
  vehicleId: string;
  driverId?: string;
  routeId?: string;
  departureAt?: string;
  startKm: number;
  destination?: string;
  observations?: string;
}

export interface UpdateDailyLogPayload {
  vehicleId?: string;
  driverId?: string;
  routeId?: string;
  departureAt?: string;
  returnAt?: string;
  startKm?: number;
  endKm?: number;
  destination?: string;
  observations?: string;
}

export interface ReturnDailyLogPayload {
  returnAt?: string;
  endKm: number;
  observations?: string;
}

export interface DailyLogQuery extends PaginationQuery {
  vehicleId?: string;
  driverId?: string;
  routeId?: string;
  from?: string;
  to?: string;
  status?: DailyLogStatus;
}
