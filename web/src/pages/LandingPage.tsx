import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Icons } from '../components/common/Icons';
import SiteHeader from '../components/marketing/SiteHeader';
import SiteFooter from '../components/marketing/SiteFooter';
import Reveal from '../components/marketing/Reveal';
import heroTeam from '../assets/marketing/hero-team.jpg';
import specialistCareImg from '../assets/marketing/specialists-hero.jpg';
import servicesImg from '../assets/marketing/services-hero.jpg';
import surgeryImg from '../assets/marketing/support-surgery.jpg';
import aboutImg from '../assets/marketing/about-hero.jpg';
import RotatingHero from '../components/marketing/RotatingHero';

const HERO_IMAGES = [heroTeam, specialistCareImg, servicesImg, surgeryImg, aboutImg];

const FEATURES = [
  { icon: 'stethoscope', titleKey: 'landing.featureClinical', descKey: 'landing.featureClinicalDesc' },
  { icon: 'users', titleKey: 'landing.featureAdmin', descKey: 'landing.featureAdminDesc' },
  { icon: 'chartBar', titleKey: 'landing.featureData', descKey: 'landing.featureDataDesc' },
] as const;

const CHECKLIST = [
  'landing.checklistClinical',
  'landing.checklistRecords',
  'landing.checklistSecure',
] as const;

const SERVICE_CARDS = [
  { icon: 'activity', titleKey: 'services.triageTitle', descKey: 'services.triageDesc' },
  { icon: 'clipboardCheck', titleKey: 'services.diagnosisTitle', descKey: 'services.diagnosisDesc' },
  { icon: 'folderOpen', titleKey: 'services.recordsTitle', descKey: 'services.recordsDesc' },
] as const;

const SPECIALISTS = [
  { icon: 'heartPulse', nameKey: 'specialists.surgeryTitle', roleKey: 'specialists.surgeryRole' },
  { icon: 'stethoscope', nameKey: 'specialists.physiciansTitle', roleKey: 'specialists.physiciansRole' },
  { icon: 'userRound', nameKey: 'specialists.nursingTitle', roleKey: 'specialists.nursingRole' },
] as const;

const HOW_STEPS = [
  { step: '1', titleKey: 'landing.howStep1Title', descKey: 'landing.howStep1Desc' },
  { step: '2', titleKey: 'landing.howStep2Title', descKey: 'landing.howStep2Desc' },
  { step: '3', titleKey: 'landing.howStep3Title', descKey: 'landing.howStep3Desc' },
  { step: '4', titleKey: 'landing.howStep4Title', descKey: 'landing.howStep4Desc' },
] as const;

const WHY_POINTS = [
  { icon: 'stethoscope', titleKey: 'landing.why1Title', descKey: 'landing.why1Desc' },
  { icon: 'calendar', titleKey: 'landing.why2Title', descKey: 'landing.why2Desc' },
  { icon: 'heart', titleKey: 'landing.why3Title', descKey: 'landing.why3Desc' },
  { icon: 'shield', titleKey: 'landing.why4Title', descKey: 'landing.why4Desc' },
] as const;

const STATS = [
  { value: '500+', labelKey: 'landing.statSpecialists' },
  { value: '2M+', labelKey: 'landing.statPatients' },
  { value: '98%', labelKey: 'landing.statSatisfaction' },
] as const;

