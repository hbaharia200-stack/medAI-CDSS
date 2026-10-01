
type CardVariant = 'surface' | 'primary' | 'tint' | 'muted';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  action?: React.ReactNode;
  /** Color variant — padding/radius/shadow stay identical, only colors change. */
  variant?: CardVariant;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  surface: 'border-line/80 bg-surface card-polished',
  // Solid primary panel — white text in both themes; descendant text colors
  // are forced below so existing text-ink / text-ink-muted utilities stay legible.
  primary: 'border-primary-dark bg-primary-dark text-white card-primary dark:border-primary dark:bg-primary-dark',
  tint: 'border-line/80 bg-primary-light card-tint dark:border-line',
  muted: 'border-line/80 bg-elevated card-muted dark:border-line',
};

export function Card({ children, className = '', style, title, action, variant = 'surface' }: CardProps) {
  return (
    <section style={style} className={`group rounded-2xl border p-6 shadow-card ring-1 ring-line/50 ${VARIANT_CLASSES[variant]} ${className}`}>
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h3 className="card-title type-card text-heading">{title}</h3> : null}
          {action ? <div>{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export default Card;