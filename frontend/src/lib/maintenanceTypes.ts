import type { MaintenanceCategory, MaintenanceType, ScheduleCategory } from '@/types/maintenance';

export const maintenanceTypeLabels: Record<MaintenanceType, string> = {
  PREVENTIVA: 'Preventiva',
  CORRETIVA: 'Corretiva',
};

export const maintenanceTypeOptions: { value: MaintenanceType; label: string }[] = Object.entries(
  maintenanceTypeLabels,
).map(([value, label]) => ({ value: value as MaintenanceType, label }));

export const maintenanceCategoryLabels: Record<MaintenanceCategory, string> = {
  TROCA_OLEO: 'Troca de óleo',
  TROCA_PNEUS: 'Troca de pneus',
  REVISAO_GERAL: 'Revisão geral',
  OUTROS: 'Outros',
};

export const maintenanceCategoryOptions: { value: MaintenanceCategory; label: string }[] =
  Object.entries(maintenanceCategoryLabels).map(([value, label]) => ({
    value: value as MaintenanceCategory,
    label,
  }));

export const scheduleCategoryLabels: Record<ScheduleCategory, string> = {
  TROCA_OLEO: 'Troca de óleo',
  TROCA_PNEUS: 'Troca de pneus',
  REVISAO_GERAL: 'Revisão geral',
};
