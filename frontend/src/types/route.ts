export interface Route {
  id: string;
  name: string;
  estimatedDistanceKm: string;
  estimatedDurationMinutes: number;
  active: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoutePayload {
  name: string;
  estimatedDistanceKm: number;
  estimatedDurationMinutes: number;
  active?: boolean;
}

export type UpdateRoutePayload = Partial<CreateRoutePayload>;
