// Agrupa uma lista por chave, acumulando um valor por grupo - substitui o
// padrão repetido "Map.get(key) ?? default; mutar/some; Map.set(key, ...)"
// usado em dashboard/incidents/finance para somar métricas por
// motorista/veículo/rota.
//
// `accumulateFn` recebe o acumulador atual (já inicializado por `initFn`
// na primeira ocorrência da chave) e o item da vez, retornando o novo
// acumulador - funciona tanto para acumuladores mutáveis (objeto comum,
// mutar e retornar a mesma referência) quanto imutáveis (ex.: Prisma.Decimal,
// retornar `acc.plus(...)`).
export function groupAndAccumulate<TItem, TKey, TAcc>(
  items: TItem[],
  keyFn: (item: TItem) => TKey,
  initFn: () => TAcc,
  accumulateFn: (acc: TAcc, item: TItem) => TAcc,
): Map<TKey, TAcc> {
  const result = new Map<TKey, TAcc>();

  for (const item of items) {
    const key = keyFn(item);
    const acc = accumulateFn(result.get(key) ?? initFn(), item);
    result.set(key, acc);
  }

  return result;
}
