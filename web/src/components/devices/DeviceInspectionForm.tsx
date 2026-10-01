import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InspectionData } from '../../types/device';

interface DeviceInspectionFormProps {
  deviceId: string;
  deviceName: string;
  onSubmit: (data: InspectionData) => void;
  onCancel: () => void;
}

export function DeviceInspectionForm({ deviceName, onSubmit, onCancel }: DeviceInspectionFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<InspectionData>({
    physicalCondition: 'Good',
    operationalTest: 'Passed',
    safetyCheck: 'Passed',
    errorCode: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    onSubmit(form);
    setSubmitting(false);
  };

  const radioGroup = (key: keyof InspectionData, label: string, options: Array<{ value: string; label: string }>) => (
    <div className="mb-3">
      <span className="block text-xs font-semibold text-ink-muted mb-2">{label}</span>
      <div className="flex flex-wrap gap-4">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={key}
              value={opt.value}
              checked={form[key] === opt.value}
              onChange={(e) => setForm({ ...form, [key]: e.target.value as any })}
              className="w-4 h-4 text-primary border-line focus:ring-primary"
            />
            <span className="text-sm text-ink">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-lg rounded-3xl border border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-ink">{t('devices.inspectDevice')}</h2>
            <p className="text-xs font-medium text-ink-muted">{deviceName}</p>
          </div>
          <button type="button" onClick={onCancel} aria-label={t('common.close')} className="text-ink-muted transition-colors hover:text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-1">
          {radioGroup('physicalCondition', t('devices.physicalCondition'), [
            { value: 'Good', label: 'Good' },
            { value: 'Fair', label: 'Fair' },
            { value: 'Damaged', label: 'Damaged' },
          ])}
          {radioGroup('operationalTest', t('devices.operationalTest'), [
            { value: 'Passed', label: 'Passed' },
            { value: 'Failed', label: 'Failed' },
          ])}
          {radioGroup('safetyCheck', t('devices.safetyCheck'), [
            { value: 'Passed', label: 'Passed' },
            { value: 'Failed', label: 'Failed' },
          ])}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold text-ink-muted">{t('devices.errorCodeLabel')}</label>
            <input
              value={form.errorCode}
              onChange={(e) => setForm({ ...form, errorCode: e.target.value })}
              placeholder="e.g. ERR-CAL-0042"
              className="w-full rounded-lg border border-line bg-canvas p-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-semibold text-ink-muted">{t('devices.inspectionNotes')}</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Observation notes…"
              className="w-full resize-none rounded-lg border border-line bg-canvas p-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="rounded-xl border border-line bg-surface px-5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-canvas">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={submitting} className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50">
              {submitting ? t('common.loading') : t('devices.submitInspection')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DeviceInspectionForm;
