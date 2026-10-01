import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatCard } from '../components/common/StatCard';
import { TrendChart } from '../components/admin/TrendChart';
import {
  AgeGenderCharts,
  GrowthLineChart,
} from '../components/common/AnalyticsCharts';
import { AlertBanner } from '../components/common/AlertBanner';
import { getStatistics, toAdminAnalytics, type StatisticsPayload } from '../services/api/adminService';
import type { AdminAnalytics } from '../types';

export default function StatisticsPage() {
  const { t } = useTranslation();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [stats, setStats] = useState<StatisticsPayload | null>(null);
  const [error, setError] = useState(false);

  // Figures come from Flask (`GET /api/statistics`). A reload re-reads the
  // database, so the page never shows a stale in-memory copy.
  useEffect(() => {
    let cancelled = false;
    setError(false);
    getStatistics()
      .then((payload) => {
        if (cancelled) return;
        setStats(payload);
        setAnalytics(toAdminAnalytics(payload));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-heading">{t('nav.statistics')}</h1>
        <AlertBanner text={t('admin.loadError')} variant="warning" />
      </div>
    );
  }

  if (!analytics || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-extrabold text-heading">{t('nav.statistics')}</h1>
        <p className="text-sm text-ink-muted">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="overflow-hidden pb-1 pt-1"><h1 className="text-2xl font-extrabold text-heading">{t('nav.statistics')}</h1></div>
        <p className="subtitle-typewriter text-sm text-ink-muted">{t('app.systemName')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('admin.diagnosesConfirmed')}
          value={stats.overview.diagnosesTotal}
          icon="stethoscope"
          iconBg="bg-conf-high-bg"
          className="animate-card-in"
        />
        <StatCard
          label={t('admin.aiAcceptanceRate')}
          value={`${analytics.recommendationAcceptanceRate}%`}
          icon="activity"
          iconBg="bg-info-bg"
          className="animate-card-in"
          style={{ animationDelay: '60ms' }}
        />
        <StatCard
          label={t('admin.avgDecisionTime')}
          value={stats.timeToDecision.averageHours != null
            ? `${analytics.avgTimeToDecisionMin} min`
            : '—'}
          icon="calendarClock"
          iconBg="bg-conf-medium-bg"
          className="animate-card-in"
          style={{ animationDelay: '120ms' }}
        />
        <StatCard
          label={t('dashboards.totalPatients')}
          value={stats.overview.totalPatients}
          icon="users"
          iconBg="bg-primary-light"
          className="animate-card-in"
          style={{ animationDelay: '180ms' }}
        />
      </div>

      <TrendChart diseaseTrends={analytics.diseaseTrends} byRegion={analytics.byRegion} />

      <GrowthLineChart data={analytics.patientGrowth} />

      <AgeGenderCharts age={analytics.ageDistribution} gender={analytics.genderSplit} />
    </div>
  );
}
