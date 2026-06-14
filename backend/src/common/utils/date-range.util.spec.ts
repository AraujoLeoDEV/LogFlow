import { parseDateOnly } from './date-range.util';

describe('parseDateOnly', () => {
  it('interpreta uma data `YYYY-MM-DD` como horário local (início do dia)', () => {
    const result = parseDateOnly('2026-06-01');

    expect(result).toEqual(new Date(2026, 5, 1, 0, 0, 0, 0));
  });

  it('com `endOfDay`, retorna o último instante do dia', () => {
    const result = parseDateOnly('2026-06-30', true);

    expect(result).toEqual(new Date(2026, 5, 30, 23, 59, 59, 999));
  });

  it('repassa strings com horário/timezone explícitos para `new Date`', () => {
    const result = parseDateOnly('2026-06-01T10:00:00Z');

    expect(result).toEqual(new Date('2026-06-01T10:00:00Z'));
  });
});
