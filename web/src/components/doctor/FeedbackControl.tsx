import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RecommendationFeedback } from '../../types';
import { useDashboardStore } from '../../state/useDashboardStore';

interface FeedbackControlProps {
  caseId: string;
  diseaseName: string;
}

const OPTIONS: Array<{ value: RecommendationFeedback; key: string }> = [
  { value: 'accurate', key: 'doctor.feedback.accurate' },
  { value: 'partially_accurate', key: 'doctor.feedback.partially' },
  { value: 'not_accurate', key: 'doctor.feedback.notAccurate' },
];

/**
 * One-click feedback for the future learning loop. Shown once a diagnosis is
 * confirmed; wired to submitRecommendationFeedback() in caseService.
 */
export function FeedbackControl({ caseId, diseaseName }: FeedbackControlProps) {
  const { t } = useTranslation();
  const submitFeedback = useDashboardStore((s) => s.submitFeedback);
  const [sent, setSent] = useState<RecommendationFeedback | null>(null);

  const onSelect = (value: RecommendationFeedback) => {
    if (sent) return; // one click per confirmation
    setSent(value);
    void submitFeedback(caseId, diseaseName, value);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-bold text-ink">{t('doctor.feedback.title')}</p>
      <p className="mb-2 text-xs font-semibold text-ink-muted">{diseaseName}</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const active = sent === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={sent !== null}
              onClick={() => onSelect(opt.value)}
              aria-pressed={active}
              className={`min-h-[44px] rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                active
                  ? 'border-primary bg-primary-light text-primary-dark'
                  : 'border-line bg-surface text-ink hover:bg-canvas'
              }`}
            >
              {t(opt.key)}
            </button>
          );
        })}
      </div>
      {sent ? (
        <p className="mt-2 text-xs font-semibold text-conf-high">
          {t('doctor.feedback.recorded')}
        </p>
      ) : null}
    </div>
  );
}

export default FeedbackControl;