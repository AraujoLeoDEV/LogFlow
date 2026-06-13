// Custo por KM rodado - seção 4.11. Retorna null quando não há KM rodado
// no período (evita divisão por zero).
export function calculateCostPerKm(
  totalCost: number,
  kmTotal: number,
): number | null {
  if (kmTotal <= 0) {
    return null;
  }

  return totalCost / kmTotal;
}

// Atribui um ranking (1 = maior valor) a uma lista de itens, ordenando-os
// de forma decrescente pelo valor retornado por `getValue` - seção 4.11
// (ranking por motorista).
export function rankDescending<T>(
  items: T[],
  getValue: (item: T) => number,
): (T & { rank: number })[] {
  return [...items]
    .sort((a, b) => getValue(b) - getValue(a))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}
