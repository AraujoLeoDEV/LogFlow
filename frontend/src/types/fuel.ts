import type { PaginationQuery } from './pagination';
import type { FuelType } from './vehicle';

export interface Fuel {
  id: string;
  vehicleId: string;
  driverId: string;
  liters: string;
  amountPaid: string;
  currentKm: string;
  fuelType: FuelType;
  date: string;
  consumptionKmL: string | null;
  costPerKm: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FuelWithRelations extends Fuel {
  vehicle: { id: string; plate: string; model: string; currentKm: string };
  driver: { id: string; name: string };
}

export interface CreateFuelPayload {
  vehicleId: string;
  driverId?: string;
  liters: number;
  amountPaid: number;
  currentKm: number;
  fuelType: FuelType;
  date?: string;
}

export interface UpdateFuelPayload {
  driverId?: string;
  liters?: number;
  amountPaid?: number;
  currentKm?: number;
  fuelType?: FuelType;
  date?: string;
}

export interface FuelQuery extends PaginationQuery {
  vehicleId?: string;
  driverId?: string;
  from?: string;
  to?: string;
}

export interface FuelIndicatorsQuery {
  from?: string;
  to?: string;
}

export interface VehicleFuelIndicator {
  vehicleId: string;
  plate: string;
  model: string;
  currentKm: string;
  avgConsumptionKmL: number | null;
  totalSpent: number;
}

export interface MonthlyFuelSpend {
  month: string;
  total: number;
}

export interface FuelIndicators {
  vehicles: VehicleFuelIndicator[];
  mostEconomical: VehicleFuelIndicator | null;
  mostExpensive: VehicleFuelIndicator | null;
  monthlySpend: MonthlyFuelSpend[];
}
