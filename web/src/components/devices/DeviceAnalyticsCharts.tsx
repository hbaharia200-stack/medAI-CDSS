import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ChartTooltip,
  CHART_COLORS,
  chartAxisTick,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '../common/Charts';
import { Card } from '../common/Card';
import type { DeviceStatistics } from '../../types/device';

const STATUS_FILL: Record<string, string> = {
  OPERATIONAL: CHART_COLORS.confHigh,
  DAMAGED: CHART_COLORS.danger,
  UNDER_MAINTENANCE: CHART_COLORS.accent,
  OFFLINE: 'var(--color-ink-muted)',
  RETIRED: 'var(--color-conf-low)',
};

const LEGEND_STYLE = { color: 'var(--color-ink-muted)', fontSize: 12 } as const;

/** Status distribution donut + department bars + maintenance trend (Recharts, theme-token styled). */
export function DeviceAnalyticsCharts({ stats }: { stats: DeviceStatistics }) {
  const { t } = useTranslation();
  const statusData = [
    { name: t('devices.statusOperational'), value: stats.operational, fill: STATUS_FILL.OPERATIONAL },
    { name: t('devices.statusDamaged'), value: stats.damaged, fill: STATUS_FILL.DAMAGED },
    { name: t('devices.statusUnderMaintenance'), value: stats.underMaintenance, fill: STATUS_FILL.UNDER_MAINTENANCE },
    { name: t('devices.statusOffline'), value: stats.offline, fill: STATUS_FILL.OFFLINE },
    { name: t('devices.statusRetired'), value: stats.retired, fill: STATUS_FILL.RETIRED },
  ];
  const total = Math.max(stats.total, 1);
  const legendWithShare = (value: string, entry: any) => {
    const count = entry?.payload?.value ?? 0;
    const pct = Math.round((count / total) * 100);
    return `${value} - ${count} (${pct}%)`;
  };
  return (
    <Card title={t('devices.analyticsTitle')}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-muted">{t('devices.statusDistribution')}</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={84} paddingAngle={3} strokeWidth={0}>
                  {statusData.map((s) => (
                    <Cell key={s.name} fill={s.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend formatter={legendWithShare} wrapperStyle={LEGEND_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-muted">{t('devices.departmentDistribution')}</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byDepartment} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="deviceDeptBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="department" tickLine={false} axisLine={false} tick={chartAxisTick} interval={0} height={52} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={chartAxisTick} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-canvas)' }} />
                <Bar dataKey="count" name={t('devices.deviceCount')} fill="url(#deviceDeptBar)" radius={[8, 8, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-muted">{t('devices.maintenanceTrendTitle')}</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.maintenanceTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.line} vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={chartAxisTick} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={chartAxisTick} width={40} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_COLORS.line }} />
                <Line type="monotone" dataKey="maintenanceCount" name={t('devices.maintenanceCount')} stroke={CHART_COLORS.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default DeviceAnalyticsCharts;
