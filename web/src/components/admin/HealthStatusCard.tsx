import { useTranslation } from 'react-i18next';
import type { SystemHealth } from '../../types';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';

interface HealthStatusCardProps {
  health: SystemHealth;
}

export function HealthStatusCard({ health }: HealthStatusCardProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <Card>
        <p className="text-sm font-semibold text-ink-muted">{t('admin.uptime30d')}</p>
        <p className="mt-1 text-3xl font-extrabold text-conf-high">{health.uptimePercent}%</p>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-ink-muted">{t('admin.errors24h')}</p>
        <p className="mt-1 text-3xl font-extrabold text-danger">{health.errorCount24h}</p>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-ink-muted">{t('admin.apiLatency')}</p>
        <p className="mt-1 text-3xl font-extrabold text-ink">{health.apiLatencyMs}ms</p>
      </Card>
      <Card>
        <p className="text-sm font-semibold text-ink-muted">{t('admin.offlineDevices')}</p>
        <p className="mt-1 text-3xl font-extrabold text-primary">
          {health.syncStatus.length - health.syncStatus.filter((s) => s.status === 'synced').length}
          <span className="text-base font-medium text-ink-muted"> {t('admin.pending')}</span>
        </p>
      </Card>

      <div className="lg:col-span-4">
        <Card title={t('admin.deviceSyncStatus')}>
          <ul className="divide-y divide-line">
            {health.syncStatus.map((d) => (
              <li key={d.deviceId} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="font-semibold text-ink">{d.device}</p>
                  <p className="text-xs text-ink-muted">
                    {d.deviceId} · {t('common.synced')} {new Date(d.syncedAt).toLocaleString()}
                  </p>
                </div>
                <Badge
                  label={
                    d.status === 'synced'
                      ? t('common.synced')
                      : d.status === 'pending'
                        ? t('common.pending')
                        : 'Error'
                  }
                  variant={d.status === 'synced' ? 'high' : d.status === 'pending' ? 'medium' : 'urgent'}
                />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

export default HealthStatusCard;