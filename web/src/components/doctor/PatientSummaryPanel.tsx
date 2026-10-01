import type { Case } from '../../types';
import { useTranslation } from 'react-i18next';
import { Card } from '../common/Card';
import { AlertBanner } from '../common/AlertBanner';
import {
  checkBloodPressure,
  checkHeartRate,
  checkRespiratoryRate,
  checkTemperature,
  hasUrgentVitals,
  type VitalCheck,
} from '../../utils/vitalRanges';

interface PatientSummaryPanelProps {
  caseData: Case | null;
}

// Weight has no fixed normal range — treated as informational only.
const NO_CHECK: VitalCheck = { status: 'normal', urgent: false };

function VitalStat({
  label,
  value,
  unit,
  hint,
  check,
}: {
  label: string;
  value?: number | string;
  unit?: string;
  hint?: string;
  check: VitalCheck;
}) {
  const { t } = useTranslation();
  if (value === undefined || value === null || value === '') return null;
  const severe = check.urgent;
  const abnormal = check.status === 'high' || check.status === 'low';
  const boxCls = severe
    ? 'border-danger bg-danger-bg'
    : abnormal
      ? 'border-conf-medium bg-conf-medium-bg'
      : 'border-line bg-canvas';
  const valueCls = severe ? 'text-danger' : abnormal ? 'text-conf-medium' : 'text-ink';
  const statusLabel = severe
    ? t('doctor.vitalSevere')
    : abnormal
      ? check.status === 'high'
        ? t('doctor.vitalHigh')
        : t('doctor.vitalLow')
      : null;
  return (
    <div className={`rounded-xl border p-3 text-center ${boxCls}`}>
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className={`text-lg font-extrabold ${valueCls}`}>
        {value}
        {unit ? <span className="ml-0.5 text-xs font-medium">{unit}</span> : null}
      </p>
      {statusLabel ? (
        <p
          className={`text-[11px] font-extrabold uppercase ${
            severe ? 'text-danger' : 'text-conf-medium'
          }`}
        >
          {statusLabel}
        </p>
      ) : null}
      {hint ? <p className="mt-0.5 text-[11px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

/** Center panel: vitals, structured symptoms, relevant history in compact cards. */
export function PatientSummaryPanel({ caseData: c }: PatientSummaryPanelProps) {
  const { t } = useTranslation();
  if (!c) {
    return (
      <section aria-label={t('doctor.patientSummary')}>
        <Card>
          <p className="text-ink-muted">{t('doctor.selectedPatient')}</p>
        </Card>
      </section>
    );
  }

  const v = c.vitals;
  return (
    <section aria-label={t('doctor.patientSummary')} className="flex flex-col gap-3">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-ink">{c.patient.name}</h2>
            <p className="text-sm text-ink-muted">
              {c.patient.age} · {c.patient.sex} · {c.patient.phone}
            </p>
          </div>
          <span className="text-xs font-semibold text-ink-muted">#{c.id}</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-primary">{c.chiefComplaint}</p>
        <p className="mt-2 text-sm text-ink-muted">{t('common.status')}: {c.status}</p>
      </Card>

      <Card title={t('doctor.vitals')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <VitalStat
            label={t('doctor.vitalTemperature')}
            value={v?.temperatureC}
            unit="°C"
            hint={t('doctor.rangeTemp')}
            check={checkTemperature(v?.temperatureC)}
          />
          <VitalStat
            label={t('doctor.vitalBp')}
            value={
              v?.bloodPressureSystolic && v?.bloodPressureDiastolic
                ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`
                : undefined
            }
            unit="mmHg"
            hint={t('doctor.rangeBp')}
            check={checkBloodPressure(v?.bloodPressureSystolic, v?.bloodPressureDiastolic)}
          />
          <VitalStat
            label={t('doctor.vitalHr')}
            value={v?.heartRate}
            unit="bpm"
            hint={t('doctor.rangeHr')}
            check={checkHeartRate(v?.heartRate)}
          />
          <VitalStat
            label={t('doctor.vitalRr')}
            value={v?.respiratoryRate}
            unit="bpm"
            hint={t('doctor.rangeRr')}
            check={checkRespiratoryRate(v?.respiratoryRate)}
          />
          <VitalStat
            label={t('doctor.vitalWeight')}
            value={v?.weightKg}
            unit="kg"
            check={NO_CHECK}
          />
        </div>
        {hasUrgentVitals(v) ? (
          <div className="mt-2">
            <AlertBanner text={t('doctor.vitalsSevereNote')} variant="warning" />
          </div>
        ) : null}
      </Card>

      <Card title={t('doctor.structuredSymptoms')}>
        {c.symptoms.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('doctor.noStructuredSymptoms')}</p>
        ) : (
          <ul className="space-y-1.5">
            {c.symptoms.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-ink">
                  <span aria-hidden className="mr-2 text-primary">•</span>
                  {s.label}
                </span>
                {s.severity ? (
                  <span className="text-xs text-ink-muted">severity {s.severity}/5</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {c.followUpAnswers.length > 0 ? (
        <Card title={t('doctor.followUpAnswers')}>
          <dl className="space-y-2 text-sm">
            {c.followUpAnswers.map((answer) => (
              <div key={answer.questionId}>
                <dt className="font-semibold text-ink">{answer.question}</dt>
                <dd className="text-ink-muted">{answer.answer === null ? t('doctor.notSure') : typeof answer.answer === 'boolean' ? t(answer.answer ? 'doctor.yes' : 'doctor.no') : answer.answer}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      {c.location ? (
        <Card title={t('doctor.caseLocation')}>
          <p className="text-sm text-ink">{c.location.latitude.toFixed(5)}, {c.location.longitude.toFixed(5)}</p>
        </Card>
      ) : null}

      {c.history && c.history.length > 0 ? (
        <Card title={t('doctor.relevantHistory')}>
          <ul className="space-y-1">
            {c.history.map((h) => (
              <li key={h} className="text-sm text-ink-muted">
                <span aria-hidden className="mr-2 text-conf-medium">📁</span>
                {h}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </section>
  );
}

export default PatientSummaryPanel;