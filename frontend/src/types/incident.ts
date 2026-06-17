import type { PaginationQuery } from './pagination';

export type IncidentCategory = 'TRANSITO' | 'SINISTRO' | 'MECANICA' | 'OPERACIONAL' | 'OUTROS';

export type IncidentType = 'MULTA' | 'ACIDENTE' | 'PANE' | 'ATRASO' | 'DANO_VEICULO' | 'OUTROS';

export type IncidentSeverity = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export interface Incident {
  id: string;
  vehicleId: string;
  driverId: string;
  category: IncidentCategory;
  type: IncidentType;
  severity: IncidentSeverity;
  responsible: string;
  cost: string | null;
  observations: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentWithRelations extends Incident {
  vehicle: { id: string; plate: string; model: string; currentKm: string };
  driver: { id: string; name: string };
}

export interface CreateIncidentPayload {
  vehicleId: string;
  driverId?: string;
  category: IncidentCategory;
  type: IncidentType;
  severity: IncidentSeverity;
  responsible: string;
  cost?: number;
  observations: string;
  date: string;
}

export interface IncidentQuery extends PaginationQuery {
  vehicleId?: string;
  driverId?: string;
  category?: IncidentCategory;
  type?: IncidentType;
  severity?: IncidentSeverity;
  from?: string;
  to?: string;
}

export interface IncidentsByDriver {
  driverId: string;
  driverName: string;
  count: number;
  totalCost: number;
}

export interface IncidentsByVehicle {
  vehicleId: string;
  plate: string;
  model: string;
  currentKm: string;
  count: number;
  totalCost: number;
}

export interface VehicleIncidentRate {
  vehicleId: string;
  plate: string;
  model: string;
  currentKm: string;
  incidentCount: number;
  kmDriven: number;
  ratePer1000Km: number | null;
}

export interface IncidentIndicators {
  byDriver: IncidentsByDriver[];
  byVehicle: IncidentsByVehicle[];
  incidentRate: VehicleIncidentRate[];
  fleetRate: {
    incidentCount: number;
    kmDriven: number;
    ratePer1000Km: number | null;
  };
}
