import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SystemErrorEvent, SystemHealth } from '../../types';
import { getRecentErrors, getSystemHealth } from '../../services/api/adminService';
import { Sidebar } from '../../components/common/Sidebar';
import { TopNav } from '../../components/common/TopNav';
import { HealthStatusCard } from '../../components/admin/HealthStatusCard';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { useAppScrollRoot } from '../../hooks/useScrollReveal';
import Reveal from '../../components/marketing/Reveal';

function timeAgo(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Recent errors / warnings feed (mocked) — error monitoring. */
function RecentErrorsList({ events }: { events: SystemErrorEvent[] }) {
  const { t } = useTranslation();
  if (events.length === 0) {
    return <p className="text-sm text-ink-muted">{t('admin.noRecentErrors')}</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {events.map((e) => (
        <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{e.message}</p>
            <p className="text-xs text-ink-muted">
              {e.source} · {timeAgo(e.timestamp)}
            </p>
          </div>
          <Badge
            label={e.level === 'error' ? t('admin.errLevelError') : t('admin.errLevelWarning')}
            variant={e.level === 'error' ? 'urgent' : 'medium'}
          />
        </li>
      ))}
    </ul>
  );
}

export function SystemHealthPage() {
  const { t } = useTranslation();
  const scrollRoot = useAppScrollRoot();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [errors, setErrors] = useState<SystemErrorEvent[] | null>(null);

  useEffect(() => {
    void getSystemHealth().then(setHealth);
    void getRecentErrors().then(setErrors);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <TopNav title={t('admin.systemHealthTitle')} subtitle={t('admin.systemHealthSubtitle')} />
        <main className="p-6">
          <h2 className="mb-4 text-xl font-extrabold text-ink">{t('admin.systemHealthTitle')}</h2>
          {health ? (
            <Reveal root={scrollRoot}>
              <HealthStatusCard health={health} />
            </Reveal>
          ) : (
            <p className="text-ink-muted">{t('admin.loadingHealth')}</p>
          )}

          <div className="mt-4">
            <Reveal root={scrollRoot} delayMs={90}>
            <Card title={t('admin.recentErrors')}>
              {errors ? (
                <RecentErrorsList events={errors} />
              ) : (
                <p className="text-sm text-ink-muted">{t('admin.loadingHealth')}</p>
              )}
            </Card>
            </Reveal>
          </div>
        </main>
      </div>
    </div>
  );
}

export default SystemHealthPage;