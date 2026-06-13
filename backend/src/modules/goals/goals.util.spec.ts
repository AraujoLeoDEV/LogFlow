import { Prisma } from '../../../generated/prisma/client';
import { evaluateGoal, getPeriodRange, isPeriodClosed } from './goals.util';

describe('getPeriodRange', () => {
  it('retorna o início e o fim do mês para um período "YYYY-MM"', () => {
    const result = getPeriodRange('2026-03');

    expect(result.start).toEqual(new Date(2026, 2, 1));
    expect(result.end).toEqual(new Date(2026, 2, 31, 23, 59, 59, 999));
  });

  it('lida corretamente com meses de fevereiro e virada de ano', () => {
    expect(getPeriodRange('2026-02').end).toEqual(
      new Date(2026, 1, 28, 23, 59, 59, 999),
    );
    expect(getPeriodRange('2024-02').end).toEqual(
      new Date(2024, 1, 29, 23, 59, 59, 999),
    );
    expect(getPeriodRange('2025-12').end).toEqual(
      new Date(2025, 11, 31, 23, 59, 59, 999),
    );
  });
});

describe('evaluateGoal', () => {
  const target = new Prisma.Decimal(10);

  it('retorna ABERTA quando ainda não há valor real apurado', () => {
    const result = evaluateGoal(target, null);

    expect(result.status).toBe('ABERTA');
    expect(result.commissionValue).toBeNull();
  });

  it('retorna NAO_ATINGIDA e comissão zero quando o real fica abaixo da meta', () => {
    const result = evaluateGoal(target, new Prisma.Decimal(8));

    expect(result.status).toBe('NAO_ATINGIDA');
    expect(result.commissionValue?.toNumber()).toBe(0);
  });

  it('retorna ATINGIDA e comissão zero quando o real é igual à meta', () => {
    const result = evaluateGoal(target, new Prisma.Decimal(10));

    expect(result.status).toBe('ATINGIDA');
    expect(result.commissionValue?.toNumber()).toBe(0);
  });

  it('retorna ATINGIDA e calcula comissão proporcional quando o real supera a meta', () => {
    const result = evaluateGoal(target, new Prisma.Decimal(10.5));

    expect(result.status).toBe('ATINGIDA');
    expect(result.commissionValue?.toNumber()).toBe(25);
  });
});

describe('isPeriodClosed', () => {
  it('retorna true quando o período já terminou', () => {
    expect(isPeriodClosed('2026-01', new Date(2026, 2, 1))).toBe(true);
  });

  it('retorna false quando o período é o mês atual ou futuro', () => {
    expect(isPeriodClosed('2026-03', new Date(2026, 2, 15))).toBe(false);
    expect(isPeriodClosed('2026-04', new Date(2026, 2, 15))).toBe(false);
  });
});
