import { MaintenanceCategory } from '../../../generated/prisma/client';

// Intervalos (em meses) usados para recalcular as datas de next* quando uma
// manutenção da categoria correspondente é concluída - seção 4.7. Os
// intervalos em KM usam as constantes KM_ALERT_OIL_CHANGE/KM_ALERT_MAINTENANCE
// do .env (seção "Módulo de frota").
export const OIL_CHANGE_INTERVAL_MONTHS = 6;
export const TIRE_CHANGE_INTERVAL_MONTHS = 12;
export const REVIEW_INTERVAL_MONTHS = 6;

// TROCA_PNEUS usa um múltiplo do intervalo genérico de manutenção
// (KM_ALERT_MAINTENANCE), já que pneus duram mais que uma revisão geral.
export const TIRE_CHANGE_KM_MULTIPLIER = 4;

export interface NextMaintenanceFields {
  nextOilChangeKm?: number;
  nextOilChangeDate?: Date;
  nextTireChangeKm?: number;
  nextTireChangeDate?: Date;
  nextReviewKm?: number;
  nextReviewDate?: Date;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

interface CalculateNextMaintenanceParams {
  category: MaintenanceCategory;
  performedKm: number;
  performedDate: Date;
  kmAlertOilChange: number;
  kmAlertMaintenance: number;
}

// Recalcula os campos next* do Vehicle correspondentes à categoria da
// manutenção concluída - seção 4.7. Retorna null quando a categoria não
// possui um campo next* associado (ex: OUTROS).
export function calculateNextMaintenance({
  category,
  performedKm,
  performedDate,
  kmAlertOilChange,
  kmAlertMaintenance,
}: CalculateNextMaintenanceParams): NextMaintenanceFields | null {
  switch (category) {
    case MaintenanceCategory.TROCA_OLEO:
      return {
        nextOilChangeKm: performedKm + kmAlertOilChange,
        nextOilChangeDate: addMonths(performedDate, OIL_CHANGE_INTERVAL_MONTHS),
      };
    case MaintenanceCategory.TROCA_PNEUS:
      return {
        nextTireChangeKm:
          performedKm + kmAlertMaintenance * TIRE_CHANGE_KM_MULTIPLIER,
        nextTireChangeDate: addMonths(
          performedDate,
          TIRE_CHANGE_INTERVAL_MONTHS,
        ),
      };
    case MaintenanceCategory.REVISAO_GERAL:
      return {
        nextReviewKm: performedKm + kmAlertMaintenance,
        nextReviewDate: addMonths(performedDate, REVIEW_INTERVAL_MONTHS),
      };
    default:
      return null;
  }
}

export type ScheduleCategory = 'TROCA_OLEO' | 'TROCA_PNEUS' | 'REVISAO_GERAL';

export interface ScheduleEntry {
  vehicleId: string;
  plate: string;
  model: string;
  currentKm: number;
  category: ScheduleCategory;
  nextKm: number | null;
  nextDate: string | null;
  kmRemaining: number | null;
  daysRemaining: number | null;
}

export interface VehicleScheduleSource {
  id: string;
  plate: string;
  model: string;
  currentKm: number;
  nextOilChangeKm: number | null;
  nextOilChangeDate: Date | null;
  nextTireChangeKm: number | null;
  nextTireChangeDate: Date | null;
  nextReviewKm: number | null;
  nextReviewDate: Date | null;
}

const SCHEDULE_FIELDS: {
  category: ScheduleCategory;
  kmField: keyof VehicleScheduleSource;
  dateField: keyof VehicleScheduleSource;
}[] = [
  {
    category: 'TROCA_OLEO',
    kmField: 'nextOilChangeKm',
    dateField: 'nextOilChangeDate',
  },
  {
    category: 'TROCA_PNEUS',
    kmField: 'nextTireChangeKm',
    dateField: 'nextTireChangeDate',
  },
  {
    category: 'REVISAO_GERAL',
    kmField: 'nextReviewKm',
    dateField: 'nextReviewDate',
  },
];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function diffInDays(date: Date, now: Date): number {
  return Math.round((date.getTime() - now.getTime()) / MS_PER_DAY);
}

// Urgência usada para ordenar a agenda: quanto menor (podendo ser negativo
// quando já venceu), mais prioritário - seção 4.7.
function scheduleUrgency(entry: ScheduleEntry): number {
  const km = entry.kmRemaining ?? Infinity;
  const days = entry.daysRemaining ?? Infinity;
  return Math.min(km, days);
}

// Monta a agenda de manutenções previstas (próxima troca de óleo, pneus e
// revisão geral) a partir dos campos next* de cada veículo, ordenada por
// proximidade (data/KM) - seção 4.7.
export function buildScheduleEntries(
  vehicles: VehicleScheduleSource[],
  now: Date,
): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];

  for (const vehicle of vehicles) {
    for (const { category, kmField, dateField } of SCHEDULE_FIELDS) {
      const nextKm = vehicle[kmField] as number | null;
      const nextDate = vehicle[dateField] as Date | null;

      if (nextKm === null && nextDate === null) {
        continue;
      }

      entries.push({
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        model: vehicle.model,
        currentKm: vehicle.currentKm,
        category,
        nextKm,
        nextDate: nextDate ? nextDate.toISOString() : null,
        kmRemaining: nextKm !== null ? nextKm - vehicle.currentKm : null,
        daysRemaining: nextDate !== null ? diffInDays(nextDate, now) : null,
      });
    }
  }

  return entries.sort((a, b) => scheduleUrgency(a) - scheduleUrgency(b));
}
