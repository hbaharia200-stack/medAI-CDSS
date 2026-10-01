import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

export function Sidebar() {
  const { t } = useTranslation();

  const navItems: Array<{ section: string; items: NavItem[] }> = [
    {
      section: t('common.department'),
      items: [{ to: '/', label: t('sidebar.doctorDashboard'), icon: '🩺', end: true }],
    },
    {
      section: t('common.administration'),
      items: [
        { to: '/admin/users', label: t('sidebar.userManagement'), icon: '👥' },
        { to: '/admin/system', label: t('sidebar.systemHealth'), icon: '🖥️' },
        { to: '/admin/analytics', label: t('sidebar.analytics'), icon: '📊' },
        { to: '/admin/audit', label: t('sidebar.auditLog'), icon: '📜' },
      ],
    },
  ];

  return (
    <nav aria-label="Main" className="flex h-full w-60 flex-col gap-6 border-r border-line bg-surface p-4">
      <div className="flex items-center gap-2 px-2 py-1">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-xl">🩺</span>
        <div>
          <p className="text-lg font-extrabold text-primary">{t('app.name')}</p>
          <p className="text-xs text-ink-muted">{t('app.cdss')}</p>
        </div>
      </div>

      {navItems.map((group) => (
        <div key={group.section}>
          <p className="px-3 pb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
            {group.section}
          </p>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-light text-primary-dark'
                        : 'text-ink hover:bg-canvas'
                    }`
                  }
                >
                  <span aria-hidden>{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default Sidebar;