import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Theme-token styled tooltip (same pattern as ActivityTooltip in BasicDashboard). */
export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-card">
      {label != null && label !== '' ? (
        <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      ) : null}
      <div className="mt-1 space-y-0.5">
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm font-extrabold text-ink">
            <span style={{ color: p.color ?? p.payload?.fill }}>● </span>
            {p.name}: {p.value}
            {typeof p.value === 'number' && p.dataKey === 'acceptanceRate' ? '%' : ''}
            {p.dataKey === 'avgTimeMin' ? ` ${'min'}` : ''}
          </p>
        ))}
      </div>
    </div>
  );
}

export const chartAxisTick = { fill: 'var(--color-ink-muted)', fontSize: 12 };

export const CHART_COLORS = {
  primary: 'var(--color-primary)',
  accent: 'var(--color-accent)',
  confHigh: 'var(--color-conf-high)',
  confMedium: 'var(--color-conf-medium)',
  danger: 'var(--color-danger)',
  line: 'var(--color-line)',
  canvas: 'var(--color-canvas)',
};

export {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
};
