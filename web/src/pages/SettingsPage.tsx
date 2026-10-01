import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Icons } from '../components/common/Icons';
import { useAuthStore } from '../state/useAuthStore';
import { useTheme } from '../theme/ThemeProvider';
import { useNavigate } from 'react-router-dom';
import { setLanguage } from '../i18n';
import {
  getAvailability,
  setAvailability,
  type DoctorAvailability,
} from '../services/api/availabilityService';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const nav = useNavigate();
  const { user, signOut } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const isOnline = true;

  // Doctor availability is PERSISTED server-side, not local UI state: it is read
  // back on mount (so a refresh shows the saved value) and written through
  // PATCH /api/auth/me/availability (so it survives logout/login).
  const isDoctor = user?.role === 'doctor';
  const [availability, setAvailabilityState] = useState<DoctorAvailability>('available');
  const [availabilityLoaded, setAvailabilityLoaded] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);

  useEffect(() => {
    if (!isDoctor) return;
    let cancelled = false;
    getAvailability()
      .then((payload) => {
        if (!cancelled) {
          setAvailabilityState(payload.availability);
          setAvailabilityLoaded(true);
        }
      })
      .catch(() => {
        // The status is unknown rather than invented: fall back to the copy that
        // says so, instead of implying the doctor is available.
        if (!cancelled) setAvailabilityLoaded(false);
      });
    return () => { cancelled = true; };
  }, [isDoctor]);

  const changeAvailability = async (next: DoctorAvailability) => {
    if (savingAvailability) return;
    setSavingAvailability(true);
    try {
      const saved = await setAvailability(next);
      setAvailabilityState(saved.availability);
      setAvailabilityLoaded(true);
    } catch {
      // Leave the previous value in place so the UI never claims a status the
      // backend did not accept.
    } finally {
      setSavingAvailability(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="overflow-hidden pb-1 pt-1"><h1 className="text-2xl font-extrabold text-heading">{t('nav.settings')}</h1></div>
        <p className="subtitle-typewriter text-sm text-ink-muted">{t('app.systemName')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-5 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary">
              {(Icons.user)({ width: 18, height: 18 })}
            </span>
            <h2 className="text-lg font-bold text-ink">{t('profile.title')}</h2>
          </div>
          <div className="flex items-start gap-5">
            <div className="relative shrink-0">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-light text-2xl font-bold text-primary ring-4 ring-primary-light/50">
                {user?.fullName?.charAt(0) ?? 'D'}
              </div>
              <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface ring-2 ring-surface">
                <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-ink-muted'}`} />
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-lg font-bold text-ink">{user?.fullName ?? 'Doctor'}</p>
              <p className="flex items-center gap-1.5 text-sm text-ink-muted">
                {isOnline ? (
                  <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t('settings.online')}</>
                ) : (
                  <>{t('settings.lastSeen')} 09:40 AM</>
                )}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">{user?.specialization ?? ''}</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-muted">
                    {(Icons.fileText)({ width: 16, height: 16 })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-muted">{t('profile.staffId')}</p>
                    <p className="font-semibold text-ink truncate">{user?.staffId ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-muted">
                    {(Icons.phone)({ width: 16, height: 16 })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-muted">{t('profile.phone')}</p>
                    <p className="font-semibold text-ink truncate">{user?.phone ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink-muted">
                    {(Icons.globe)({ width: 16, height: 16 })}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-muted">{t('profile.email')}</p>
                    <p className="font-semibold text-ink truncate">{user?.email ?? '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary">
              {(Icons.settings)({ width: 18, height: 18 })}
            </span>
            <h2 className="text-lg font-bold text-ink">{t('settings.appearance')}</h2>
          </div>
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm font-semibold text-ink">{t('settings.darkMode')}</p>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex w-full items-center gap-4 rounded-xl border border-line bg-canvas p-1"
                role="switch"
                aria-checked={theme === 'dark'}
              >
                <span className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${theme === 'light' ? 'bg-surface text-primary shadow-sm' : 'text-ink-muted'}`}>
                  {(Icons.sun)({ width: 18, height: 18 })}
                  {t('theme.light')}
                </span>
                <span className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${theme === 'dark' ? 'bg-surface text-primary shadow-sm' : 'text-ink-muted'}`}>
                  {(Icons.moon)({ width: 18, height: 18 })}
                  {t('theme.dark')}
                </span>
              </button>
            </div>
            <div>
              <label htmlFor="language-select" className="mb-2 block text-sm font-semibold text-ink">
                {t('settings.languageSelect')}
              </label>
              <div className="relative">
                <select
                  id="language-select"
                  value={i18n.language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'sw')}
                  className="w-full appearance-none rounded-xl border border-line bg-canvas px-4 py-3 pr-10 text-sm font-medium text-ink outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="en">English (EN)</option>
                  <option value="sw">Swahili (SW)</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
                  {(Icons.chevronDown)({ width: 18, height: 18 })}
                </span>
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-ink">{t('settings.notifications')}</p>
              <div className="flex items-center justify-between rounded-xl border border-line bg-canvas px-4 py-3">
                <span className="text-sm text-ink">{t('settings.notifications')}</span>
                <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors">
                  <span className="inline-block h-4 w-4 translate-x-6 transform rounded-full bg-white shadow-sm transition-transform" />
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {isDoctor ? (
        <Card>
          <div className="mb-5 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-light text-primary">
              {(Icons.stethoscope)({ width: 18, height: 18 })}
            </span>
            <h2 className="text-lg font-bold text-ink">{t('settings.availability')}</h2>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{t('settings.availabilityStatus')}</p>
              {/* Current persisted status, shown explicitly. */}
              <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${
                    !availabilityLoaded
                      ? 'bg-ink-muted'
                      : availability === 'available'
                        ? 'bg-emerald-500'
                        : 'bg-ink-muted'
                  }`}
                />
                {!availabilityLoaded
                  ? t('settings.availabilityUnknown')
                  : availability === 'available'
                    ? t('settings.availabilityAvailable')
                    : t('settings.availabilityNotAvailable')}
              </p>
            </div>
          </div>

          <div className="mt-4 flex w-full items-center gap-1 rounded-xl border border-line bg-canvas p-1">
            {([['available', t('settings.availabilityAvailable')],
               ['not_available', t('settings.availabilityNotAvailable')]] as const).map(
              ([key, label]) => {
                const active = availability === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void changeAvailability(key)}
                    disabled={savingAvailability}
                    aria-pressed={active}
                    className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-all disabled:opacity-60 ${
                      active ? 'bg-surface text-primary shadow-sm' : 'text-ink-muted'
                    }`}
                  >
                    {label}
                  </button>
                );
              },
            )}
          </div>

          <p className="mt-3 text-xs text-ink-muted">{t('settings.availabilityHint')}</p>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger-bg text-danger">
              {(Icons.logOut)({ width: 22, height: 22 })}
            </span>
            <div>
              <p className="font-semibold text-ink">{t('auth.signOut')}</p>
              <p className="text-sm text-ink-muted">{t('auth.signOutDesc')}</p>
            </div>
          </div>
          <Button label={t('auth.signOut')} variant="danger" onClick={async () => { await signOut(); nav('/sign-in'); }} />
        </div>
      </Card>
    </div>
  );
}
