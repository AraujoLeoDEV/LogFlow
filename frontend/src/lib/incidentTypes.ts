import type { IncidentCategory, IncidentSeverity, IncidentType } from '@/types/incident';

export const incidentCategoryLabels: Record<IncidentCategory, string> = {
  TRANSITO: 'Trânsito',
  SINISTRO: 'Sinistro',
  MECANICA: 'Mecânica',
  OPERACIONAL: 'Operacional',
  OUTROS: 'Outros',
};

export const incidentCategoryOptions: { value: IncidentCategory; label: string }[] = Object.entries(
  incidentCategoryLabels,
).map(([value, label]) => ({ value: value as IncidentCategory, label }));

export const incidentTypeLabels: Record<IncidentType, string> = {
  MULTA: 'Multa',
  ACIDENTE: 'Acidente',
  PANE: 'Pane',
  ATRASO: 'Atraso',
  DANO_VEICULO: 'Dano ao veículo',
  OUTROS: 'Outros',
};

export const incidentTypeOptions: { value: IncidentType; label: string }[] = Object.entries(
  incidentTypeLabels,
).map(([value, label]) => ({ value: value as IncidentType, label }));

export const incidentSeverityLabels: Record<IncidentSeverity, string> = {
  BAIXA: 'Baixa',
  MEDIA: 'Média',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

export const incidentSeverityOptions: { value: IncidentSeverity; label: string }[] = Object.entries(
  incidentSeverityLabels,
).map(([value, label]) => ({ value: value as IncidentSeverity, label }));
