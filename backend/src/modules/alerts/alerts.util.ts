import {
  AlertSeverity,
  AlertType,
  Role,
} from '../../../generated/prisma/client';

// Limiares (em dias e em KM) usados para decidir se um vencimento já deve
// gerar alerta e com qual gravidade - seção 4.10. Valores negativos (já
// vencido) sempre caem no limiar CRITICO.
export const DAYS_THRESHOLD_INFO = 30;
export const DAYS_THRESHOLD_AVISO = 15;
export const DAYS_THRESHOLD_CRITICO = 7;

export const KM_THRESHOLD_INFO = 1000;
export const KM_THRESHOLD_AVISO = 500;
export const KM_THRESHOLD_CRITICO = 100;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export type AlertReferenceType = 'VEHICLE' | 'DRIVER' | 'TRIP';

export interface AlertCandidate {
  type: AlertType;
  referenceType: AlertReferenceType;
  referenceId: string;
  message: string;
  severity: AlertSeverity;
  dueDate: Date;
  targetRole: Role | null;
  targetUserId: string | null;
}

export interface VehicleAlertSource {
  id: string;
  plate: string;
  currentKm: number;
  licensingExpiration: Date | null;
  insuranceExpiration: Date | null;
  nextOilChangeKm: number | null;
  nextOilChangeDate: Date | null;
  nextTireChangeKm: number | null;
  nextTireChangeDate: Date | null;
  nextReviewKm: number | null;
  nextReviewDate: Date | null;
}

export interface DriverAlertSource {
  id: string;
  name: string;
  userId: string | null;
  cnhExpiration: Date | null;
}

export interface TripAlertSource {
  id: string;
  destination: string;
  startedAt: Date;
  estimatedDurationMinutes: number;
  driverName: string;
  driverUserId: string | null;
  vehiclePlate: string;
}

export function diffInDays(date: Date, now: Date): number {
  return Math.round((date.getTime() - now.getTime()) / MS_PER_DAY);
}

// Gravidade associada a um vencimento por data - seção 4.10. Retorna null
// quando o vencimento está fora da janela de alerta (mais de 30 dias).
export function severityForDays(
  daysRemaining: number | null,
): AlertSeverity | null {
  if (daysRemaining === null) {
    return null;
  }
  if (daysRemaining <= DAYS_THRESHOLD_CRITICO) {
    return AlertSeverity.CRITICO;
  }
  if (daysRemaining <= DAYS_THRESHOLD_AVISO) {
    return AlertSeverity.AVISO;
  }
  if (daysRemaining <= DAYS_THRESHOLD_INFO) {
    return AlertSeverity.INFO;
  }
  return null;
}

// Gravidade associada a um vencimento por KM - seção 4.10. Retorna null
// quando o vencimento está fora da janela de alerta (mais de 1000km).
export function severityForKm(
  kmRemaining: number | null,
): AlertSeverity | null {
  if (kmRemaining === null) {
    return null;
  }
  if (kmRemaining <= KM_THRESHOLD_CRITICO) {
    return AlertSeverity.CRITICO;
  }
  if (kmRemaining <= KM_THRESHOLD_AVISO) {
    return AlertSeverity.AVISO;
  }
  if (kmRemaining <= KM_THRESHOLD_INFO) {
    return AlertSeverity.INFO;
  }
  return null;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  [AlertSeverity.INFO]: 1,
  [AlertSeverity.AVISO]: 2,
  [AlertSeverity.CRITICO]: 3,
};

