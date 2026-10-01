import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/common/Button';
import { AlertBanner } from '../../components/common/AlertBanner';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import {
  DiagnosisStatsCard,
  PerformanceChartCard,
  SatisfactionChartCard,
} from '../../components/common/AnalyticsCharts';
import { getStatistics, toAdminAnalytics } from '../../services/api/adminService';
import type { AdminAnalytics } from '../../types';
import { useDashboardStore } from '../../state/useDashboardStore';
import { useNavigate } from 'react-router-dom';
import { useAppScrollRoot } from '../../hooks/useScrollReveal';
import Reveal from '../../components/marketing/Reveal';

const EMPTY_ANALYTICS: AdminAnalytics = {
  diseaseTrends: [],
  byRegion: [],
  recommendationAcceptanceRate: 0,
  avgTimeToDecisionMin: 0,
  recommendationCount: 0,
  confirmedCount: 0,
  patientGrowth: [],
  ageDistribution: [],
  genderSplit: [],
  diagnosisStats: [],
  performanceTrend: [],
  patientSatisfaction: [],
  patientSatisfactionAvg: 0,
};

export default function DiagnosisDashboard() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const queue = useDashboardStore((s) => s.queue);
  const loading = useDashboardStore((s) => s.queueLoading);
  const queueError = useDashboardStore((s) => s.queueError);
  const loadQueue = useDashboardStore((s) => s.loadQueue);
  // Real diagnosis counts from Flask. Empty until diagnoses exist.
  const [analytics, setAnalytics] = useState<AdminAnalytics>(EMPTY_ANALYTICS);
  const scrollRoot = useAppScrollRoot();
  useEffect(() => { void loadQueue(); }, [loadQueue]);
  useEffect(() => {
    let cancelled = false;
    getStatistics()
      .then((payload) => { if (!cancelled) setAnalytics(toAdminAnalytics(payload)); })
      .catch(() => { if (!cancelled) setAnalytics(EMPTY_ANALYTICS); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="overflow-hidden pb-1 pt-1"><h1 className="text-2xl font-extrabold text-heading">{t('nav.diagnosisDashboard')}</h1></div>
        <p className="subtitle-typewriter text-sm text-ink-muted">{t('app.systemName')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Reveal root={scrollRoot} className="h-full">
          <DiagnosisStatsCard data={analytics.diagnosisStats} />
        </Reveal>
        <Reveal root={scrollRoot} delayMs={90} className="h-full">
          <PerformanceChartCard data={analytics.performanceTrend} />
        </Reveal>
        <Reveal root={scrollRoot} delayMs={180} className="h-full">
          <SatisfactionChartCard slices={analytics.patientSatisfaction} avg={analytics.patientSatisfactionAvg} />
        </Reveal>
      </div>

      <Reveal root={scrollRoot} delayMs={90}>
      <Card>
        <div className="mb-4 flex justify-end">
          <Button label={t('common.refresh')} variant="outline" onClick={() => void loadQueue()} loading={loading} />
        </div>
        {queueError ? <AlertBanner text={t('doctor.queueLoadError')} variant="warning" /> : null}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th>{t('diagnosis.patientName')}</th>
                <th>{t('diagnosis.symptoms')}</th>
                <th>{t('diagnosis.medicalHistory')}</th>
                <th>{t('common.status')}</th>
                <th>{t('diagnosis.action')}</th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-ink-muted">{t('diagnosis.selectPatient')}</td></tr>
              ) : (
                queue.map((q) => {
                  const c = q.case;
                  return (
                    <tr key={c.id} className="border-b border-line last:border-0 transition-colors hover:bg-canvas">
                      <td className="font-bold text-ink">{c.patient.name}<span className="block text-xs font-normal text-ink-muted">#{c.id}</span></td>
                      <td className="text-xs text-ink">{c.symptoms.map((s) => s.label).join(', ')}</td>
                      <td className="text-xs text-ink-muted">{c.history?.join(', ') ?? '—'}</td>
                      <td><Badge label={c.status} variant={c.urgent ? 'urgent' : c.status === 'completed' ? 'high' : 'medium'} /></td>
                      <td>
                        <button onClick={() => nav(`/app/diagnosis/${c.id}`)} className="rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary-light">
                          {t('diagnosis.viewDetails')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Mobile stacked cards — same fields, no horizontal scroll */}
        <div className="space-y-3 md:hidden">
          {queue.length === 0 ? (
            <p className="text-center text-sm text-ink-muted">{t('diagnosis.selectPatient')}</p>
          ) : (
            queue.map((q) => {
              const c = q.case;
              return (
                <div key={c.id} className="rounded-xl border border-line bg-canvas p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-ink">{c.patient.name}</p>
                    <Badge label={c.status} variant={c.urgent ? 'urgent' : c.status === 'completed' ? 'high' : 'medium'} />
                  </div>
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between gap-2"><dt className="shrink-0 text-ink-muted">{t('diagnosis.symptoms')}</dt><dd className="text-right font-medium text-ink">{c.symptoms.map((s) => s.label).join(', ')}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="shrink-0 text-ink-muted">{t('diagnosis.medicalHistory')}</dt><dd className="truncate text-right font-medium text-ink-muted">{c.history?.join(', ') ?? '—'}</dd></div>
                  </dl>
                  <button onClick={() => nav(`/app/diagnosis/${c.id}`)} className="mt-2 w-full rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-light">
                    {t('diagnosis.viewDetails')}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </Card>
      </Reveal>
    </div>
  );
}
