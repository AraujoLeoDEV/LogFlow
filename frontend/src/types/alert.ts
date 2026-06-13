export type AlertType =
  | 'LICENSING'
  | 'INSURANCE'
  | 'CNH'
  | 'REVIEW'
  | 'OIL_CHANGE'
  | 'TIRE_CHANGE'
  | 'TRIP_DELAYED';

export type AlertSeverity = 'INFO' | 'AVISO' | 'CRITICO';

export type AlertStatus = 'PENDENTE' | 'ENVIADO' | 'LIDO';

export interface Alert {
  id: string;
  type: AlertType;
  referenceType: string;
  referenceId: string;
  message: string;
  severity: AlertSeverity;
  dueDate: string | null;
  status: AlertStatus;
  targetRole: string | null;
  targetUserId: string | null;
  createdAt: string;
}

export interface AlertQuery {
  status?: AlertStatus;
}
