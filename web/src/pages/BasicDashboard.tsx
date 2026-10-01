import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';

export default function BasicDashboardPlaceholder() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-heading">{t('nav.basicDashboard')}</h1>
      <p className="text-sm text-ink-muted">
        This placeholder is unused — the app dashboard lives at <NavLink className="font-semibold text-primary hover:underline" to="/app">/app</NavLink>.
      </p>
    </div>
  );
}
