import { chartGradientId } from '@/lib/chartTheme';

const CHART_COLORS = ['primary', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];

export function ChartGradientDefs() {
  return (
    <defs>
      {CHART_COLORS.map((color) => (
        <linearGradient key={color} id={chartGradientId(color)} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: `var(--${color})`, stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: `var(--${color})`, stopOpacity: 0.55 }} />
        </linearGradient>
      ))}
    </defs>
  );
}
