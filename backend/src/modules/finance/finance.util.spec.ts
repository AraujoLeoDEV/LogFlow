import { buildMonthRange } from './finance.util';

describe('buildMonthRange', () => {
  it('retorna apenas o mês atual quando nenhum filtro é informado', () => {
    const now = new Date();
    const result = buildMonthRange();

    expect(result).toHaveLength(1);
    expect(result[0].month).toBe(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    );
  });

  it('retorna apenas o mês de referência quando só `to` é informado', () => {
    const result = buildMonthRange(undefined, '2026-03-15');

    expect(result).toEqual([
      {
        month: '2026-03',
        start: new Date(2026, 2, 1),
        end: new Date(2026, 2, 31, 23, 59, 59, 999),
      },
    ]);
  });

  it('gera todos os meses entre `from` e `to` (inclusive)', () => {
    const result = buildMonthRange('2026-01-10', '2026-03-20');

    expect(result.map((range) => range.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
    expect(result[0].start).toEqual(new Date(2026, 0, 1));
    expect(result[0].end).toEqual(new Date(2026, 0, 31, 23, 59, 59, 999));
    expect(result[2].end).toEqual(new Date(2026, 2, 31, 23, 59, 59, 999));
  });

  it('lida corretamente com a virada de ano', () => {
    const result = buildMonthRange('2025-11-01', '2026-01-31');

    expect(result.map((range) => range.month)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
    ]);
  });
});
