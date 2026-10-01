
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: string; // always paired with text — never icon-only for critical actions
  size?: 'md' | 'lg';
  title?: string;
  className?: string;
  /** Optional test hook, so browser tests can click a specific action. */
  'data-testid'?: string;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary border-primary text-ink-on-primary hover:bg-primary-dark shadow-card',
  secondary: 'bg-surface border-line text-ink hover:bg-canvas',
  outline: 'bg-transparent border-primary text-primary hover:bg-primary-light',
  danger: 'bg-danger border-danger text-white hover:bg-danger-dark',
};

export function Button({
  label,
  onClick,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  size = 'md',
  title,
  className = '',
  'data-testid': testId,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      title={title}
      data-testid={testId}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border-2 px-5 type-button transition-all motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${
        size === 'lg' ? 'min-h-[56px] px-8 text-lg' : 'text-base'
      } ${VARIANTS[variant]} ${className}`}
    >
      {loading ? (
        <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : icon ? (
        <span aria-hidden>{icon}</span>
      ) : null}
      <span>{label}</span>
    </button>
  );
}

export default Button;