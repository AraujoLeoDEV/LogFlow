export interface Driver {
  id: string;
  name: string;
  position: string;
  vehicleId: string | null;
  currentKm: string;
  defaultRouteId: string | null;
  cnhExpiration: string | null;
  userId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDriverPayload {
  name: string;
  position: string;
  vehicleId?: string;
  currentKm?: number;
  defaultRouteId?: string;
  cnhExpiration?: string;
  userId?: string;
  active?: boolean;
}

export type UpdateDriverPayload = Partial<CreateDriverPayload>;

export interface DriverHistory {
  trips: unknown[];
  fuelRecords: unknown[];
  incidents: unknown[];
}
