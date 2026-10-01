import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Icons } from '../../components/common/Icons';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import MarketingHero from '../../components/marketing/MarketingHero';
import Reveal from '../../components/marketing/Reveal';
import heroImg from '../../assets/marketing/specialists-hero.jpg';
import supportImg from '../../assets/marketing/support-surgery.jpg';

const CARDS = [
  { icon: 'heartPulse', titleKey: 'specialists.surgeryTitle', descKey: 'specialists.surgeryDesc' },
  { icon: 'stethoscope', titleKey: 'specialists.physiciansTitle', descKey: 'specialists.physiciansDesc' },
  { icon: 'userRound', titleKey: 'specialists.nursingTitle', descKey: 'specialists.nursingDesc' },
] as const;

export default function SpecialistsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <MarketingHero image={heroImg} badgeKey="specialists.badge" headlineKey="specialists.headline" subheadlineKey="specialists.subheadline" compact />
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {CARDS.map((c, i) => (
            <Reveal key={c.titleKey} delayMs={i * 90} className="h-full">
              <Card key={c.titleKey} className="text-center h-full">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary transition-transform duration-200 group-hover:rotate-3 group-hover:scale-110">
                  {(Icons[c.icon as keyof typeof Icons] ?? Icons.stethoscope)({ width: 24, height: 24 })}
                </div>
                <h3 className="text-lg font-bold text-ink">{t(c.titleKey)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(c.descKey)}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>
      <Reveal>
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <Card className="flex flex-col items-center gap-6 md:flex-row">
          <img src={supportImg} alt="" className="h-48 w-full rounded-2xl object-cover md:w-72" />
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-extrabold text-heading">{t('specialists.ctaTitle')}</h2>
            <p className="mt-2 text-sm text-ink-muted">{t('specialists.ctaDesc')}</p>
            <div className="mt-5">
              <Button label={t('specialists.ctaButton')} onClick={() => nav('/sign-up')} />
            </div>
          </div>
        </Card>
      </section>
      </Reveal>
      <Reveal>
      <SiteFooter />
      </Reveal>
    </div>
  );
}
