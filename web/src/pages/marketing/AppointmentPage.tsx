import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Icons } from '../../components/common/Icons';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import MarketingHero from '../../components/marketing/MarketingHero';
import AppointmentForm from '../../components/marketing/AppointmentForm';
import heroImg from '../../assets/marketing/hero-team.jpg';

/** Public booking page: hero + request form + help fallback. */
export default function AppointmentPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <MarketingHero
        image={heroImg}
        badgeKey="appointment.badge"
        headlineKey="appointment.headline"
        subheadlineKey="appointment.subheadline"
        compact
      />

      <section className="mx-auto max-w-3xl px-6 pt-12">
        <AppointmentForm />
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12">
        <Card className="flex flex-col items-center gap-6 md:flex-row">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            <Icons.phoneCall width={26} height={26} />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-lg font-bold text-heading">{t('appointment.helpTitle')}</h2>
            <p className="mt-1 text-sm text-ink-muted">{t('appointment.helpDesc', { phone: t('contact.phoneValue') })}</p>
          </div>
          <div className="md:ml-auto">
            <Button label={t('landing.ctaContactUs')} variant="secondary" onClick={() => nav('/contact')} />
          </div>
        </Card>
      </section>

      <SiteFooter />
    </div>
  );
}