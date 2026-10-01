import type { QueueCase } from '../../types';
import { useTranslation } from 'react-i18next';
import { Badge } from '../common/Badge';
import { useDashboardStore } from '../../state/useDashboardStore';
import { sortQueue } from '../../utils/queueSort';

interface PatientQueueListProps {
  queue: QueueCase[];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Left panel: live queue sorted by arrival, urgent pinned to top. */
export function PatientQueueList({ queue }: PatientQueueListProps) {
  const { t } = useTranslation();
  const selectedCaseId = useDashboardStore((s) => s.selectedCaseId);
  const selectCase = useDashboardStore((s) => s.selectCase);
  const loadRecommendations = useDashboardStore((s) => s.loadRecommendations);

  const sorted = sortQueue(queue);

  return (
    <section aria-label={t('doctor.patientQueueTitle')} className="flex flex-col gap-2">
      <h2 className="text-lg font-extrabold text-ink">{t('doctor.patientQueueTitle')}</h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('doctor.queueEmpty')}</p>
      ) : (
        sorted.map((row) => {
          const c = row.case;
          const active = c.id === selectedCaseId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                selectCase(c.id);
                void loadRecommendations(c.id);
              }}
              aria-pressed={active}
              className={`flex flex-col gap-1 rounded-2xl border-2 p-4 text-left transition-colors ${
                active
                  ? 'border-primary bg-primary-light'
                  : 'border-line bg-surface hover:border-primary'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-extrabold text-ink">{c.patient.name}</h3>
                {c.urgent ? (
                  <Badge label={t('doctor.urgent')} variant="urgent" icon="🚨" />
                ) : null}
              </div>
              <p className="text-sm text-ink-muted">
                {c.patient.age} · {c.patient.sex}
              </p>
              <p className="text-sm font-medium text-ink">{c.chiefComplaint}</p>
              <p className="text-xs font-semibold text-ink-muted">
                {t('doctor.arrived')} {formatTime(c.createdAt)}
              </p>
            </button>
          );
        })
      )}
    </section>
  );
}

export default PatientQueueList;