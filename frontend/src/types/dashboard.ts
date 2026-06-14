export interface DashboardQuery {
  from?: string;
  to?: string;
}

export interface DriverIndicator {
  driverId: string;
  driverName: string;
  kmTotal: number;
  drivingHours: number;
  incidentCount: number;
  incidentRatePer1000Km: number | null;
  rank: number;
}

export interface VehicleIndicator {
  vehicleId: string;
  plate: string;
  model: string;
  currentKm: string;
  kmTotal: number;
  usageMinutes: number;
  usageCount: number;
  totalCost: number;
  costPerKm: number | null;
}

export interface VehicleIndicators {
  vehicles: VehicleIndicator[];
  mostUsed: VehicleIndicator | null;
  mostExpensive: VehicleIndicator | null;
}

export interface RouteIndicator {
  routeId: string;
  name: string;
  usageCount: number;
  totalKm: number;
  avgDistanceKm: number | null;
  avgDurationMinutes: number | null;
  estimatedCost: number | null;
}
