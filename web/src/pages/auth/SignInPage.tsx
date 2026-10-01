import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../state/useAuthStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Icons } from '../../components/common/Icons';
import LandingPage from '../LandingPage';

export default function SignInPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const [staffId, setStaffId] = useState('');
  // No password state here. Doctor/nurse staff sign in passwordlessly with
  // their Staff ID. Admin password authentication is preserved on the backend
  // and lives on the separate Admin Sign In page.
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (busy) return;
    if (!staffId.trim()) {
      setError(t('auth.staffIdRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await signIn(staffId.trim());
    setBusy(false);
    if (ok) nav('/app');
    else setError(t(useAuthStore.getState().signInError ?? 'auth.loginFailed'));

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
            <h2 className="type-section text-ink">{t('auth.signIn')}</h2>
            <button
              type="button"
              onClick={() => nav('/')}
              aria-label={t('common.close')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted hover:bg-canvas hover:text-ink"
            >
              <Icons.x width={16} height={16} />
            </button>
          </div>
          <p className="mb-6 type-caption text-ink-muted">{t('auth.signInToContinue')}</p>
          {error && <div className="mb-4 rounded-xl border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">{error}</div>}
          <label className="mb-4 block">
            <span className="mb-2 block type-label">{t('auth.staffId')}</span>
            <input
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              placeholder={t('auth.staffIdPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && void onSubmit()}
              /* Lets the browser's password manager recognise this form; the
                 identifier itself is never persisted by this app. */
              name="staff-id"
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              data-testid="staff-id"
              className="h-12 w-full rounded-xl border-2 border-line bg-canvas px-4 text-base focus:border-primary focus:outline-none"
            />
          </label>
          {/* NO password field here on purpose.
              Doctor/Nurse staff (DR001, NR001, …) authenticate passwordlessly with
              their Staff ID, so showing an optional password only confused staff
              and implied a weaker flow than actually exists. Admin accounts still
              authenticate with a password on the backend — they use the separate
              Admin Sign In page, which is intentionally not linked from the
              normal staff screen. */}
          <Button label={t('auth.signIn')} onClick={() => void onSubmit()} loading={busy} data-testid="sign-in-submit" />
          <p className="mt-4 text-center type-caption text-ink-muted">
            {t('auth.dontHaveAccount')}{' '}
            <Link to="/sign-up" className="font-semibold text-primary hover:underline">{t('auth.signUp')}</Link>
          </p>
          <div className="mt-6 rounded-xl bg-canvas p-3 text-xs text-ink-muted">
            <p className="font-semibold text-ink">{t('auth.demoStaffIds')}:</p>
            <p>DR001 · DR002 · NR001</p>
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}
