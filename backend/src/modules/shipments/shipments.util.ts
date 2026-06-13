import { ShipmentStatus } from '../../../generated/prisma/client';

// Transições de status válidas para o envio (protocolo) - seção 4.9.
// ENTREGUE e CANCELADO são estados finais (sem transições de saída).
export const VALID_SHIPMENT_TRANSITIONS: Record<
  ShipmentStatus,
  ShipmentStatus[]
> = {
  PENDENTE: [ShipmentStatus.EM_TRANSITO, ShipmentStatus.CANCELADO],
  EM_TRANSITO: [ShipmentStatus.ENTREGUE, ShipmentStatus.CANCELADO],
  ENTREGUE: [],
  CANCELADO: [],
};

// Indica se o status atual do envio é final (não permite mais transições) -
// seção 4.9.
export function isFinalShipmentStatus(status: ShipmentStatus): boolean {
  return VALID_SHIPMENT_TRANSITIONS[status].length === 0;
}

// Valida se a transição de status é permitida - seção 4.9.
export function isValidShipmentTransition(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  return VALID_SHIPMENT_TRANSITIONS[from].includes(to);
}

// Data no formato AAAAMMDD usada como chave do contador diário de protocolos
// e como prefixo do número de protocolo (AAAAMMDD-SEQ) - seção 4.9.
export function formatProtocolDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Monta o número de protocolo no formato AAAAMMDD-SEQ (SEQ com 4 dígitos,
// crescendo livremente caso supere 9999) - seção 4.9.
export function buildProtocolNumber(date: Date, sequence: number): string {
  return `${formatProtocolDate(date)}-${String(sequence).padStart(4, '0')}`;
}
