import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Icons } from '../common/Icons';
import {
  createAppointment,
  type AppointmentConfirmation,
  type AppointmentRequest,
} from '../../services/api/appointmentService';

/**
 * Public appointment request form.
 *
 * Collects exactly the fields documented by appointmentService
 * (patientName, phone, email, doctor, preferredDate, preferredTime, reason)
 * and posts them through createAppointment. The booking is persisted by Flask in
 * the `appointments` table; a failure shows an error instead of a confirmation.
 */

const DOCTOR_KEYS = [
  'appointment.doctorGeneral',
  'appointment.doctorInternal',
  'appointment.doctorCardiology',
  'appointment.doctorPediatrics',
  'appointment.doctorSurgery',
] as const;

const INPUT_CLASS =
  'h-12 w-full rounded-xl border-2 border-line bg-canvas px-4 text-ink focus:border-primary focus:outline-none';

interface FormState {
  patientName: string;
  phone: string;
  email: string;
  doctor: string;
  preferredDate: string;
  preferredTime: string;
  reason: string;
}

const EMPTY_FORM: FormState = {
  patientName: '',
  phone: '',
  email: '',
  doctor: '',
  preferredDate: '',
  preferredTime: '',
  reason: '',
};

/** Today as YYYY-MM-DD in local time (avoids UTC off-by-one near midnight). */
function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function AppointmentForm() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<AppointmentConfirmation | null>(null);

  const set =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async () => {
    if (!form.patientName.trim() || !form.phone.trim() || !form.preferredDate || !form.preferredTime) {
      setError(t('appointment.errorRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    const request: AppointmentRequest = {
      patientName: form.patientName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      doctor: form.doctor || undefined,
      preferredDate: form.preferredDate,
      preferredTime: form.preferredTime,
      reason: form.reason.trim() || undefined,
    };
    try {
      setConfirmation(await createAppointment(request));
    } catch {
      setError(t('appointment.errorSubmit'));
    } finally {
      setBusy(false);
    }
  };

  if (confirmation) {
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
          <Icons.check width={24} height={24} />
        </div>
        <h2 className="text-center text-xl font-bold text-heading">{t('appointment.successTitle')}</h2>
        <p className="mt-2 text-center text-sm text-ink-muted">{t('appointment.successDesc')}</p>

        <dl className="mt-5 grid gap-3 rounded-xl border border-line bg-canvas px-4 py-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {t('appointment.referenceLabel')}
            </dt>
            <dd className="font-mono text-ink">{confirmation.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{t('common.status')}</dt>
            <dd className="font-semibold text-primary">{t('common.pending')}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            label={t('appointment.ctaBookAnother')}
            onClick={() => {
              setForm(EMPTY_FORM);
              setConfirmation(null);
              setError(null);
            }}
          />
          <Button label={t('appointment.backHome')} variant="secondary" onClick={() => nav('/')} />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-xl font-bold text-heading">{t('appointment.formTitle')}</h2>
      <p className="mt-2 text-sm text-ink-muted">{t('appointment.formDesc')}</p>

      {error ? (
        <div role="alert" className="mt-4 rounded-xl border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">
            {t('appointment.nameLabel')} <span aria-hidden="true">*</span>
          </span>
          <input
            value={form.patientName}
            onChange={set('patientName')}
            placeholder={t('appointment.namePlaceholder')}
            autoComplete="name"
            required
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">
            {t('appointment.phoneLabel')} <span aria-hidden="true">*</span>
          </span>
          <input
            value={form.phone}
            onChange={set('phone')}
            placeholder={t('appointment.phonePlaceholder')}
            type="tel"
            autoComplete="tel"
            required
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('appointment.emailLabel')}</span>
          <input
            value={form.email}
            onChange={set('email')}
            placeholder={t('appointment.emailPlaceholder')}
            type="email"
            autoComplete="email"
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">{t('appointment.doctorLabel')}</span>
          <select value={form.doctor} onChange={set('doctor')} className={INPUT_CLASS}>
            <option value="">{t('appointment.doctorPlaceholder')}</option>
            {DOCTOR_KEYS.map((key) => (
              <option key={key} value={t(key)}>
                {t(key)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">
            {t('appointment.dateLabel')} <span aria-hidden="true">*</span>
          </span>
          <input
            value={form.preferredDate}
            onChange={set('preferredDate')}
            type="date"
            min={todayIso()}
            required
            className={INPUT_CLASS}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">
            {t('appointment.timeLabel')} <span aria-hidden="true">*</span>
          </span>
          <input
            value={form.preferredTime}
            onChange={set('preferredTime')}
            type="time"
            step={900}
            required
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-semibold">{t('appointment.reasonLabel')}</span>
        <textarea
          value={form.reason}
          onChange={set('reason')}
          placeholder={t('appointment.reasonPlaceholder')}
          rows={4}
          className="w-full rounded-xl border-2 border-line bg-canvas px-4 py-3 text-ink focus:border-primary focus:outline-none"
        />
      </label>

      <p className="mt-2 text-xs text-ink-muted">{t('appointment.requiredHint')}</p>

      <div className="mt-6">
        <Button label={t('appointment.submitLabel')} onClick={() => void onSubmit()} loading={busy} />
      </div>
    </Card>
  );
}

export { AppointmentForm };