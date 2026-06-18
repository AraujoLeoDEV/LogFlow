// Converte uma data no formato `YYYY-MM-DD` para horário local, evitando o
// deslocamento de timezone do `new Date(string)` (strings sem horário são
// interpretadas como UTC, o que "volta" um dia em timezones negativos como
// o do Brasil). Strings com horário/timezone explícitos são repassadas para
// `new Date`. Com `endOfDay`, retorna o último instante do dia (23:59:59.999),
// útil para filtros `lte` inclusivos do dia final de um período.
export function parseDateOnly(value: string, endOfDay = false): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return new Date(value);
  }

  const [, year, month, day] = match;

  return endOfDay
    ? new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999)
    : new Date(Number(year), Number(month) - 1, Number(day));
}

// Monta o filtro `gte`/`lte` de um período `from`/`to` (ambos opcionais)
// para uso direto em `where.<campoDeData>` do Prisma. Retorna `undefined`
// quando nenhum dos dois é informado, para não sobrescrever o campo no
// `where` com um objeto vazio.
export function buildDateRangeFilter(
  from?: string,
  to?: string,
): { gte?: Date; lte?: Date } | undefined {
  if (!from && !to) {
    return undefined;
  }

  return {
    ...(from ? { gte: parseDateOnly(from) } : {}),
    ...(to ? { lte: parseDateOnly(to, true) } : {}),
  };
}
