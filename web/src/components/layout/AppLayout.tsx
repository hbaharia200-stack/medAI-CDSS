import { useState, useEffect, useRef, useMemo } from 'react';
import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../state/useAuthStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Icons } from '../common/Icons';
import { getNotificationCounts, clearNotifications } from '../../services/api/recommendationService';
import { APP_SCROLL_ROOT_ID } from '../../hooks/useScrollReveal';

function useTypewriter(text: string, active: boolean) {
  const [count, setCount] = useState(active ? 0 : text.length);
  const [done, setDone] = useState(!active);
  const ref = useRef<ReturnType<typeof setInterval>>(undefined as unknown as ReturnType<typeof setInterval>);
  useEffect(() => {
    if (!active) { setCount(text.length); setDone(true); return; }
    setCount(0); setDone(false);
    ref.current = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) { clearInterval(ref.current); setDone(true); return c; }
        return c + 1;
      });
    }, 40);
    return () => clearInterval(ref.current);
  }, [text, active]);
  return { count, done };
}

const NAV = [
  { to: '/app', lk: 'nav.basicDashboard', icon: 'home', end: true },
  { to: '/app/devices', lk: 'nav.devices', icon: 'activity' },
  { to: '/app/patients', lk: 'nav.patientsDashboard', icon: 'users' },
  { to: '/app/diagnosis', lk: 'nav.diagnosisDashboard', icon: 'stethoscope' },
  { to: '/app/appointments', lk: 'nav.appointmentDashboard', icon: 'calendar' },
  { to: '/app/statistics', lk: 'nav.statistics', icon: 'chartBar' },
  { to: '/app/schedule', lk: 'nav.schedule', icon: 'calendarClock' },
  { to: '/app/messages', lk: 'nav.messages', icon: 'messageCircle' },
  { to: '/app/billings', lk: 'nav.billings', icon: 'dollarSign' },
  { to: '/app/settings', lk: 'nav.settings', icon: 'settings' },
] as const;

// Admin-only destinations. They are appended to the sidebar *and* guarded by
// `AdminRoute` in the router, so a doctor/nurse can never open them.
const ADMIN_NAV = [
  { to: '/admin/users', lk: 'sidebar.userManagement', icon: 'users' },
  { to: '/admin/system', lk: 'sidebar.systemHealth', icon: 'activity' },
  { to: '/admin/analytics', lk: 'sidebar.analytics', icon: 'chartBar' },
  { to: '/admin/audit', lk: 'sidebar.auditLog', icon: 'fileText' },
] as const;

function Ic({ n, s = 20 }: { n: string; s?: number }) {
  const C: any = (Icons as any)[n] ?? Icons.home;
  return <C width={s} height={s} />;
}

