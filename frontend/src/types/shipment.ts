export type ShipmentStatus = 'PENDENTE' | 'EM_TRANSITO' | 'ENTREGUE' | 'CANCELADO';

export interface ShipmentItem {
  description: string;
  quantity: number;
}

export interface Shipment {
  id: string;
  protocolNumber: string;
  destinationUnitId: string;
  items: ShipmentItem[];
  senderId: string;
  transporterId: string | null;
  observations: string | null;
  status: ShipmentStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentWithRelations extends Shipment {
  destinationUnit: { id: string; name: string };
  sender: { id: string; name: string };
  transporter: { id: string; name: string } | null;
}

export interface ShipmentStatusHistoryEntry {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  changedAt: string;
  changedBy: string | null;
  notes: string | null;
}

export interface ShipmentWithTimeline extends ShipmentWithRelations {
  statusHistory: ShipmentStatusHistoryEntry[];
}

export interface CreateShipmentPayload {
  destinationUnitId: string;
  items: ShipmentItem[];
  transporterId?: string;
  observations?: string;
}

export interface UpdateShipmentStatusPayload {
  status: ShipmentStatus;
  transporterId?: string;
  notes?: string;
}

export interface ShipmentQuery {
  status?: ShipmentStatus;
  destinationUnitId?: string;
  from?: string;
  to?: string;
}
