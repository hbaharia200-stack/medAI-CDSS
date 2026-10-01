import { useTranslation } from 'react-i18next';

interface MarketingHeroProps {
  image: string;
  badgeKey: string;
  headlineKey: string;
  subheadlineKey: string;
  /** Compact variant for inner marketing pages (shorter than the landing hero). */
  compact?: boolean;
}

/**
 * Shared photo-hero treatment: full-bleed photo with a brand-tinted
 * gradient overlay (uses the theme-aware --color-panel token: classic MedAI
 * blue in light mode, deep indigo in dark mode) and left-aligned white copy
 * on top.
 */
export default function MarketingHero({ image, badgeKey, headlineKey, subheadlineKey, compact = false }: MarketingHeroProps) {
  const { t } = useTranslation();
  return (
    <section className={`relative overflow-hidden ${compact ? 'min-h-[320px] md:min-h-[400px]' : 'min-h-[520px] md:min-h-[640px]'}`}>
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          objectPosition: 'center',
          filter: 'blur(28px) saturate(1.15) brightness(0.65)',
          transform: 'scale(1.15)',
        }}
      />
      {/* Foreground layer — the real photo, never cropped or zoomed */}
      <img
        src={image}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain"
        style={{ objectPosition: 'center' }}
      />
      {/* Brand-tinted gradient overlay for text contrast */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-panel via-panel/70 to-panel/20"
      />
      <div className={`relative mx-auto flex max-w-6xl items-center px-6 ${compact ? 'min-h-[320px] md:min-h-[400px]' : 'min-h-[520px] md:min-h-[640px]'}`}>
        <div className={`max-w-2xl ${compact ? 'py-14' : 'py-20 md:py-24'}`}>
          <span className="inline-flex items-center rounded-full border border-white/40 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white">
            {t(badgeKey)}
          </span>
          <h1 className={`mt-5 font-extrabold text-white ${compact ? 'text-3xl md:text-4xl' : 'text-4xl md:text-5xl'}`}>
            {t(headlineKey)}
          </h1>
          <p className={`mt-4 text-white/80 ${compact ? 'text-base md:text-lg' : 'text-lg'}`}>
            {t(subheadlineKey)}
          </p>
        </div>
      </div>
    </section>
  );
}
