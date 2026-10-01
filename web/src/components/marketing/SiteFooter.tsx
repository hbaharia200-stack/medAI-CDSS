import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function SiteFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer border-t border-white/15 bg-panel">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg font-extrabold text-white">M</div>
            <div>
              <p className="text-base font-extrabold text-white">{t('app.name')}</p>
              <p className="text-[10px] uppercase tracking-wider text-white/70">{t('app.systemName')}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-white/70">{t('landing.subheadline')}</p>
        </div>
        <FooterCol title={t('landing.quickLinks')} links={[
          { label: t('landing.navHome'), to: '/' },
          { label: t('landing.navServices'), to: '/services' },
          { label: t('landing.navSpecialists'), to: '/specialists' },
          { label: t('landing.navAbout'), to: '/about' },
          { label: t('landing.navContact'), to: '/contact' },
          { label: t('landing.navAppointment'), to: '/appointment' },
        ]} />
        <FooterCol title={t('landing.navServices')} links={[
          { label: t('services.triageTitle'), to: '/services' },
          { label: t('services.diagnosisTitle'), to: '/services' },
          { label: t('services.recordsTitle'), to: '/services' },
          { label: t('services.labsTitle'), to: '/services' },
          { label: t('services.pharmacyTitle'), to: '/services' },
          { label: t('services.emergencyTitle'), to: '/services' },
        ]} />
        <div>
          <p className="type-label tracking-wide text-white">{t('contact.infoTitle')}</p>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li>{t('contact.phoneValue')}</li>
            <li>{t('contact.emailValue')}</li>
            <li>{t('contact.addressValue')}</li>
            <li>{t('contact.hoursValue')}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15 px-6 py-5 text-center text-sm text-white/70">
        <p>{t('app.name')} — {t('app.systemName')} · {year}</p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <nav aria-label={title}>
      <p className="type-label tracking-wide text-white">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={`${l.to}-${l.label}`}>
            <NavLink to={l.to} className="text-sm text-white/70 transition-colors hover:text-accent">
              {l.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
