export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  estimatedDistanceKm: string;
  estimatedDurationMinutes: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoutePayload {
  name: string;
  origin: string;
  destination: string;
  estimatedDistanceKm: number;
  estimatedDurationMinutes: number;
  active?: boolean;
}

export type UpdateRoutePayload = Partial<CreateRoutePayload>;
