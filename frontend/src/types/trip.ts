export type TripStatus = 'EM_ANDAMENTO' | 'FINALIZADA' | 'ATRASADA';

export interface Trip {
  id: string;
  vehicleId: string;
  driverId: string;
  routeId: string;
  status: TripStatus;
  destination: string;
  startKm: string;
  endKm: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripWithRelations extends Trip {
  vehicle: { id: string; plate: string; model: string; currentKm: string };
  driver: { id: string; name: string };
  route: { id: string; name: string };
}

export interface CreateTripPayload {
  vehicleId: string;
  driverId?: string;
  routeId?: string;
  destination: string;
  startKm: number;
  startedAt?: string;
}

export interface FinishTripPayload {
  endKm: number;
  finishedAt?: string;
}

export interface TripQuery {
  vehicleId?: string;
  driverId?: string;
  routeId?: string;
  from?: string;
  to?: string;
  status?: TripStatus;
}
