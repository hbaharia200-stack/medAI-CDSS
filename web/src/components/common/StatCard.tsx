import { Icons } from './Icons';
import { DeltaBadge } from './DeltaBadge';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; direction: 'up' | 'down' | 'neutral' };
  icon?: keyof typeof Icons;
  iconBg?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function StatCard({ label, value, delta, icon, iconBg = 'bg-primary-light', className = '', style }: StatCardProps) {
  const IconComponent = icon ? Icons[icon] : null;
  return (
    <div style={style} className={`group rounded-2xl border border-line bg-surface p-6 shadow-card card-polished ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{value}</p>
          {delta ? (
            <div className="mt-2">
              <DeltaBadge value={delta.value} direction={delta.direction} />
            </div>
          ) : null}
        </div>
        {IconComponent ? (
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:rotate-3 group-hover:scale-110 ${iconBg}`}>
            <IconComponent width={20} height={20} className="text-primary" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default StatCard;