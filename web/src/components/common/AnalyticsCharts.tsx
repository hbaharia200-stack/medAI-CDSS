import { useTranslation } from 'react-i18next';
import { Area, ComposedChart } from 'recharts';
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
} from './Charts';
import { Card } from './Card';
import { StatCard } from './StatCard';
import type {
  AgeBucket,
  DiagnosisCount,
  GenderSlice,
  MonthlyGrowthPoint,
  PerformancePoint,
  SatisfactionSlice,
} from '../../types';

function genderLabel(label: string, t: (key: string) => string) {
  if (label === 'Female') return t('admin.genderFemale');
  return t('admin.genderMale');
}

function ratingLabel(rating: string, t: (key: string) => string) {
  if (rating === 'Good') return t('admin.ratingGood');
  if (rating === 'Average') return t('admin.ratingAverage');
  if (rating === 'Poor') return t('admin.ratingPoor');
  return t('admin.ratingExcellent');
}

function legendWithShare(total: number) {
  return (value: string, entry: any) => {
    const count = entry?.payload?.count ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `${value} · ${count} (${pct}%)`;
  };
}

const LEGEND_STYLE = { color: 'var(--color-ink-muted)', fontSize: 12 } as const;

/** Full-width monotone patient-growth line with a gradient fill (BasicDashboard bar-gradient technique). */
export function GrowthLineChart({ data }: { data: MonthlyGrowthPoint[] }) {
  const { t } = useTranslation();
  const label = t('admin.patientsLabel');
  return (
    <Card title={t('admin.patientGrowthTitle')}>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="growthAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.45} />
                <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.line} vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={chartAxisTick} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={chartAxisTick} width={44} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_COLORS.line }} />
            <Area type="monotone" dataKey="patients" name={label} stroke="none" fill="url(#growthAreaFill)" />
            <Line
              type="monotone"
              dataKey="patients"
              name={label}
              stroke={CHART_COLORS.primary}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

const GENDER_COLORS = [CHART_COLORS.primary, '#F472B6'];

/** Age Distribution (rounded gradient bars, Patient Activity style) + Gender donut, side by side on xl. */
export function AgeGenderCharts({ age, gender }: { age: AgeBucket[]; gender: GenderSlice[] }) {
  const { t } = useTranslation();
  const patientsLabel = t('admin.patientsLabel');
  const genderTotal = gender.reduce((sum, g) => sum + g.count, 0);
  const genderData = gender.map((g) => ({ ...g, label: genderLabel(g.label, t) }));
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card title={t('admin.ageDistributionTitle')}>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={age} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="ageBarFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={1} />
                  <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.line} vertical={false} />
              <XAxis dataKey="bracket" tickLine={false} axisLine={false} tick={chartAxisTick} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={chartAxisTick} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.canvas }} />
              <Bar dataKey="count" name={patientsLabel} fill="url(#ageBarFill)" radius={[8, 8, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title={t('admin.genderSplitTitle')}>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={genderData}
                dataKey="count"
                nameKey="label"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={3}
                strokeWidth={0}
              >
                {genderData.map((g, i) => (
                  <Cell key={g.label} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend formatter={legendWithShare(genderTotal)} wrapperStyle={LEGEND_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-center text-sm text-ink-muted">
          {t('dashboards.totalPatients')}: <span className="font-extrabold text-ink">{genderTotal}</span>
        </p>
      </Card>
    </div>
  );
}

const RATING_COLORS = [CHART_COLORS.confHigh, CHART_COLORS.primary, CHART_COLORS.confMedium, CHART_COLORS.danger];

/** Ranked diagnosis categories: horizontal bars (Cases-by-region pattern) + exact-figures ranked table. */
export function DiagnosisStatsCard({ data }: { data: DiagnosisCount[] }) {
  const { t } = useTranslation();
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <Card title={t('admin.diagnosisStatsTitle')}>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.line} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={chartAxisTick} />
            <YAxis type="category" dataKey="category" width={110} tickLine={false} axisLine={false} tick={chartAxisTick} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.canvas }} />
            <Bar dataKey="count" name={t('admin.diagnosisCases')} fill={CHART_COLORS.primary} radius={[0, 8, 8, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 border-t border-line pt-3">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1.5 text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t('admin.diagnosisCategory')}</span>
          <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t('admin.diagnosisCases')}</span>
          <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t('admin.diagnosisShare')}</span>
          {data.map((d) => (
            <div key={d.category} className="contents">
              <span className="truncate font-semibold text-ink">{d.category}</span>
              <span className="text-right font-extrabold text-ink">{d.count}</span>
              <span className="text-right text-ink-muted">
                {total > 0 ? Math.round((d.count / total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** AI acceptance-rate + decision-time trend with dual axes so both series stay legible. */
export function PerformanceChartCard({ data }: { data: PerformancePoint[] }) {
  const { t } = useTranslation();
  return (
    <Card title={t('admin.performanceTitle')}>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.line} vertical={false} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tick={chartAxisTick} />
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={chartAxisTick}
              width={40}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={chartAxisTick}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_COLORS.line }} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="acceptanceRate"
              name={t('admin.acceptanceRate')}
              stroke={CHART_COLORS.confHigh}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgTimeMin"
              name={t('admin.avgDecisionTimeSeries')}
              stroke={CHART_COLORS.accent}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Satisfaction donut plus the average score as a StatCard KPI. */
export function SatisfactionChartCard({ slices, avg }: { slices: SatisfactionSlice[]; avg: number }) {
  const { t } = useTranslation();
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const data = slices.map((s) => ({ ...s, rating: ratingLabel(s.rating, t) }));
  return (
    <Card title={t('admin.satisfactionTitle')}>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="rating"
              innerRadius={60}
              outerRadius={88}
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((r, i) => (
                <Cell key={r.rating} fill={RATING_COLORS[i % RATING_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend formatter={legendWithShare(total)} wrapperStyle={LEGEND_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4">
        <StatCard
          label={t('dashboards.satisfactionAvgLabel')}
          value={`${avg.toLocaleString(undefined, { maximumFractionDigits: 1 })} / 5`}
          icon="activity"
          iconBg="bg-conf-high-bg"
        />
      </div>
    </Card>
  );
}
