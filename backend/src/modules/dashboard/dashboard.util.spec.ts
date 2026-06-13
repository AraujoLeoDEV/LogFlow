import { calculateCostPerKm, rankDescending } from './dashboard.util';

describe('calculateCostPerKm', () => {
  it('calcula o custo por km rodado', () => {
    expect(calculateCostPerKm(1000, 500)).toBe(2);
  });

  it('retorna null quando não há KM rodado no período (divisão por zero)', () => {
    expect(calculateCostPerKm(1000, 0)).toBeNull();
  });

  it('retorna null quando o KM rodado é negativo', () => {
    expect(calculateCostPerKm(1000, -10)).toBeNull();
  });
});

describe('rankDescending', () => {
  it('ordena de forma decrescente e atribui rank a partir de 1', () => {
    const items = [
      { name: 'A', km: 100 },
      { name: 'B', km: 300 },
      { name: 'C', km: 200 },
    ];

    expect(rankDescending(items, (item) => item.km)).toEqual([
      { name: 'B', km: 300, rank: 1 },
      { name: 'C', km: 200, rank: 2 },
      { name: 'A', km: 100, rank: 3 },
    ]);
  });

  it('não modifica o array original', () => {
    const items = [
      { name: 'A', km: 100 },
      { name: 'B', km: 300 },
    ];

    rankDescending(items, (item) => item.km);

    expect(items).toEqual([
      { name: 'A', km: 100 },
      { name: 'B', km: 300 },
    ]);
  });
});
