import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardStore } from '../../state/useDashboardStore';
import { isEmergencyCase } from '../../utils/emergencyGuardrails';
import { PatientQueueList } from '../../components/doctor/PatientQueueList';
import { PatientSummaryPanel } from '../../components/doctor/PatientSummaryPanel';
import { AIRecommendationsPanel } from '../../components/doctor/AIRecommendationsPanel';
import { EmergencyBanner } from '../../components/doctor/EmergencyBanner';
import { FeedbackControl } from '../../components/doctor/FeedbackControl';
import { TopNav } from '../../components/common/TopNav';

type PanelTab = 'queue' | 'summary' | 'ai';

export function DashboardPage() {
  const { t } = useTranslation();
  const queue = useDashboardStore((s) => s.queue);
  const queueLoading = useDashboardStore((s) => s.queueLoading);
  const queueError = useDashboardStore((s) => s.queueError);
  const loadQueue = useDashboardStore((s) => s.loadQueue);
  const selectedCaseId = useDashboardStore((s) => s.selectedCaseId);
  const completedCaseIds = useDashboardStore((s) => s.completedCaseIds);
  const decisions = useDashboardStore((s) => s.decisions);
  const [tab, setTab] = useState<PanelTab>('summary');

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const selectedCase = queue.find((q) => q.case.id === selectedCaseId) ?? null;
  const emergencyCases = queue.filter((q) =>
    isEmergencyCase(q.case), // rule-based guardrail over real queue records
  );
  const hasEmergencyCase = emergencyCases.length > 0;
  const caseIsCompleted = selectedCase
    ? completedCaseIds.includes(selectedCase.case.id)
    : false;
  const confirmedRec = selectedCase
    ? [...decisions]
        .reverse()
        .find((d) => d.caseId === selectedCase.case.id && d.decision === 'confirmed')
    : undefined;

  const tabs: Array<{ key: PanelTab; label: string; icon: string; count?: number }> = [
    { key: 'queue', label: t('doctor.tabs.queue'), icon: '👥', count: queue.length },
    { key: 'summary', label: t('doctor.tabs.patient'), icon: '🗂️' },
    { key: 'ai', label: t('doctor.tabs.ai'), icon: '🤖' },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {hasEmergencyCase ? (
        <EmergencyBanner
          text={t('doctor.emergencyBanner')}
          names={emergencyCases.map((q) => q.case.patient.name)}
        />
      ) : null}

      <TopNav title={t('doctor.dashboardTitle')} subtitle={t('doctor.dashboardSubtitle')} />

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)_480px]">
        <div className={`lg:block ${tab === 'queue' ? 'block' : 'hidden'}`}>
          <PatientQueueList queue={queue} />
        </div>

        <div className={`min-w-0 ${tab === 'summary' ? 'block' : 'hidden'} lg:block`}>
          {queueLoading ? (
            <p className="text-ink-muted">{t('doctor.loadingQueue')}</p>
          ) : queueError === 'offline-no-cache' ? (
            <p className="text-danger">{t('doctor.offlineNoCache')}</p>
          ) : (
            <PatientSummaryPanel caseData={selectedCase?.case ?? null} />
          )}

          {caseIsCompleted && confirmedRec ? (
            <div className="mt-3">
              <FeedbackControl
                caseId={selectedCase!.case.id}
                diseaseName={confirmedRec.diseaseName}
              />
            </div>
          ) : null}
        </div>

        <div className={`min-w-0 ${tab === 'ai' ? 'block' : 'hidden'} lg:block`}>
          <AIRecommendationsPanel caseId={selectedCase?.case.id ?? null} />
        </div>
      </div>

      <nav aria-label="Panels" className="sticky bottom-0 border-t border-line bg-surface p-2 lg:hidden">
        <div className="flex gap-2">
          {tabs.map((tp) => (
            <button
              key={tp.key}
              type="button"
              onClick={() => setTab(tp.key)}
              aria-pressed={tab === tp.key}
              className={`flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border-2 font-semibold ${
                tab === tp.key
                  ? 'border-primary bg-primary-light text-primary-dark'
                  : 'border-line bg-surface text-ink-muted'
              }`}
            >
              <span aria-hidden>{tp.icon}</span>
              {tp.label}
              {tp.count !== undefined ? (
                <span className="rounded-full bg-conf-low-bg px-2 py-0.5 text-xs">{tp.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default DashboardPage;