function NavLinkItem({
  to,
  end,
  collapsed,
  icon,
  label,
  onNavigate,
}: {
  to: string;
  end?: boolean;
  collapsed: boolean;
  icon: string;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex min-h-[44px] items-center gap-3 rounded-xl px-3 font-medium transition-colors ${
          collapsed ? 'justify-center' : ''
        } ${isActive ? 'bg-primary/10 text-primary' : 'text-ink-muted hover:bg-canvas hover:text-ink'}`
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
              isActive ? 'bg-primary text-white shadow-card' : 'bg-canvas text-ink-muted'
            }`}
          >
            <Ic n={icon} s={18} />
          </span>
          {!collapsed && <span className="truncate text-sm">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

export default function AppLayout() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const { user, signOut } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const [col, setCol] = useState(false);
  /** Mobile-only drawer state — separate from desktop `col` collapse. */
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [prof, setProf] = useState(false);
  const counts = getNotificationCounts();
  const notif = (counts.new_patient ?? 0) + (counts.new_message ?? 0) + (counts.upcoming_appointment ?? 0);
  const out = async () => { await signOut(); nav('/sign-in'); };
  const currentNav = NAV.find((n) => ('end' in n ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));
  const pageTitle = currentNav ? t(currentNav.lk) : t('nav.basicDashboard');
  // Admin links are only rendered for an admin session; the router's AdminRoute
  // is the actual gate.
  const isAdmin = user?.role === 'admin';
  const navItems = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;
  const reduceMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const sysName = t('app.systemName');
  const { count } = useTypewriter(sysName, !reduceMotion);

  return (
    <div className="flex h-screen flex-col gap-4 overflow-hidden bg-canvas p-4 lg:gap-5 lg:p-6">
      <header className="rounded-3xl bg-surface/80 backdrop-blur-xl px-4 py-2 shadow-float lg:px-6">
        {/* Row 1 — prominent system title */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <div className="flex min-w-0 flex-col">
            <div className="overflow-hidden pl-1 pb-1 pt-1"><h1 className="truncate text-2xl font-extrabold tracking-tight text-heading lg:text-3xl" aria-label={sysName}>{sysName.slice(0, Math.min(count, sysName.length))}{count < sysName.length && <span style={{ opacity: 0 }}>{sysName.slice(count)}</span>}<span className="animate-cursor-blink text-heading">|</span></h1></div>
            <p className="text-xs font-semibold text-ink-muted">{pageTitle}</p>
          </div>
        </div>
        {/* Row 2 — search + actions */}
        <div className="mt-2 flex h-12 items-center gap-1.5 sm:gap-2">
          <button onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle sidebar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted hover:bg-canvas lg:hidden"><Ic n="menu" /></button>
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <div className="relative w-full max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><Ic n="search" s={16} /></span>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('topnav.searchPlaceholder')} className="h-10 w-full min-w-0 rounded-full border border-transparent bg-canvas pl-10 pr-4 text-sm text-ink transition-colors placeholder:text-ink-muted focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button onClick={toggleTheme} aria-label="Toggle theme" className="flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-canvas hover:text-ink"><Ic n={theme === 'dark' ? 'sun' : 'moon'} s={18} /></button>
            <button onClick={() => clearNotifications()} className="relative hidden h-10 w-10 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-canvas hover:text-ink min-[400px]:flex" aria-label={t('topnav.notifications')}>
              <Ic n="bell" />
              {notif > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{notif > 9 ? '9+' : notif}</span>}
            </button>
            <div className="relative">
              <button onClick={() => setProf(!prof)} className="flex items-center gap-1.5 rounded-lg border border-line px-2 py-2 hover:bg-canvas sm:gap-2 sm:px-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary">{user?.fullName?.charAt(0) ?? 'D'}</div>
                <div className="hidden text-left md:block"><p className="text-sm font-semibold text-ink">{user?.fullName ?? 'Doctor'}</p><p className="text-[10px] text-ink-muted">{user?.specialization ?? ''}</p></div>
                <span className="hidden min-[400px]:inline"><Ic n="chevronDown" s={16} /></span>
              </button>
              {prof && (
                <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-xl border border-line bg-surface p-2 shadow-lg">
                  <button onClick={() => { setProf(false); nav('/app/settings'); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas"><Ic n="settings" s={16} /> {t('topnav.settings')}</button>
                  <button onClick={() => { setProf(false); void out(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-bg"><Ic n="logOut" s={16} /> {t('topnav.signOut')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="flex min-w-0 flex-1 gap-4 overflow-hidden lg:gap-5">
        {/* Mobile off-canvas drawer — below lg only */}
        {mobileOpen && (
          <button
            type="button"
            aria-label={t('common.closeMenu')}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          />
        )}
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col rounded-r-3xl bg-surface shadow-float transition-transform duration-300 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1.5">
              {navItems.map((i) => (
                <li key={i.to}>
                  <NavLinkItem to={i.to} end={'end' in i ? i.end : false} collapsed={false} icon={i.icon} label={t(i.lk)} onNavigate={() => setMobileOpen(false)} />
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <button
                onClick={() => { setMobileOpen(false); void out(); }}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 font-medium text-ink-muted transition-colors hover:bg-danger-bg hover:text-danger"
              >
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas transition-colors">
                  <Ic n="logOut" s={18} />
                </span>
                <span className="truncate text-sm">{t('auth.signOut')}</span>
              </button>
            </div>
          </nav>
        </aside>
        {/* Desktop sidebar — lg+ only, icon-rail collapse unchanged */}
        <aside className={`hidden flex-col rounded-3xl bg-surface shadow-float transition-all duration-300 lg:flex ${col ? 'w-[72px]' : 'w-[260px]'}`}>
          <div className="flex items-center px-3 py-2">
            <button
              onClick={() => setCol(!col)}
              aria-label={col ? 'Expand sidebar' : 'Collapse sidebar'}
              title={col ? 'Expand sidebar' : 'Collapse sidebar'}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <Ic n={col ? 'chevronsRight' : 'chevronsLeft'} s={18} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-2">
            <ul className="space-y-1.5">
              {navItems.map((i) => (
                <li key={i.to}>
                  <NavLinkItem to={i.to} end={'end' in i ? i.end : false} collapsed={col} icon={i.icon} label={t(i.lk)} />
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <button
                onClick={out}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 font-medium text-ink-muted transition-colors hover:bg-danger-bg hover:text-danger ${col ? 'justify-center' : ''}`}
              >
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas transition-colors">
                  <Ic n="logOut" s={18} />
                </span>
                {!col && <span className="truncate text-sm">{t('auth.signOut')}</span>}
              </button>
            </div>
          </nav>
        </aside>
        {/* Inner scroll container — dashboard pages scroll inside THIS element
            (not the window); scroll-reveal observers target it via its id. */}
        <main
          key={loc.pathname}
          id={APP_SCROLL_ROOT_ID}
          className="min-w-0 flex-1 overflow-y-auto rounded-[28px] bg-surface p-4 shadow-float animate-view sm:p-6"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
