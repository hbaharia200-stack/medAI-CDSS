import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardStore } from '../../state/useDashboardStore';
import { AIRecommendationCard } from './AIRecommendationCard';
import { AlertBanner } from '../common/AlertBanner';
import { Button } from '../common/Button';

interface AIRecommendationsPanelProps {
  caseId: string | null;
}

/**
 * Ranked list of AIRecommendationCard for the selected case.
 * Persistent safety text sits right below the panel header.
 */
export function AIRecommendationsPanel({ caseId }: AIRecommendationsPanelProps) {
  const { t } = useTranslation();
  const recommendations = useDashboardStore((s) =>
    caseId ? s.recommendations[caseId] : undefined,
  );
  const loading = useDashboardStore((s) =>
    caseId ? s.loadingRecs[caseId] : false,
  );
  const recError = useDashboardStore((s) => s.recError);
  const recSource = useDashboardStore((s) => s.recSource);
  const loadRecommendations = useDashboardStore((s) => s.loadRecommendations);
  const selectedCaseId = useDashboardStore((s) => s.selectedCaseId);

  React.useEffect(() => {
    if (caseId && !recommendations && !loading && !recError) {
      void loadRecommendations(caseId);
    }
  }, [caseId, recommendations, loading, recError, loadRecommendations]);

  return (
    <section aria-label={t('doctor.aiPanelTitle')} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-ink">{t('doctor.aiPanelTitle')}</h2>
          {/* Required safety & trust text — final decision is always the doctor's. */}
          <p className="text-xs font-semibold text-ink-muted">
            {t('doctor.aiSuggestionText')}
          </p>
        </div>
        {recSource === 'cache' ? (
          <span className="rounded-full bg-conf-medium-bg px-2 py-0.5 text-xs font-semibold text-conf-medium">
            {t('common.lastKnownCache')}
          </span>
        ) : null}
      </div>

      {selectedCaseId && recError === 'offline-no-cache' ? (
        <AlertBanner
          text={t('doctor.connectivityMessage')}
          variant="warning"
          action={
            <Button
              label={t('common.retry')}
              variant="outline"
              onClick={() => void loadRecommendations(caseId!)}
              icon="⟳"
            />
          }
        />
      ) : null}

      {!caseId ? (
        <AlertBanner text={t('doctor.recommendationsEmpty')} variant="info" />
      ) : loading && !recommendations ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-ink-muted">
          <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {t('doctor.fetchingRecommendations')}
        </div>
      ) : recommendations?.length === 0 ? (
        <AlertBanner text={t('doctor.noStoredRecommendations')} variant="info" />
      ) : recommendations ? (
        recommendations.map((rec, idx) => (
          <AIRecommendationCard
            key={`${rec.diseaseName}-${idx}`}
            caseId={caseId}
            recommendation={rec}
            index={idx}
          />
        ))
      ) : null}
    </section>
  );
}

export default AIRecommendationsPanel;