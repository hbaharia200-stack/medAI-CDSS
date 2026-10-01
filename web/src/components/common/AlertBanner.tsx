
export type AlertBannerVariant = 'info' | 'warning' | 'emergency';

const VARIANTS: Record<AlertBannerVariant, { style: string; icon: string }> = {
  info: { style: 'bg-info-bg border-primary text-primary-dark', icon: 'ℹ️' },
  warning: { style: 'bg-warning-bg border-conf-medium text-conf-medium', icon: '⚠️' },
  emergency: { style: 'bg-danger-bg border-danger text-danger-dark', icon: '🚨' },
};

interface AlertBannerProps {
  text: string;
  variant?: AlertBannerVariant;
  action?: React.ReactNode;
}

export function AlertBanner({ text, variant = 'info', action }: AlertBannerProps) {
  const s = VARIANTS[variant];
  return (
    <div
      role="alert"
      className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-base font-semibold ${s.style}`}
    >
      <span aria-hidden>{s.icon}</span>
      <span className="flex-1">{text}</span>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export default AlertBanner;