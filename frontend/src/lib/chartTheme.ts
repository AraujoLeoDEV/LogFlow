export const chartGridProps = {
  strokeDasharray: '3 3',
  vertical: false,
  stroke: 'var(--border)',
};

export const chartAxisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--muted-foreground)', fontSize: 12 },
};

export const chartTooltipProps = {
  cursor: { fill: 'var(--muted)', opacity: 0.5 },
  contentStyle: {
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '0 4px 16px rgb(0 0 0 / 0.12)',
    fontSize: '0.8125rem',
    padding: '0.5rem 0.75rem',
  },
  labelStyle: { fontWeight: 600, marginBottom: '0.25rem' },
};

export function chartGradientId(color: string) {
  return `chart-gradient-${color}`;
}

export function chartGradientUrl(color: string) {
  return `url(#${chartGradientId(color)})`;
}
