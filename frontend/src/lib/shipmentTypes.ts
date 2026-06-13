import type { ShipmentStatus } from '@/types/shipment';

export const shipmentStatusLabels: Record<ShipmentStatus, string> = {
  PENDENTE: 'Pendente',
  EM_TRANSITO: 'Em trânsito',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
};

export const shipmentStatusOptions: { value: ShipmentStatus; label: string }[] = Object.entries(
  shipmentStatusLabels,
).map(([value, label]) => ({ value: value as ShipmentStatus, label }));

export const shipmentStatusBadgeVariants: Record<
  ShipmentStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PENDENTE: 'outline',
  EM_TRANSITO: 'secondary',
  ENTREGUE: 'default',
  CANCELADO: 'destructive',
};

// Transições de status válidas - espelha backend/src/modules/shipments/shipments.util.ts
export const validShipmentTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
  PENDENTE: ['EM_TRANSITO', 'CANCELADO'],
  EM_TRANSITO: ['ENTREGUE', 'CANCELADO'],
  ENTREGUE: [],
  CANCELADO: [],
};
