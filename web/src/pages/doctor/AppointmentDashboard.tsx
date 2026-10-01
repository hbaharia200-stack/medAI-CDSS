import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { useAppScrollRoot } from '../../hooks/useScrollReveal';
import Reveal from '../../components/marketing/Reveal';
import {
  listAppointments,
  localISODate,
  todayLocalISO,
  type AppointmentRow,
} from '../../services/api/appointmentService';

/**
 * Doctor appointment dashboard.
 *
 * Every row here comes from `GET /api/appointments` — the same endpoint the
 * Basic Dashboard's "Today's Schedule" reads. This screen previously rendered
 * three hard-coded arrays (invented patients, invented times, invented
 * "TZS 25,000" fees), which is why a real booking made by a patient appeared
 * in one dashboard and not the other.
 *
 * Tabs are derived from real rows in the APPLICATION timezone:
 *   today   -> appointment date == today
 *   upcoming-> appointment date > today, not cancelled
 *   recent  -> appointment date < today (or cancelled), newest first
 */
const TABS = [
  { key: 'today', label: 'todaysAppointments' },
  { key: 'upcoming', label: 'upcoming' },
  { key: 'recent', label: 'recent' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function feeLabel(row: AppointmentRow): string | null {
  // Only ever show a fee the facility actually configured. No default figure
  // is invented when the backend returns null/0.
  const fees = row.fees;
  if (fees === null || fees === undefined || Number(fees) === 0) return null;
  return `TZS ${Number(fees).toLocaleString()}`;
}

export default function AppointmentDashboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('today');
  const [rows, setRows] = useState<AppointmentRow[] | null>(null);
  const [error, setError] = useState(false);
  const scrollRoot = useAppScrollRoot();

  const load = useCallback(async () => {
    setError(false);
    try {
      // Ask the backend for today..+1y in one call and bucket client-side, so
      // both the counts and the lists come from the same source of truth.
      const data = await listAppointments({
        from: todayLocalISO(),
        to: localISODate(365),
        limit: 500,
        order: 'asc',
      });
      setRows(data);
    } catch {
      setRows([]);
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayLocalISO();
  const todayRows = (rows ?? []).filter((r) => r.date === today);
  const upcomingRows = (rows ?? [])
    .filter((r) => (r.date ?? '') > today && r.status !== 'cancelled')
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  const recentRows = (rows ?? [])
    .filter((r) => (r.date ?? '') < today || r.status === 'cancelled')
    .sort((a, b) => (b.startTime ?? '').localeCompare(a.startTime ?? ''));

  const counts: Record<TabKey, number> = {
    today: todayRows.length,
    upcoming: upcomingRows.length,
    recent: recentRows.length,
  };

  const getList = (): AppointmentRow[] => {
    if (activeTab === 'today') return todayRows;
    if (activeTab === 'upcoming') return upcomingRows;
    return recentRows;
  };

  const getTitle = () => {
    if (activeTab === 'today') return t('dashboards.todaysAppointments');
    if (activeTab === 'upcoming') return t('appointments.upcoming');
    return t('appointments.recent');
  };

  const list = getList();

  return (
    <div className="space-y-6">
      <div>
        <div className="overflow-hidden pb-1 pt-1"><h1 className="text-2xl font-extrabold text-heading">{t('appointments.title')}</h1></div>
        <p className="subtitle-typewriter text-sm text-ink-muted">{t('app.systemName')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {TABS.map((tab, i) => {
          const isActive = activeTab === tab.key;
          return (
            <Reveal key={tab.key} root={scrollRoot} delayMs={i * 90} className="h-full">
              <button
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`h-full w-full rounded-2xl border bg-surface p-5 text-left transition-all hover:shadow-card ${
                  isActive
                    ? 'border-primary shadow-card ring-1 ring-primary/20'
                    : 'border-line hover:border-primary/40'
                }`}
              >
                <p className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-ink-muted'}`}>
                  {t(tab.key === 'today' ? 'dashboards.todaysAppointments' : `appointments.${tab.label}`)}
                </p>
                {/* Real count for this tab, not a hard-coded array length. */}
                <p className="mt-1 text-3xl font-extrabold text-ink">
                  {rows === null ? '—' : counts[tab.key]}
                </p>
              </button>
            </Reveal>
          );
        })}
      </div>

      {error ? <AlertBanner text={t('appointments.loadError')} variant="warning" /> : null}

      <Reveal root={scrollRoot} delayMs={90}>
      <Card title={getTitle()}>
        {rows === null ? (
          <p className="py-4 text-sm text-ink-muted">{t('common.loading')}</p>
        ) : list.length === 0 ? (
          <p className="py-4 text-sm text-ink-muted">{t('appointments.empty')}</p>
        ) : (
        <div className="space-y-3">
          {list.map((a, i) => {
            const fees = feeLabel(a);
            return (
            <Reveal key={a.id} root={scrollRoot} delayMs={i * 90}>
            <div className="flex items-center justify-between rounded-xl border border-line bg-canvas p-4 card-polished-light">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-sm font-bold text-primary">
                  {a.time ?? '—'}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{a.patientName ?? '—'}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {[a.reason ?? a.title, a.patientPhone].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <Badge
                  label={a.status}
                  variant={a.status === 'confirmed' ? 'high' : a.status === 'cancelled' ? 'urgent' : 'medium'}
                />
                {/* Only rendered when the facility configured a real fee. */}
                {fees ? <p className="mt-1 text-xs font-semibold text-ink">{fees}</p> : null}
              </div>
            </div>
            </Reveal>
            );
          })}
        </div>
        )}
      </Card>
      </Reveal>
    </div>
  );
}
