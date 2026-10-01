import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuthStore } from '../../state/useAuthStore';
import { Button } from '../common/Button';
import { Icons } from '../common/Icons';

const NAV_LINKS = [
  { to: '/', end: true, labelKey: 'landing.navHome' },
  { to: '/services', end: false, labelKey: 'landing.navServices' },
  { to: '/specialists', end: false, labelKey: 'landing.navSpecialists' },
  { to: '/about', end: false, labelKey: 'landing.navAbout' },
  { to: '/contact', end: false, labelKey: 'landing.navContact' },
  { to: '/appointment', end: false, labelKey: 'landing.navAppointment' },
] as const;

export default function SiteHeader() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [menuOpen, setMenuOpen] = useState(false);

  /** Auth pages render on top of the landing page as a blurred popup,
   * so Sign in / Get started return here instead of navigating away. */
  const openAuthPopup = (path: '/sign-in' | '/sign-up') => {
    const state =
      location.pathname === '/'
        ? { authPopup: path, from: location }
        : undefined;
    nav(path, { state });
  };

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="flex items-center gap-2" aria-label={t('app.name')}>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-xl font-extrabold text-white shadow-card">M</div>
          <div>
            <p className="text-lg font-extrabold text-primary">{t('app.name')}</p>
            <p className="text-[10px] uppercase tracking-wider text-ink-muted">{t('app.systemName')}</p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-primary-light text-primary' : 'text-ink-muted hover:bg-canvas hover:text-ink'
                }`
              }
            >
              {t(l.labelKey)}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink-muted hover:bg-canvas hover:text-ink"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Icons.sun width={18} height={18} /> : <Icons.moon width={18} height={18} />}
          </button>
          <Button
            label={t('auth.signIn')}
            variant="secondary"
            onClick={() => (isAuthenticated ? nav('/app') : openAuthPopup('/sign-in'))}
            className="hidden sm:inline-flex"
          />
          <Button label={t('landing.ctaGetStarted')} onClick={() => openAuthPopup('/sign-up')} />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink-muted hover:bg-canvas hover:text-ink lg:hidden"
            aria-label={menuOpen ? t('common.closeMenu') : t('common.openMenu')}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <Icons.x width={18} height={18} /> : <Icons.menu width={18} height={18} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <nav className="border-t border-line px-6 py-3 lg:hidden" aria-label="Primary mobile">
          <ul className="space-y-1">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      isActive ? 'bg-primary-light text-primary' : 'text-ink-muted hover:bg-canvas hover:text-ink'
                    }`
                  }
                >
                  {t(l.labelKey)}
                </NavLink>
              </li>
            ))}
            <li className="pt-1 sm:hidden">
              <Button
                label={t('auth.signIn')}
                variant="secondary"
                onClick={() => {
                  setMenuOpen(false);
                  if (isAuthenticated) nav('/app');
                  else openAuthPopup('/sign-in');
                }}
              />
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
