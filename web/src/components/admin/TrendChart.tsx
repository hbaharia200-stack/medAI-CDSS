import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import type { DiseaseTrendPoint, RegionTrend } from '../../types';

interface TrendChartProps {
  diseaseTrends: DiseaseTrendPoint[];
  byRegion: RegionTrend[];
}

const LINE_COLORS = ['#0A5CB8', '#1E7E34', '#B26A00', '#C5221F'];

/** Theme-token styled tooltip, matching the activity chart on BasicDashboard. */
function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <div className="mt-1 space-y-0.5">
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-sm text-ink">
            <span className="font-semibold" style={{ color: entry.color ?? entry.stroke }}>
              {entry.name}
            </span>{' '}
            <span className="font-extrabold">{entry.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

const TICK = { fill: 'var(--color-ink-muted)', fontSize: 12 } as const;

export function TrendChart({ diseaseTrends, byRegion }: TrendChartProps) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <h3 className="mb-2 font-bold text-ink">{t('admin.diseaseTrendTitle')}</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={diseaseTrends}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={TICK} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={TICK} width={40} />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--color-line)' }} />
              <Legend wrapperStyle={{ color: 'var(--color-ink-muted)', fontSize: 12 }} />
              {(['malaria', 'pneumonia', 'typhoid', 'hypertension'] as const).map((key, i) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="total"
                  stroke={LINE_COLORS[i]}
                  fill={LINE_COLORS[i]}
                  fillOpacity={0.25}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <h3 className="mb-2 font-bold text-ink">{t('admin.casesByRegionTitle')}</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byRegion} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={TICK} />
              <YAxis type="category" dataKey="region" width={110} tickLine={false} axisLine={false} tick={TICK} />
              <Tooltip content={<TrendTooltip />} cursor={{ fill: 'var(--color-canvas)' }} />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 8, 8, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default TrendChart;