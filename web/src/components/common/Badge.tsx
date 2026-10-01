import type { ConfidenceLevel } from '../../types';

export type BadgeVariant = 'high' | 'medium' | 'low' | 'urgent' | 'info' | 'neutral' | 'awaiting-review';

const VARIANTS: Record<BadgeVariant, string> = {
  high: 'badge-high',
  medium: 'badge-medium',
  low: 'badge-medium',
  urgent: 'badge-urgent',
  info: 'badge-info',
  neutral: 'badge-neutral',
  'awaiting-review': 'badge-awaiting-review',
};

/** Maps a ConfidenceLevel to its badge variant (High/Medium/Low + urgent). */
export function confidenceToVariant(level: ConfidenceLevel): BadgeVariant {
  if (level === 'High') return 'high';
  if (level === 'Medium') return 'medium';
  return 'low';
}

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  confidence?: ConfidenceLevel;
  icon?: string;
}

export function Badge({ label, variant = 'neutral', confidence, icon }: BadgeProps) {
  const isAwaitingReview = label === 'awaiting_review';
  const resolved: BadgeVariant = isAwaitingReview
    ? 'awaiting-review'
    : confidence
      ? confidenceToVariant(confidence)
      : variant;
  return (
    <span
      className={"inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium " + VARIANTS[resolved]}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      {label}
    </span>
  );
}

export default Badge;
