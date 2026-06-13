import { calculateIncidentRate, INCIDENT_RATE_PER_KM } from './incidents.util';

describe('calculateIncidentRate', () => {
  it('calcula o índice de ocorrências por 1.000 km rodados', () => {
    expect(calculateIncidentRate(5, 5000)).toBe(1);
    expect(calculateIncidentRate(2, 1000)).toBe(
      2 * (INCIDENT_RATE_PER_KM / 1000),
    );
  });

  it('retorna 0 quando não há ocorrências mas há KM rodado', () => {
    expect(calculateIncidentRate(0, 5000)).toBe(0);
  });

  it('retorna null quando não há KM rodado no período (divisão por zero)', () => {
    expect(calculateIncidentRate(3, 0)).toBeNull();
  });

  it('retorna null quando o KM rodado é negativo', () => {
    expect(calculateIncidentRate(3, -10)).toBeNull();
  });
});
