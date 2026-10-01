import { useTranslation } from 'react-i18next';
import { Card } from '../../components/common/Card';
import { Icons } from '../../components/common/Icons';
import SiteHeader from '../../components/marketing/SiteHeader';
import SiteFooter from '../../components/marketing/SiteFooter';
import MarketingHero from '../../components/marketing/MarketingHero';
import Reveal from '../../components/marketing/Reveal';
import heroImg from '../../assets/marketing/about-hero.jpg';

const SECTIONS = [
  { icon: 'heart', titleKey: 'about.missionTitle', descKey: 'about.missionDesc' },
  { icon: 'check', titleKey: 'about.valuesTitle', descKey: 'about.valuesDesc' },
  { icon: 'users', titleKey: 'about.teamTitle', descKey: 'about.teamDesc' },
] as const;

export default function AboutPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <MarketingHero image={heroImg} badgeKey="about.badge" headlineKey="about.headline" subheadlineKey="about.subheadline" compact />
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {SECTIONS.map((s, i) => (
            <Reveal key={s.titleKey} delayMs={i * 90} className="h-full">
              <Card key={s.titleKey} className="text-center h-full">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary transition-transform duration-200 group-hover:rotate-3 group-hover:scale-110">
                  {(Icons[s.icon as keyof typeof Icons] ?? Icons.heart)({ width: 24, height: 24 })}
                </div>
                <h3 className="text-lg font-bold text-ink">{t(s.titleKey)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(s.descKey)}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>
      <Reveal>
      <SiteFooter />
      </Reveal>
    </div>
  );
}
