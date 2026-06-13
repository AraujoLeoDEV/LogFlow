export interface MonthRange {
  month: string;
  start: Date;
  end: Date;
}

// Gera a lista de meses (com início/fim do mês) entre `from` e `to` - seção
// 4.12. Sem filtros, retorna apenas o mês atual; com apenas um dos dois,
// usa o outro como referência (mês único).
export function buildMonthRange(from?: string, to?: string): MonthRange[] {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : end;

  const months: MonthRange[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= last) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    months.push({
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      start: monthStart,
      end: monthEnd,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}
