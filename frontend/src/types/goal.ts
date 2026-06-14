export type GoalType = 'CONSUMPTION_REDUCTION';

export type GoalStatus = 'ABERTA' | 'ATINGIDA' | 'NAO_ATINGIDA';

export interface Goal {
  id: string;
  driverId: string | null;
  vehicleId: string | null;
  type: GoalType;
  period: string;
  targetValue: string;
  actualValue: string | null;
  commissionValue: string | null;
  status: GoalStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoalWithRelations extends Goal {
  driver: { id: string; name: string } | null;
  vehicle: { id: string; plate: string; model: string; currentKm: string } | null;
}

export interface CreateGoalPayload {
  driverId?: string;
  vehicleId?: string;
  type: GoalType;
  period: string;
  targetValue: number;
}

export type UpdateGoalPayload = Partial<CreateGoalPayload>;

export interface GoalQuery {
  driverId?: string;
  vehicleId?: string;
  period?: string;
  type?: GoalType;
  status?: GoalStatus;
}

export interface GoalRankingEntry {
  goalId: string;
  driverId: string | null;
  driverName: string | null;
  vehicleId: string | null;
  vehiclePlate: string | null;
  vehicleModel: string | null;
  vehicleCurrentKm: string | null;
  type: GoalType;
  targetValue: number;
  actualValue: number | null;
  difference: number | null;
  status: GoalStatus;
  commissionValue: number | null;
}