// Combina duas gravidades (ex: vencimento por data e por KM do mesmo item),
// a pior das duas prevalece - seção 4.10.
export function combineSeverity(
  a: AlertSeverity | null,
  b: AlertSeverity | null,
): AlertSeverity | null {
  if (a === null) {
    return b;
  }
  if (b === null) {
    return a;
  }
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(date: Date): string {
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${formatDate(date)} ${hours}:${minutes}`;
}

function daysPhrase(daysRemaining: number): string {
  if (daysRemaining < 0) {
    return `venceu há ${Math.abs(daysRemaining)} dia(s)`;
  }
  if (daysRemaining === 0) {
    return 'vence hoje';
  }
  return `vence em ${daysRemaining} dia(s)`;
}

function kmPhrase(kmRemaining: number): string {
  if (kmRemaining <= 0) {
    return `${Math.abs(kmRemaining)} km acima do previsto`;
  }
  return `faltam ${kmRemaining} km`;
}

// Alertas de vencimento de licenciamento e seguro do veículo - seção 4.10.
export function buildVehicleExpirationAlerts(
  vehicle: VehicleAlertSource,
  now: Date,
): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];

  if (vehicle.licensingExpiration) {
    const daysRemaining = diffInDays(vehicle.licensingExpiration, now);
    const severity = severityForDays(daysRemaining);
    if (severity) {
      candidates.push({
        type: AlertType.LICENSING,
        referenceType: 'VEHICLE',
        referenceId: vehicle.id,
        message: `Licenciamento do veículo ${vehicle.plate} ${daysPhrase(daysRemaining)} (${formatDate(vehicle.licensingExpiration)}).`,
        severity,
        dueDate: vehicle.licensingExpiration,
        targetRole: Role.COORDENACAO,
        targetUserId: null,
      });
    }
  }

  if (vehicle.insuranceExpiration) {
    const daysRemaining = diffInDays(vehicle.insuranceExpiration, now);
    const severity = severityForDays(daysRemaining);
    if (severity) {
      candidates.push({
        type: AlertType.INSURANCE,
        referenceType: 'VEHICLE',
        referenceId: vehicle.id,
        message: `Seguro do veículo ${vehicle.plate} ${daysPhrase(daysRemaining)} (${formatDate(vehicle.insuranceExpiration)}).`,
        severity,
        dueDate: vehicle.insuranceExpiration,
        targetRole: Role.COORDENACAO,
        targetUserId: null,
      });
    }
  }

  return candidates;
}

const MAINTENANCE_FIELDS: {
  type: AlertType;
  kmField: keyof VehicleAlertSource;
  dateField: keyof VehicleAlertSource;
  label: string;
}[] = [
  {
    type: AlertType.OIL_CHANGE,
    kmField: 'nextOilChangeKm',
    dateField: 'nextOilChangeDate',
    label: 'Troca de óleo',
  },
  {
    type: AlertType.TIRE_CHANGE,
    kmField: 'nextTireChangeKm',
    dateField: 'nextTireChangeDate',
    label: 'Troca de pneus',
  },
  {
    type: AlertType.REVIEW,
    kmField: 'nextReviewKm',
    dateField: 'nextReviewDate',
    label: 'Revisão geral',
  },
];

// Alertas de manutenção prevista (óleo/pneus/revisão), combinando o
// vencimento por data e por KM de cada item - seção 4.10. Itens sem data
// prevista (nextDate null) são ignorados, pois a data é usada como dueDate
// para deduplicação do alerta.
export function buildVehicleMaintenanceAlerts(
  vehicle: VehicleAlertSource,
  now: Date,
): AlertCandidate[] {
  const candidates: AlertCandidate[] = [];

  for (const field of MAINTENANCE_FIELDS) {
    const nextKm = vehicle[field.kmField] as number | null;
    const nextDate = vehicle[field.dateField] as Date | null;

    if (nextDate === null) {
      continue;
    }

    const kmRemaining = nextKm !== null ? nextKm - vehicle.currentKm : null;
    const daysRemaining = diffInDays(nextDate, now);

    const severity = combineSeverity(
      severityForKm(kmRemaining),
      severityForDays(daysRemaining),
    );
    if (!severity) {
      continue;
    }

    const parts = [daysPhrase(daysRemaining)];
    if (kmRemaining !== null) {
      parts.push(kmPhrase(kmRemaining));
    }

    candidates.push({
      type: field.type,
      referenceType: 'VEHICLE',
      referenceId: vehicle.id,
      message: `${field.label} do veículo ${vehicle.plate}: ${parts.join(', ')} (${formatDate(nextDate)}).`,
      severity,
      dueDate: nextDate,
      targetRole: Role.COORDENACAO,
      targetUserId: null,
    });
  }

  return candidates;
}

// Alerta de vencimento da CNH do motorista - seção 4.10. Visível para
// COORDENACAO e, se o motorista tiver login vinculado, também para ele.
export function buildDriverCnhAlerts(
  driver: DriverAlertSource,
  now: Date,
): AlertCandidate[] {
  if (!driver.cnhExpiration) {
    return [];
  }

  const daysRemaining = diffInDays(driver.cnhExpiration, now);
  const severity = severityForDays(daysRemaining);
  if (!severity) {
    return [];
  }

  return [
    {
      type: AlertType.CNH,
      referenceType: 'DRIVER',
      referenceId: driver.id,
      message: `CNH do motorista ${driver.name} ${daysPhrase(daysRemaining)} (${formatDate(driver.cnhExpiration)}).`,
      severity,
      dueDate: driver.cnhExpiration,
      targetRole: Role.COORDENACAO,
      targetUserId: driver.userId,
    },
  ];
}

// Alerta de viagem em atraso - seção 4.10. Espera-se que o chamador filtre
// apenas viagens com status ATRASADA (job da seção 4.5 já marca o status).
export function buildTripDelayedAlert(trip: TripAlertSource): AlertCandidate {
  const deadline = new Date(
    trip.startedAt.getTime() + trip.estimatedDurationMinutes * 60_000,
  );

  return {
    type: AlertType.TRIP_DELAYED,
    referenceType: 'TRIP',
    referenceId: trip.id,
    message: `Viagem do motorista ${trip.driverName} (veículo ${trip.vehiclePlate}, destino ${trip.destination}) está atrasada desde ${formatDateTime(deadline)}.`,
    severity: AlertSeverity.CRITICO,
    dueDate: deadline,
    targetRole: Role.COORDENACAO,
    targetUserId: trip.driverUserId,
  };
}
