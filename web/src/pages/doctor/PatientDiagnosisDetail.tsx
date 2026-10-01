import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useState } from 'react';
import { useDashboardStore } from '../../state/useDashboardStore';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { AlertBanner } from '../../components/common/AlertBanner';
import { AIRecommendationsPanel } from '../../components/doctor/AIRecommendationsPanel';
import { PatientSummaryPanel } from '../../components/doctor/PatientSummaryPanel';
import { getCase } from '../../services/api/caseService';
import {
  getAssignmentsForCase,
  getTestCatalogue,
  postRecommendationData,
} from '../../services/api/recommendationService';
import type { Case, RecommendedTest, RecommendedTestAssignment } from '../../types';

const EMPTY_TEST_IDS: string[] = [];

export default function PatientDiagnosisDetail() {
  const { caseId } = useParams<{ caseId: string }>();
  const { t } = useTranslation();
  const nav = useNavigate();
  const selectCase = useDashboardStore((s) => s.selectCase);
  const orderedIds = useDashboardStore((s) => caseId ? s.orderedTests[caseId] ?? EMPTY_TEST_IDS : EMPTY_TEST_IDS);
  const toggleOrderTest = useDashboardStore((s) => s.toggleOrderTest);
  const [caseData, setCaseData] = useState<Case | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [catalogue, setCatalogue] = useState<RecommendedTest[]>([]);
  const [manualTests, setManualTests] = useState<RecommendedTest[]>([]);
  const [testName, setTestName] = useState('');
  const [testType, setTestType] = useState<'lab' | 'vital'>('lab');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  // Test assignments already dispatched for this case, re-read from the backend
  // so the doctor sees the nurse's status changes (and never a stale copy).
  const [assignments, setAssignments] = useState<RecommendedTestAssignment[]>([]);

  const loadAssignments = useCallback(async () => {
    if (!caseId) return;
    try {
      setAssignments(await getAssignmentsForCase(caseId));
    } catch {
      setAssignments([]);
    }
  }, [caseId]);

  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    selectCase(caseId);
    setLoading(true);
    setLoadError(false);
    setSent(false);
    setManualTests([]);
    void getCase(caseId).then((record) => {
      if (!cancelled) setCaseData(record);
    }).catch(() => {
      if (!cancelled) setLoadError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    void getTestCatalogue().then((tests) => {
      if (!cancelled) setCatalogue(tests);
    }).catch(() => {
      if (!cancelled) setCatalogue([]);
    });
    void getAssignmentsForCase(caseId).then((rows) => {
      if (!cancelled) setAssignments(rows);
    }).catch(() => {
      if (!cancelled) setAssignments([]);
    });
    return () => { cancelled = true; };
  }, [caseId, selectCase]);

  const addManualTest = () => {
    const name = testName.trim();
    if (!name || !caseId || sending || sent) return;
    const test = { id: `doctor-${crypto.randomUUID()}`, name, type: testType };
    setManualTests((tests) => [...tests, test]);
    toggleOrderTest(caseId, test.id);
    setTestName('');
  };

  const handleSendToNurse = async () => {
    if (!caseId || sending || sent) return;
    const recs = useDashboardStore.getState().recommendations[caseId] ?? [];
    const tests = [...catalogue, ...manualTests, ...recs.flatMap((rec) => rec.recommendedTests)]
      .filter((test, index, all) => orderedIds.includes(test.id) && all.findIndex((candidate) => candidate.id === test.id) === index);
    if (tests.length === 0) return;
    setSending(true);
    setSendError(false);
    try {
      await postRecommendationData({ caseId, tests });
      setSent(true);
      setCaseData((record) => record ? { ...record, status: 'sent_to_nurse' } : record);
      // Re-read from the backend so the panel below shows the persisted row.
      await loadAssignments();
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  };

  if (loading || loadError || !caseData || caseData.id !== caseId) {
    return (
      <div className="space-y-4">
        <Button label={t('common.back')} variant="outline" onClick={() => nav('/app/diagnosis')} icon="←" />
        <AlertBanner text={t(loading ? 'common.loading' : loadError ? 'doctor.queueLoadError' : 'diagnosis.selectPatient')} variant={loadError ? 'warning' : 'info'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button label={t('common.back')} variant="outline" onClick={() => nav('/app/diagnosis')} icon="←" />
        <div>
          <div className="overflow-hidden pb-1 pt-1"><h1 className="text-2xl font-extrabold text-heading">{t('diagnosis.diagnosisDetail')} — {caseData.patient.name}</h1></div>
          <p className="subtitle-typewriter text-sm text-ink-muted">#{caseData.id}</p>
        </div>
      </div>
      {sent ? <AlertBanner text={t('diagnosis.sendToNurseSuccess')} variant="info" /> : null}
      {sendError ? <AlertBanner text={t('doctor.sendTestsError')} variant="warning" /> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <PatientSummaryPanel caseData={caseData} />
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-lg font-bold text-ink">{t('diagnosis.aiDecisionSupport')}</h3>
            <p className="text-xs font-semibold text-ink-muted">{t('diagnosis.doctorReviewRequired')}</p>
          </Card>
          <AIRecommendationsPanel caseId={caseId ?? null} />
          <Card title={t('diagnosis.dispatchedTests')}>
            {assignments.length === 0 ? (
              <p className="text-sm text-ink-muted">{t('diagnosis.noDispatchedTests')}</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="rounded-xl border border-line bg-canvas p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-ink-muted">
                        {assignment.id.slice(0, 8)} · {new Date(assignment.createdAt).toLocaleString()}
                      </span>
                      <Badge
                        label={assignment.status}
                        variant={assignment.status === 'completed' ? 'high' : assignment.status === 'acknowledged' ? 'medium' : 'neutral'}
                      />
                    </div>
                    <ul className="space-y-1">
                      {assignment.tests.map((test) => (
                        <li key={test.id} className="text-sm text-ink">
                          • {test.name}
                          <span className="ml-2 text-xs text-ink-muted">
                            {test.type ?? 'lab'}
                            {assignment.acknowledgedAt
                              ? ` · started ${new Date(assignment.acknowledgedAt).toLocaleString()}`
                              : ''}
                            {assignment.completedAt
                              ? ` · completed ${new Date(assignment.completedAt).toLocaleString()}`
                              : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <Button
                  label={t('common.refresh')}
                  variant="outline"
                  onClick={() => void loadAssignments()}
                  icon="⟳"
                />
              </div>
            )}
          </Card>
          <Card title={t('doctor.selectTests')}>
            <p className="mb-3 text-sm text-ink-muted">{t('doctor.testAssignmentNote')}</p>
            <div className="space-y-2">
              {[...catalogue, ...manualTests].map((test) => (
                <label key={test.id} className="flex min-h-10 items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={orderedIds.includes(test.id)} disabled={sending || sent} onChange={() => toggleOrderTest(caseData.id, test.id)} />
                  {test.name}
                </label>
              ))}
            </div>
            <label className="mt-3 block text-sm font-semibold text-ink">
              {t('doctor.testName')}
              <input value={testName} onChange={(event) => setTestName(event.target.value)} disabled={sending || sent} className="mt-1 w-full rounded-xl border border-line bg-canvas px-3 py-2" />
            </label>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm font-semibold text-ink">
                {t('doctor.testType')}
                <select value={testType} onChange={(event) => setTestType(event.target.value as 'lab' | 'vital')} disabled={sending || sent} className="ml-2 rounded-xl border border-line bg-canvas p-2">
                  <option value="lab">{t('doctor.labTest')}</option>
                  <option value="vital">{t('doctor.vitalMeasurement')}</option>
                </select>
              </label>
              <Button label={t('doctor.addTest')} variant="outline" onClick={addManualTest} disabled={!testName.trim() || sending || sent} />
            </div>
          </Card>
          <Button label={t('diagnosis.sendToNurse')} variant="primary" icon="📋" onClick={() => void handleSendToNurse()} loading={sending} disabled={sending || sent || orderedIds.length === 0} />
        </div>
      </div>
    </div>
  );
}
