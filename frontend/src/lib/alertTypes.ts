import type { AlertSeverity, AlertStatus, AlertType } from '@/types/alert';

export const alertTypeLabels: Record<AlertType, string> = {
  LICENSING: 'Licenciamento',
  INSURANCE: 'Seguro',
  CNH: 'CNH',
  REVIEW: 'Revisão',
  OIL_CHANGE: 'Troca de óleo',
  TIRE_CHANGE: 'Troca de pneus',
  TRIP_DELAYED: 'Viagem atrasada',
};

export const alertSeverityLabels: Record<AlertSeverity, string> = {
  INFO: 'Informativo',
  AVISO: 'Aviso',
  CRITICO: 'Crítico',
};

export const alertSeverityBadgeVariants: Record<
  AlertSeverity,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  INFO: 'outline',
  AVISO: 'secondary',
  CRITICO: 'destructive',
};

export const alertStatusLabels: Record<AlertStatus, string> = {
  PENDENTE: 'Pendente',
  ENVIADO: 'Enviado',
  LIDO: 'Lido',
};
