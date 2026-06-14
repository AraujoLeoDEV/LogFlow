export type FuelType = 'GASOLINE' | 'ETHANOL' | 'DIESEL' | 'FLEX' | 'GNV';

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  fuelType: FuelType;
  tankCapacityLiters: string;
  yearModel: number;
  mainRouteId: string | null;
  acquisitionValue: string;
  usefulLifeMonths: number;
  residualValue: string;
  currentKm: string;
  licensingExpiration: string | null;
  insuranceExpiration: string | null;
  active: boolean;
  monthlyDepreciation: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehiclePayload {
  plate: string;
  model: string;
  fuelType: FuelType;
  tankCapacityLiters: number;
  yearModel: number;
  mainRouteId?: string;
  acquisitionValue: number;
  usefulLifeMonths: number;
  residualValue: number;
  currentKm?: number;
  licensingExpiration?: string;
  insuranceExpiration?: string;
  active?: boolean;
}

export type UpdateVehiclePayload = Partial<CreateVehiclePayload>;
