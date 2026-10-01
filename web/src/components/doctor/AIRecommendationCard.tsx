import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AIRecommendation } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useDashboardStore } from '../../state/useDashboardStore';

interface AIRecommendationCardProps {
  caseId: string;
  recommendation: AIRecommendation;
  index: number;
}

// Stable reference for the "nothing ordered yet" case. Returning a fresh
// `[]` from a zustand selector would make useSyncExternalStore see a changed
// snapshot on every check → "Maximum update depth exceeded" blank page.
const EMPTY_ORDERED_TESTS: string[] = [];

/**
 * AIRecommendationCard — built to the exact shape the model output must map to:
 * disease name + confidence badge (never a bare number headline), one-line
 * symptom summary, "Why this suggestion?" drawer, orderable tests,
 * Confirm Diagnosis / Not This — Adjust actions.
 */
export function AIRecommendationCard({ caseId, recommendation: rec, index }: AIRecommendationCardProps) {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState<'confirm' | 'adjust' | null>(null);

  const orderedTests = useDashboardStore(
    (s) => s.orderedTests[caseId] ?? EMPTY_ORDERED_TESTS,
  );
  const toggleOrderTest = useDashboardStore((s) => s.toggleOrderTest);
  const confirmDiagnosis = useDashboardStore((s) => s.confirmDiagnosis);
  const adjustRecommendation = useDashboardStore((s) => s.adjustRecommendation);

  const ordered = (testId: string) => orderedTests.includes(testId);

  const onConfirm = async () => {
    setBusy('confirm');
    try {
      await confirmDiagnosis(caseId, index, rec.diseaseName);
    } finally {
      setBusy(null);
    }
  };

  const onAdjust = async () => {
    setBusy('adjust');
    try {
      await adjustRecommendation(caseId, index, rec.diseaseName);
    } finally {
      setBusy(null);
    }
  };

  return (
    <article className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-extrabold text-ink">{rec.diseaseName}</h4>
            <Badge confidence={rec.confidence} label={rec.confidence} />
            {rec.confidenceScore !== undefined ? (
              <span className="text-xs text-ink-muted" aria-label={`score ${Math.round(rec.confidenceScore * 100)}%`}>
                {Math.round(rec.confidenceScore * 100)}%
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-muted">{rec.topSymptomsSummary}</p>
        </div>
      </div>

      {/* Collapsible "Why?" drawer */}
      <button
        type="button"
        onClick={() => setDrawerOpen((v) => !v)}
        aria-expanded={drawerOpen}
        className="mt-3 inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary-light"
      >
        <span aria-hidden className="inline-block transition-transform" style={{ transform: drawerOpen ? 'rotate(90deg)' : undefined }}>
          ▶
        </span>
        {t('doctor.whyThisSuggestion')}
      </button>
      {drawerOpen ? (
        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-ink-muted">
          {rec.reasoningFactors.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}

      {/* Orderable tests */}
      <div className="mt-4">
        <p className="mb-1 text-sm font-bold text-ink">{t('doctor.recommendedTests')}</p>
        <ul className="space-y-1">
          {rec.recommendedTests.map((test) => (
            <li key={test.id}>
              <label className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink hover:bg-canvas">
                <input
                  type="checkbox"
                  checked={ordered(test.id)}
                  onChange={() => toggleOrderTest(caseId, test.id)}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                {test.name}
                {ordered(test.id) ? (
                  <span className="ml-auto text-xs font-semibold text-conf-high">{t('doctor.ordered')}</span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button label={t('doctor.confirmDiagnosis')} onClick={() => void onConfirm()} loading={busy === 'confirm'} icon="✓" />
        <Button label={t('doctor.notThisAdjust')} onClick={() => void onAdjust()} variant="outline" icon="↺" loading={busy === 'adjust'} />
      </div>
    </article>
  );
}

export default AIRecommendationCard;