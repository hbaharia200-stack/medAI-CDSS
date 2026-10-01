import { Icons } from './Icons';

export type IconChipVariant =
  | 'primary' | 'high' | 'medium' | 'low' | 'danger' | 'muted' | 'surface';

const VARIANT_CLASS: Record<IconChipVariant, string> = {
  primary:   'bg-primary-light text-primary',
  high:      'bg-conf-high-bg text-conf-high',
  medium:    'bg-conf-medium-bg text-conf-medium',
  low:       'bg-conf-low-bg text-ink-muted',
  danger:    'bg-danger-bg text-danger',
  muted:     'bg-canvas text-ink-muted',
  surface:   'bg-surface text-ink',
};

interface IconChipProps {
  name: keyof typeof Icons;
  variant?: IconChipVariant;
  size?: number;
  label?: string;
}

export function IconChip({ name, variant = 'primary', size = 16, label }: IconChipProps) {
  const Icon = Icons[name] ?? Icons.home;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${VARIANT_CLASS[variant]}`}>
      <Icon width={size} height={size} />
      {label}
    </span>
  );
}

export default IconChip;