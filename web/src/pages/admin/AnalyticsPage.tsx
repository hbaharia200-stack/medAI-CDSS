import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminAnalytics } from '../../types';
import { getAnalytics } from '../../services/api/adminService';
import { Sidebar } from '../../components/common/Sidebar';
import { TopNav } from '../../components/common/TopNav';
import { Card } from '../../components/common/Card';
import { TrendChart } from '../../components/admin/TrendChart';
import { useAppScrollRoot } from '../../hooks/useScrollReveal';
import Reveal from '../../components/marketing/Reveal';

export function AnalyticsPage() {
  const { t } = useTranslation();
  const scrollRoot = useAppScrollRoot();
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);

  useEffect(() => {
    void getAnalytics().then(setAnalytics);
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <TopNav title={t('admin.analyticsTitle')} subtitle={t('admin.analyticsSubtitle')} />
        <main className="p-6">
          <h2 className="mb-4 text-xl font-extrabold text-ink">{t('admin.analyticsTitle')}</h2>

          {!analytics ? (
            <p className="text-ink-muted">{t('admin.loadingAnalytics')}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Reveal root={scrollRoot} className="h-full">
                  <Card className="h-full">
                    <p className="text-sm font-semibold text-ink-muted">{t('admin.recommendationCount')}</p>
                    <p className="mt-1 text-3xl font-extrabold text-ink">{analytics.recommendationCount}</p>
                  </Card>
                </Reveal>
                <Reveal root={scrollRoot} delayMs={90} className="h-full">
                  <Card className="h-full">
                    <p className="text-sm font-semibold text-ink-muted">{t('admin.diagnosesConfirmed')}</p>
                    <p className="mt-1 text-3xl font-extrabold text-conf-high">{analytics.confirmedCount}</p>
                  </Card>
                </Reveal>
                <Reveal root={scrollRoot} delayMs={180} className="h-full">
                  <Card className="h-full">
                    <p className="text-sm font-semibold text-ink-muted">{t('admin.aiAcceptanceRate')}</p>
                    <p className="mt-1 text-3xl font-extrabold text-primary">
                      {analytics.recommendationAcceptanceRate}%
                    </p>
                  </Card>
                </Reveal>
                <Reveal root={scrollRoot} delayMs={270} className="h-full">
                  <Card className="h-full">
                    <p className="text-sm font-semibold text-ink-muted">{t('admin.avgDecisionTime')}</p>
                    <p className="mt-1 text-3xl font-extrabold text-conf-medium">
                      {analytics.avgTimeToDecisionMin}min
                    </p>
                  </Card>
                </Reveal>
              </div>

              <Reveal root={scrollRoot} delayMs={90}>
                <TrendChart diseaseTrends={analytics.diseaseTrends} byRegion={analytics.byRegion} />
              </Reveal>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default AnalyticsPage;