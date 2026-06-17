import type { PaginationQuery } from './pagination';

export type ShipmentStatus = 'PENDENTE' | 'EM_TRANSITO' | 'ENTREGUE' | 'CANCELADO' | 'CONFIRMADO';

export type ShipmentItemUnit = 'UND' | 'CX' | 'ML' | 'L';

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  description: string;
  category: string | null;
  quantity: number;
  unit: ShipmentItemUnit;
  notes: string | null;
}

export type ShipmentFileType = 'PDF' | 'PHOTO';

export interface ShipmentFile {
  id: string;
  shipmentId: string;
  type: ShipmentFileType;
  publicToken: string;
  createdAt: string;
}

export interface ShipmentReceipt {
  id: string;
  shipmentId: string;
  confirmedBy: string;
  confirmedAt: string;
  notes: string | null;
  ipAddress: string | null;
  confirmedByUser: { id: string; name: string };
}

export interface Shipment {
  id: string;
  protocolNumber: string;
  originUnitId: string | null;
  destinationUnitId: string;
  senderId: string;
  transporterId: string | null;
  shippedAt: string;
  observations: string | null;
  status: ShipmentStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentWithRelations extends Shipment {
  destinationUnit: { id: string; name: string; phone: string | null };
  originUnit: { id: string; name: string } | null;
  sender: { id: string; name: string };
  transporter: { id: string; name: string } | null;
  items: ShipmentItem[];
  files: ShipmentFile[];
  receipt: ShipmentReceipt | null;
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

export interface CreateShipmentItemPayload {
  description: string;
  category?: string;
  quantity: number;
  unit: ShipmentItemUnit;
  notes?: string;
}

export interface CreateShipmentPayload {
  destinationUnitId: string;
  originUnitId?: string;
  shippedAt?: string;
  items: CreateShipmentItemPayload[];
  transporterId?: string;
  observations?: string;
}

export interface UpdateShipmentStatusPayload {
  status: ShipmentStatus;
  transporterId?: string;
  notes?: string;
}

export interface ConfirmShipmentPayload {
  notes?: string;
}

export interface UpdateShipmentPayload {
  items?: CreateShipmentItemPayload[];
  observations?: string;
  transporterId?: string;
}

export interface ShipmentQuery extends PaginationQuery {
  status?: ShipmentStatus;
  destinationUnitId?: string;
  from?: string;
  to?: string;
}