export default function LandingPage() {
  const { t } = useTranslation();
  const nav = useNavigate();

  // Split the headline into its two sentences so only the second line
  // ("Better Clinical Decisions.") gets the looping typewriter effect.
  const headline = t('landing.headline');
  const sentenceEnd = headline.indexOf('. ');
  const headlineLine1 = sentenceEnd === -1 ? headline : headline.slice(0, sentenceEnd + 1);
  const headlineLine2 = sentenceEnd === -1 ? '' : headline.slice(sentenceEnd + 2);

  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />

      {/* Split-screen hero: solid text panel (left) + sharp rotating photo (right) */}
      <section id="home" className="grid scroll-mt-20 overflow-hidden lg:grid-cols-2">
        <div className="hero-curve-left relative z-[2] flex items-center bg-panel px-6 py-20 md:py-24 lg:px-12 xl:px-16">
          <div className="relative z-[1] mx-auto w-full max-w-2xl text-left">
            <span className="inline-flex items-center rounded-full border border-white/40 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
              {t('landing.badge')}
            </span>
            <h1 className="mt-5 type-hero text-white">
              {headlineLine1}
              <br />
              <span className="hero-typewriter-measure">
                <span className="hero-typewriter">{headlineLine2}</span>
              </span>
            </h1>
            <p className="mt-4 hero-description text-white/90">
              {t('landing.subheadline')}
            </p>
            <ul className="mt-6 space-y-2.5">
              {CHECKLIST.map((k) => (
                <li key={k} className="flex items-center gap-2.5 text-sm font-medium text-white md:text-base">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Icons.check width={14} height={14} />
                  </span>
                  {t(k)}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button label={t('landing.ctaBookAppointment')} size="lg" onClick={() => nav('/appointment')} />
              <Button
                label={t('landing.ctaGetStarted')}
                variant="outline"
                size="lg"
                onClick={() => nav('/sign-up')}
                className="border-white/80! bg-transparent! text-white! hover:bg-white/10!"
              />
            </div>
          </div>
        </div>
        <div className="relative min-h-[320px] sm:min-h-[420px] lg:min-h-[600px]">
          <RotatingHero images={HERO_IMAGES} altPrefix={t('landing.heroPhoto')} />
        </div>
      </section>

      {/* Quick-link icon row, directly below the hero */}
      <Reveal>
      <section id="quick-links" className="mx-auto max-w-6xl scroll-mt-20 px-6 pt-10">
        <Card variant="muted" className="flex flex-wrap items-center justify-between gap-4">
          <QuickLinks />
          <button
            onClick={() => nav('/app')}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary-light"
          >
            {t('landing.quickViewAll')}
            <Icons.arrowRight width={16} height={16} />
          </button>
        </Card>
      </section>
      </Reveal>

      {/* Stats band */}
      <Reveal>
      <section id="stats" className="mx-auto max-w-6xl scroll-mt-20 px-6 pt-8">
        <div className="grid gap-6 rounded-2xl bg-panel px-8 py-8 text-center shadow-card sm:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.labelKey}>
              <p className="text-3xl font-extrabold text-white md:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm font-medium text-white/80">{t(s.labelKey)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-ink-muted">{t('landing.statsNote')}</p>
      </section>
      </Reveal>

      {/* Services preview */}
      <section id="services" className="mx-auto max-w-6xl scroll-mt-20 px-6 pt-16">
        <Reveal>
        <div className="mb-8 text-center">
          <span className="inline-flex items-center rounded-full bg-primary-light px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            {t('landing.servicesBadge')}
          </span>
          <h2 className="mt-3 type-section text-heading">{t('landing.servicesTitle')}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-muted md:text-base">{t('landing.servicesDesc')}</p>
        </div>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {SERVICE_CARDS.map((c, i) => (
            <Reveal key={c.titleKey} delayMs={i * 90} className="h-full">
              <Card variant="primary" className="card-aura text-center h-full">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary icon-chip transition-transform duration-200 group-hover:rotate-3 group-hover:scale-110">
                  {(Icons[c.icon as keyof typeof Icons] ?? Icons.stethoscope)({ width: 24, height: 24 })}
                </div>
                <h3 className="type-card text-ink">{t(c.titleKey)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(c.descKey)}</p>
              </Card>
            </Reveal>
          ))}
        </div>
        <Reveal>
        <div className="mt-8 text-center">
          <Button label={t('landing.ctaExploreServices')} onClick={() => nav('/services')} />
        </div>
        </Reveal>
      </section>

      {/* Specialists preview */}
      <section id="specialists" className="mx-auto max-w-6xl scroll-mt-20 px-6 pt-16">
        <Reveal>
        <div className="mb-8 text-center">
          <span className="inline-flex items-center rounded-full bg-primary-light px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            {t('landing.specialistsBadge')}
          </span>
          <h2 className="mt-3 type-section text-heading">{t('landing.specialistsTitle')}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-muted md:text-base">{t('landing.specialistsDesc')}</p>
        </div>
        </Reveal>
        <div className="grid gap-6 md:grid-cols-3">
          {SPECIALISTS.map((s, i) => (
            <Reveal key={s.nameKey} delayMs={i * 90} className="h-full">
              <Card key={s.nameKey} variant="muted" className="card-aura text-center h-full">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary icon-chip transition-transform duration-200 group-hover:rotate-3 group-hover:scale-110">
                  {(Icons[s.icon as keyof typeof Icons] ?? Icons.stethoscope)({ width: 26, height: 26 })}
                </div>
                <h3 className="type-card text-ink">{t(s.nameKey)}</h3>
                <p className="mt-1 text-sm font-medium text-primary">{t(s.roleKey)}</p>
              </Card>
            </Reveal>
          ))}
        </div>
        <Reveal>
        <div className="mt-8 text-center">
          <Button label={t('landing.ctaMeetSpecialists')} variant="secondary" onClick={() => nav('/specialists')} />
        </div>
        </Reveal>
      </section>

      {/* How MedAI works */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-6 pt-16">
        <Reveal>
        <div className="mb-8 text-center">
          <span className="inline-flex items-center rounded-full bg-primary-light px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            {t('landing.howBadge')}
          </span>
          <h2 className="mt-3 type-section text-heading">{t('landing.howTitle')}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-muted md:text-base">{t('landing.howDesc')}</p>
        </div>
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_STEPS.map((s, i) => (
            <Reveal key={s.step} delayMs={i * 90} className="h-full">
              <Card key={s.step} variant="primary" className="h-full">
                <p className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-ink-on-primary">{s.step}</p>
                <h3 className="mt-4 text-base font-bold text-ink">{t(s.titleKey)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(s.descKey)}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Appointment CTA band */}
      <Reveal>
      <section id="appointment" className="mx-auto max-w-6xl scroll-mt-20 px-6 pt-16">
        <Card className="border-panel! bg-panel! text-center">
          <h2 className="type-section text-white">{t('landing.appointmentTitle')}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-white/80 md:text-base">{t('landing.appointmentDesc')}</p>
          <div className="mt-6">
            <Button label={t('landing.ctaBookAppointment')} size="lg" onClick={() => nav('/appointment')} />
          </div>
        </Card>
      </section>
      </Reveal>

      {/* Why choose MedAI */}
      <section id="why-medai" className="mx-auto max-w-6xl scroll-mt-20 px-6 pt-16">
        <Reveal>
        <div className="mb-8 text-center">
          <span className="inline-flex items-center rounded-full bg-primary-light px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            {t('landing.whyBadge')}
          </span>
          <h2 className="mt-3 type-section text-heading">{t('landing.whyTitle')}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-muted md:text-base">{t('landing.whyDesc')}</p>
        </div>
        </Reveal>
        <div className="grid gap-6 sm:grid-cols-2">
          {WHY_POINTS.map((w, i) => (
            <Reveal key={w.titleKey} delayMs={i * 90} className="h-full">
              <Card key={w.titleKey} variant="muted" className="flex gap-4 h-full">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary icon-chip transition-transform duration-200 group-hover:rotate-3 group-hover:scale-110">
                  {(Icons[w.icon as keyof typeof Icons] ?? Icons.stethoscope)({ width: 24, height: 24 })}
                </span>
                <span>
                  <span className="block text-base font-bold text-ink">{t(w.titleKey)}</span>
                  <span className="mt-1 block text-sm text-ink-muted">{t(w.descKey)}</span>
                </span>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features — center-aligned */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.titleKey} delayMs={i * 90} className="h-full">
              <Card key={f.titleKey} variant="primary" className="text-center h-full">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary icon-chip transition-transform duration-200 group-hover:rotate-3 group-hover:scale-110">
                  {(Icons[f.icon as keyof typeof Icons] ?? Icons.stethoscope)({ width: 24, height: 24 })}
                </div>
                <h3 className="type-card text-ink">{t(f.titleKey)}</h3>
                <p className="mt-1 text-sm text-ink-muted">{t(f.descKey)}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* About preview */}
      <Reveal>
      <section id="about" className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-4">
        <Card variant="muted" className="flex flex-col items-center gap-6 md:flex-row">
          <img src={aboutImg} alt="" className="h-48 w-full rounded-2xl object-cover md:w-72" />
          <div className="text-center md:text-left">
            <span className="inline-flex items-center rounded-full bg-primary-light px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              {t('landing.aboutBadge')}
            </span>
            <h2 className="mt-3 type-section text-heading">{t('landing.aboutTitle')}</h2>
            <p className="mt-2 text-sm text-ink-muted">{t('landing.aboutDesc')}</p>
            <div className="mt-5">
              <Button label={t('landing.ctaLearnMore')} variant="secondary" onClick={() => nav('/about')} />
            </div>
          </div>
        </Card>
      </section>
      </Reveal>

      {/* Contact CTA */}
      <Reveal>
      <section id="contact" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
        <Card variant="muted" className="text-center">
          <h2 className="type-section text-heading">{t('landing.contactTitle')}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-muted md:text-base">{t('landing.contactDesc')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Button label={t('landing.ctaContactUs')} onClick={() => nav('/contact')} />
            <Button label={t('landing.ctaBookAppointment')} variant="secondary" onClick={() => nav('/appointment')} />
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

const QUICK_LINKS = [
  { icon: 'stethoscope', labelKey: 'landing.quickDiagnosis', to: '/app/diagnosis' },
  { icon: 'users', labelKey: 'landing.quickPatients', to: '/app/patients' },
  { icon: 'calendar', labelKey: 'landing.quickAppointments', to: '/app/appointments' },
  { icon: 'chartBar', labelKey: 'landing.quickAnalytics', to: '/app/statistics' },
] as const;

function QuickLinks() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-4">
      {QUICK_LINKS.map((q) => {
        const Icon = Icons[q.icon as keyof typeof Icons] ?? Icons.stethoscope;
        return (
          <button
            key={q.labelKey}
            onClick={() => nav(q.to)}
            className="link-aura flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas hover:text-primary"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-light text-primary">
              <Icon width={20} height={20} />
            </span>
            {t(q.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
