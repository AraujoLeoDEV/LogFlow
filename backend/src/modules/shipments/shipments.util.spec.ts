import { ShipmentStatus } from '../../../generated/prisma/client';
import {
  buildProtocolNumber,
  formatProtocolDate,
  isFinalShipmentStatus,
  isValidShipmentTransition,
} from './shipments.util';

describe('formatProtocolDate', () => {
  it('formata a data no padrão AAAAMMDD em UTC', () => {
    expect(formatProtocolDate(new Date('2026-06-13T10:00:00Z'))).toBe(
      '20260613',
    );
    expect(formatProtocolDate(new Date('2026-01-05T00:00:00Z'))).toBe(
      '20260105',
    );
  });
});

describe('buildProtocolNumber', () => {
  it('monta o protocolo no formato AAAAMMDD-SEQ com 4 dígitos', () => {
    expect(buildProtocolNumber(new Date('2026-06-13T10:00:00Z'), 1)).toBe(
      '20260613-0001',
    );
    expect(buildProtocolNumber(new Date('2026-06-13T10:00:00Z'), 42)).toBe(
      '20260613-0042',
    );
  });

  it('não trunca a sequência quando ultrapassa 9999', () => {
    expect(buildProtocolNumber(new Date('2026-06-13T10:00:00Z'), 10000)).toBe(
      '20260613-10000',
    );
  });
});

describe('isValidShipmentTransition', () => {
  it('permite PENDENTE -> EM_TRANSITO e PENDENTE -> CANCELADO', () => {
    expect(
      isValidShipmentTransition(
        ShipmentStatus.PENDENTE,
        ShipmentStatus.EM_TRANSITO,
      ),
    ).toBe(true);
    expect(
      isValidShipmentTransition(
        ShipmentStatus.PENDENTE,
        ShipmentStatus.CANCELADO,
      ),
    ).toBe(true);
  });

  it('permite EM_TRANSITO -> ENTREGUE e EM_TRANSITO -> CANCELADO', () => {
    expect(
      isValidShipmentTransition(
        ShipmentStatus.EM_TRANSITO,
        ShipmentStatus.ENTREGUE,
      ),
    ).toBe(true);
    expect(
      isValidShipmentTransition(
        ShipmentStatus.EM_TRANSITO,
        ShipmentStatus.CANCELADO,
      ),
    ).toBe(true);
  });

  it('não permite pular etapas (PENDENTE -> ENTREGUE)', () => {
    expect(
      isValidShipmentTransition(
        ShipmentStatus.PENDENTE,
        ShipmentStatus.ENTREGUE,
      ),
    ).toBe(false);
  });

  it('não permite transições a partir de estados finais', () => {
    expect(
      isValidShipmentTransition(
        ShipmentStatus.ENTREGUE,
        ShipmentStatus.EM_TRANSITO,
      ),
    ).toBe(false);
    expect(
      isValidShipmentTransition(
        ShipmentStatus.CANCELADO,
        ShipmentStatus.PENDENTE,
      ),
    ).toBe(false);
  });
});

describe('isFinalShipmentStatus', () => {
  it('ENTREGUE, CANCELADO e CONFIRMADO são finais; PENDENTE e EM_TRANSITO não são', () => {
    expect(isFinalShipmentStatus(ShipmentStatus.ENTREGUE)).toBe(true);
    expect(isFinalShipmentStatus(ShipmentStatus.CANCELADO)).toBe(true);
    expect(isFinalShipmentStatus(ShipmentStatus.CONFIRMADO)).toBe(true);
    expect(isFinalShipmentStatus(ShipmentStatus.PENDENTE)).toBe(false);
    expect(isFinalShipmentStatus(ShipmentStatus.EM_TRANSITO)).toBe(false);
  });
});

describe('VALID_SHIPMENT_TRANSITIONS', () => {
  it('CONFIRMADO não permite nenhuma transição genérica (só via confirmReceipt)', () => {
    expect(
      isValidShipmentTransition(
        ShipmentStatus.CONFIRMADO,
        ShipmentStatus.PENDENTE,
      ),
    ).toBe(false);
  });
});
