import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface FormData {
  deviceName: string;
  deviceNumber: string;
  deviceType: string;
  category: string;
  department: string;
  location: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  installationDate: string;
  warrantyExpiry: string;
  maintenanceInterval: string;
  image: string;
}

interface DeviceRegistrationFormProps {
  onClose: () => void;
  onRegister: (data: FormData) => void;
}

export function DeviceRegistrationForm({ onClose, onRegister }: DeviceRegistrationFormProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormData>({
    deviceName: '', deviceNumber: '', deviceType: '', category: '', department: '', location: '',
    manufacturer: '', model: '', serialNumber: '', firmwareVersion: '',
    installationDate: '', warrantyExpiry: '', maintenanceInterval: '', image: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    if (!form.deviceName.trim()) newErrors.deviceName = 'This field is required';
    if (!form.deviceNumber.trim()) newErrors.deviceNumber = 'This field is required';
    if (!form.deviceType.trim()) newErrors.deviceType = 'This field is required';
    if (!form.category.trim()) newErrors.category = 'This field is required';
    if (!form.department.trim()) newErrors.department = 'This field is required';
    if (!form.location.trim()) newErrors.location = 'This field is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    onRegister(form);
    setSubmitting(false);
    onClose();
  };

  const inputClass = (field: keyof FormData) =>
    `w-full rounded-lg border ${errors[field] ? 'border-danger' : 'border-line'} bg-canvas p-2.5 text-sm text-ink outline-none focus:border-primary transition-colors`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <h2 className="text-lg font-bold text-ink">{t('devices.registerDevice')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-name">
                {t('devices.deviceNameLabel')} *
              </label>
              <input id="f-name" value={form.deviceName} onChange={(e) => setForm({ ...form, deviceName: e.target.value })} placeholder="e.g. MRI Machine" className={inputClass('deviceName')} />
              {errors.deviceName && <p className="mt-1 text-xs text-danger">{errors.deviceName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-number">
                {t('devices.deviceNumberLabel')} *
              </label>
              <input id="f-number" value={form.deviceNumber} onChange={(e) => setForm({ ...form, deviceNumber: e.target.value })} placeholder="e.g. MRI-001" className={inputClass('deviceNumber')} />
              {errors.deviceNumber && <p className="mt-1 text-xs text-danger">{errors.deviceNumber}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-type">
                {t('devices.deviceTypeLabel')} *
              </label>
              <input id="f-type" value={form.deviceType} onChange={(e) => setForm({ ...form, deviceType: e.target.value })} placeholder="e.g. MRI Scanner" className={inputClass('deviceType')} />
              {errors.deviceType && <p className="mt-1 text-xs text-danger">{errors.deviceType}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-category">
                {t('devices.categoryLabel')} *
              </label>
              <input id="f-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Imaging" className={inputClass('category')} />
              {errors.category && <p className="mt-1 text-xs text-danger">{errors.category}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-dept">
                {t('devices.departmentLabel')} *
              </label>
              <input id="f-dept" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Radiology" className={inputClass('department')} />
              {errors.department && <p className="mt-1 text-xs text-danger">{errors.department}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-location">
                {t('devices.locationLabel')} *
              </label>
              <input id="f-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Building A, Room 101" className={inputClass('location')} />
              {errors.location && <p className="mt-1 text-xs text-danger">{errors.location}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-manufacturer">
                {t('devices.manufacturerLabel')}
              </label>
              <input id="f-manufacturer" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="Siemens Healthineers" className={inputClass('manufacturer')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-model">
                {t('devices.modelLabel')}
              </label>
              <input id="f-model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="MAGNETOM Sola 1.5T" className={inputClass('model')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-serial">
                {t('devices.serialNumberLabel')}
              </label>
              <input id="f-serial" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} placeholder="S-N2019-88421" className={inputClass('serialNumber')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-firmware">
                {t('devices.firmwareVersionLabel')}
              </label>
              <input id="f-firmware" value={form.firmwareVersion} onChange={(e) => setForm({ ...form, firmwareVersion: e.target.value })} placeholder="VB20A.00" className={inputClass('firmwareVersion')} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-install">
                {t('devices.installationDateLabel')}
              </label>
              <input id="f-install" type="date" value={form.installationDate} onChange={(e) => setForm({ ...form, installationDate: e.target.value })} className={inputClass('installationDate')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-warranty">
                {t('devices.warrantyExpiryLabel')}
              </label>
              <input id="f-warranty" type="date" value={form.warrantyExpiry} onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} className={inputClass('warrantyExpiry')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-interval">
                {t('devices.maintenanceIntervalLabel')}
              </label>
              <input id="f-interval" value={form.maintenanceInterval} onChange={(e) => setForm({ ...form, maintenanceInterval: e.target.value })} placeholder="Quarterly" className={inputClass('maintenanceInterval')} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="f-image">
                {t('devices.deviceImageLabel')}
              </label>
              <input id="f-image" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} placeholder="https://..." className={inputClass('image')} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={submitting} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? t('common.loading') + '…' : t('devices.registerDevice')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DeviceRegistrationForm;
