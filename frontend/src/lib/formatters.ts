const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFormatter.format(new Date(value)) : '—';
}

export function formatDate(value: string | null | undefined): string {
  return value ? dateFormatter.format(new Date(value)) : '—';
}

export function formatCurrency(value: number | string | null | undefined): string {
  return value !== null && value !== undefined ? currencyFormatter.format(Number(value)) : '—';
}

export function formatNumber(
  value: number | string | null | undefined,
  fractionDigits = 1,
): string {
  return value !== null && value !== undefined
    ? Number(value).toLocaleString('pt-BR', {
        maximumFractionDigits: fractionDigits,
      })
    : '—';
}
