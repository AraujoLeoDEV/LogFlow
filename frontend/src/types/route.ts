export interface RouteStop {
  id: string;
  name: string;
  sequence: number;
}

export interface Route {
  id: string;
  name: string;
  // Legado: só preenchido em rotas antigas, não é mais possível editar.
  estimatedDistanceKm: string | null;
  estimatedDurationMinutes: number | null;
  active: boolean;
  usageCount: number;
  stops: RouteStop[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoutePayload {
  name: string;
  active?: boolean;
  stops?: { name: string }[];
}

export type UpdateRoutePayload = Partial<CreateRoutePayload>;
