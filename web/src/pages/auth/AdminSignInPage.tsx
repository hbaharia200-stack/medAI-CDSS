import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../state/useAuthStore';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';

/**
 * Admin sign-in — deliberately a SEPARATE page from the staff sign-in.
 *
 * Doctor/Nurse staff (DR001, NR001, …) sign in passwordlessly with a Staff ID
 * and the normal sign-in screen shows no password field at all. Admin accounts
 * genuinely do require a password on the backend, so that capability is kept
 * intact here instead of being exposed as an "optional" field that staff would
 * try to use (and fail) on the main screen.
 *
 * This page is intentionally not linked from the staff sign-in UI.
 */
export default function AdminSignInPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (busy) return;
    if (!identifier.trim() || !password) {
      setError(t('auth.identifierRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await signIn(identifier.trim(), password);
    setBusy(false);
    if (ok) nav('/admin');
    else setError(t(useAuthStore.getState().signInError ?? 'auth.loginFailed'));
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold text-ink">{t('app.name')}</h1>
          <p className="type-caption text-ink-muted">{t('auth.adminSignIn')}</p>
        </div>
        <Card>
          {error && (
            <div className="mb-4 rounded-xl border border-danger bg-danger-bg px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
          <label className="mb-4 block">
            <span className="mb-2 block type-label">{t('auth.identifier')}</span>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              name="admin-identifier"
              autoComplete="username"
              data-testid="admin-identifier"
              className="h-12 w-full rounded-xl border-2 border-line bg-canvas px-4 text-base focus:border-primary focus:outline-none"
            />
          </label>
          <label className="mb-4 block">
            <span className="mb-2 block type-label">{t('auth.password')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void onSubmit()}
              name="password"
              autoComplete="current-password"
              data-testid="admin-password"
              className="h-12 w-full rounded-xl border-2 border-line bg-canvas px-4 text-base focus:border-primary focus:outline-none"
            />
          </label>
          <Button
            label={t('auth.signIn')}
            onClick={() => void onSubmit()}
            loading={busy}
            data-testid="admin-sign-in-submit"
          />
        </Card>
      </div>
    </div>
  );
}
