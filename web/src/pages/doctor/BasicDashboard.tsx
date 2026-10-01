import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import { Icons } from '../../components/common/Icons';
import { useDashboardStore } from '../../state/useDashboardStore';
import {
  getBasicDashboard,
  getStatistics,
  type BasicDashboard as BasicStats,
} from '../../services/api/adminService';
import { listAppointments, todayLocalISO, type AppointmentRow } from '../../services/api/appointmentService';
import { useAppScrollRoot } from '../../hooks/useScrollReveal';
import Reveal from '../../components/marketing/Reveal';

const STATS: Array<{ key: string; icon: 'users' | 'stethoscope' | 'activity' | 'calendar' }> = [
  { key: 'activePatients', icon: 'users' },
  { key: 'pendingCases', icon: 'stethoscope' },
  { key: 'pendingDiagnoses', icon: 'activity' },
  { key: 'totalPatients', icon: 'users' },
];

interface GrowthPoint { label: string; count: number }

// Color-coded per appointment type — left accent bar + icon chip.
const TYPE_STYLES: Record<string, { chip: string; bar: string }> = {
  default: { chip: 'bg-primary-light text-primary', bar: 'bg-primary' },
  'Follow-up': { chip: 'bg-conf-high-bg text-conf-high', bar: 'bg-conf-high' },
  'New diagnosis': { chip: 'bg-primary-light text-primary', bar: 'bg-primary' },
  'Test review': { chip: 'bg-conf-medium-bg text-conf-medium', bar: 'bg-conf-medium' },
};

function Ic({ n, s = 16 }: { n: string; s?: number }) {
  const C: any = (Icons as any)[n] ?? Icons.home;
  return <C width={s} height={s} />;
}

/** Theme-token styled tooltip for the activity chart. */
function ActivityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-card">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="text-sm font-extrabold text-ink">{payload[0].value}</p>
    </div>
  );
}

export default function BasicDashboard() {
  const { t } = useTranslation();
  const loadQueue = useDashboardStore((s) => s.loadQueue);
  const queue = useDashboardStore((s) => s.queue);
  const scrollRoot = useAppScrollRoot();
  // Headline counters are real database figures (`/api/dashboard/basic`).
  const [stats, setStats] = useState<BasicStats | null>(null);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);
  useEffect(() => {
    let cancelled = false;
    getBasicDashboard()
      .then((payload) => { if (!cancelled) setStats(payload); })
      .catch(() => { if (!cancelled) setStats(null); });
    getStatistics()
      .then((payload) => { if (!cancelled) setGrowth(payload.patientGrowth); })
      .catch(() => { if (!cancelled) setGrowth([]); });
    // The SAME endpoint the Appointment Dashboard reads, filtered to today in
    // the application timezone. Previously this listed every appointment ever
    // made, so "Today's Schedule" could show bookings for other days.
    listAppointments({ date: todayLocalISO(), limit: 50, order: 'asc' })
      .then((rows) => { if (!cancelled) setAppointments(rows); })
      .catch(() => { if (!cancelled) setAppointments([]); });
    return () => { cancelled = true; };
  }, []);

  // Today's real bookings, soonest first. The backend already returns the
  // local `time` (HH:MM) in the application timezone, so it is used directly
  // rather than re-formatted through the browser's timezone (which could shift
  // the displayed time and disagree with the Appointment Dashboard).
  const schedule = appointments
    .filter((row) => row.startTime)
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      patient: row.patientName ?? '—',
      type: (row.status || 'pending').replace(/_/g, ' '),
      time: row.time ?? '—',
    }));

  // The activity chart plots patients actually registered per month.
  const activity = growth.map((point) => ({ day: point.label.slice(5), patients: point.count }));

  // "Recent activity" is the newest real cases in the shared clinical queue.
  const recent = [...queue]
    .sort((a, b) => new Date(b.case.createdAt).getTime() - new Date(a.case.createdAt).getTime())
    .slice(0, 4)
    .map((row) => ({
      name: row.case.patient.name,
      action: `${row.case.status.replaceAll('_', ' ')} · ${row.case.chiefComplaint}`,
      time: new Date(row.case.createdAt).toLocaleString(),
    }));

  const statValues: Record<string, number> = {
    activePatients: stats?.activePatients ?? 0,
    pendingCases: stats?.openCases ?? 0,
    pendingDiagnoses: stats?.pendingRecommendations ?? 0,
    totalPatients: stats?.totalPatients ?? 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="overflow-hidden pb-1 pt-1"><h1 className="text-2xl font-extrabold text-heading">{t('nav.basicDashboard')}</h1></div>
        <p className="subtitle-typewriter text-sm text-ink-muted">{t('app.systemName')}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.key} root={scrollRoot} delayMs={i * 90} className="h-full">
            <StatCard
              label={t(`dashboards.${s.key}`)}
              value={stats ? statValues[s.key] : '—'}
              icon={s.icon}
              className="h-full"
            />
          </Reveal>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Patient Activity */}
        <Reveal root={scrollRoot} className="h-full">
        <Card title={t('dashboards.patientActivity')} className="h-full">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="activityBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--color-ink-muted)', fontSize: 12 }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--color-ink-muted)', fontSize: 12 }}
                />
                <Tooltip content={<ActivityTooltip />} cursor={{ fill: 'var(--color-canvas)' }} />
                <Bar dataKey="patients" fill="url(#activityBar)" radius={[8, 8, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        </Reveal>

        {/* Today's Schedule — real appointments from Flask */}
        <Reveal root={scrollRoot} delayMs={90} className="h-full">
        <Card title={t('dashboards.todaysSchedule')} className="h-full">
          <div className="space-y-3">
            {schedule.length === 0 ? (
              <p className="py-4 text-sm text-ink-muted">{t('diagnosis.selectPatient')}</p>
            ) : schedule.map((s, i) => {
              const style = TYPE_STYLES[s.type] ?? TYPE_STYLES.default;
              return (
                <Reveal key={s.id} root={scrollRoot} delayMs={i * 90}>
                <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-3 card-polished-light">
                  <span aria-hidden className={`h-10 w-1.5 shrink-0 rounded-full ${style.bar}`} />
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.chip}`}>
                    <Ic n="calendar" s={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{s.patient}</p>
                    <p className="text-xs text-ink-muted">{s.type}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-ink-muted">{s.time}</span>
                </div>
                </Reveal>
              );
            })}
          </div>
        </Card>
        </Reveal>
      </div>

      {/* Recent Activity — real cases */}
      <Reveal root={scrollRoot}>
      <Card title={t('dashboards.recentActivity')}>
        <div className="space-y-3">
          {recent.length === 0 ? (
            <p className="py-4 text-sm text-ink-muted">{t('doctor.queueEmpty')}</p>
          ) : recent.map((r, i) => (
            <Reveal key={i} root={scrollRoot} delayMs={i * 90}>
            <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-3 card-polished-light">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-white">
                {r.name.split(' ').map((w) => w.charAt(0)).slice(0, 2).join('')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                <p className="truncate text-xs text-ink-muted">{r.action}</p>
              </div>
              <span className="shrink-0 text-xs text-ink-muted">{r.time}</span>
            </div>
            </Reveal>
          ))}
        </div>
      </Card>
      </Reveal>
    </div>
  );
}
