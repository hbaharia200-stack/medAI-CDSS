import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../state/useAuthStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Icons } from '../../components/common/Icons';
import LandingPage from '../LandingPage';

export default function SignUpPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const signUp = useAuthStore((s) => s.signUp);
  const [form, setForm] = useState({ fullName: '', staffId: '', specialization: '', phone: '', email: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async () => {
    if (!form.staffId.trim()) return setError(t('auth.staffIdRequired'));
    if (!form.fullName.trim()) return setError(t('auth.fullNameRequired'));
    setBusy(true);
    setError(null);
    await signUp({ staffId: form.staffId, fullName: form.fullName, specialization: form.specialization, phone: form.phone, email: form.email });
    setBusy(false);
    nav('/app');
  };

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden">
      {/* Inert blurred backdrop — clipped to one viewport, never scrolls */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none blur-md scale-105" aria-hidden="true">
        <LandingPage />
      </div>
      {/* Dim overlay for contrast */}
      <div className="absolute inset-0 bg-primary-dark/20 dark:bg-black/50" />
      {/* Click-outside-to-close layer */}
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={() => nav('/')}
        className="absolute inset-0 cursor-default"
      />
      {/* Pop-up card */}
      <div className="fixed inset-0 z-10 flex items-center justify-center overflow-y-auto p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-2xl font-extrabold text-white shadow-card">M</div>
          <h1 className="text-2xl font-extrabold text-ink">{t('app.name')}</h1>
          <p className="type-caption text-ink-muted">{t('app.systemName')}</p>
        </div>
        <Card>
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="type-section text-ink">{t('auth.signUp')}</h2>
            <button
              type="button"
              onClick={() => nav('/')}
              aria-label={t('common.close')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted hover:bg-canvas hover:text-ink"
            >
              <Icons.x width={16} height={16} />
            </button>
          </div>
          {error && <div className="mb-4 rounded-xl border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block type-label">{t('auth.fullName')}</span>
              <input value={form.fullName} onChange={set('fullName')} placeholder={t('auth.fullNamePlaceholder')} className="h-12 w-full rounded-xl border-2 border-line bg-canvas px-4 focus:border-primary focus:outline-none" />
            </label>
            <label className="block">
              <span className="mb-2 block type-label">{t('auth.staffId')}</span>
              <input value={form.staffId} onChange={set('staffId')} placeholder={t('auth.staffIdPlaceholder')} className="h-12 w-full rounded-xl border-2 border-line bg-canvas px-4 focus:border-primary focus:outline-none" />
            </label>
            <label className="block">
              <span className="mb-2 block type-label">{t('auth.specialization')}</span>
              <input value={form.specialization} onChange={set('specialization')} placeholder={t('auth.specializationPlaceholder')} className="h-12 w-full rounded-xl border-2 border-line bg-canvas px-4 focus:border-primary focus:outline-none" />
            </label>
            <label className="block">
              <span className="mb-2 block type-label">{t('auth.phone')}</span>
              <input value={form.phone} onChange={set('phone')} className="h-12 w-full rounded-xl border-2 border-line bg-canvas px-4 focus:border-primary focus:outline-none" />
            </label>
            <label className="block">
              <span className="mb-2 block type-label">{t('auth.email')}</span>
              <input value={form.email} onChange={set('email')} type="email" className="h-12 w-full rounded-xl border-2 border-line bg-canvas px-4 focus:border-primary focus:outline-none" />
            </label>
          </div>
          <div className="mt-6">
            <Button label={t('auth.signUp')} onClick={() => void onSubmit()} loading={busy} />
          </div>
          <p className="mt-4 text-center type-caption text-ink-muted">
            {t('auth.alreadyHaveAccount')}{' '}
            <Link to="/sign-in" className="font-semibold text-primary hover:underline">{t('auth.signIn')}</Link>
          </p>
        </Card>
        </div>
      </div>
    </div>
  );
}
