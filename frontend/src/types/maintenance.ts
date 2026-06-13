export type MaintenanceType = 'PREVENTIVA' | 'CORRETIVA';

export type MaintenanceCategory = 'TROCA_OLEO' | 'TROCA_PNEUS' | 'REVISAO_GERAL' | 'OUTROS';

export interface Maintenance {
  id: string;
  vehicleId: string;
  type: MaintenanceType;
  category: MaintenanceCategory;
  km: string;
  cost: string;
  description: string;
  scheduledDate: string | null;
  scheduledKm: string | null;
  performedDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceWithVehicle extends Maintenance {
  vehicle: { id: string; plate: string };
}

export interface CreateMaintenancePayload {
  vehicleId: string;
  type: MaintenanceType;
  category: MaintenanceCategory;
  km: number;
  cost: number;
  description: string;
  scheduledDate?: string;
  scheduledKm?: number;
  performedDate?: string;
}

export interface MaintenanceQuery {
  vehicleId?: string;
  type?: MaintenanceType;
  category?: MaintenanceCategory;
  from?: string;
  to?: string;
}

export type ScheduleCategory = 'TROCA_OLEO' | 'TROCA_PNEUS' | 'REVISAO_GERAL';

export interface ScheduleEntry {
  vehicleId: string;
  plate: string;
  category: ScheduleCategory;
  nextKm: number | null;
  nextDate: string | null;
  kmRemaining: number | null;
  daysRemaining: number | null;
}
