import { useAppScrollRoot } from '../../hooks/useScrollReveal';
import Reveal from '../marketing/Reveal';
import { Activity, Check, AlertTriangle, Wrench } from 'lucide-react';
import type { DeviceStatus } from '../../types/device';

const VARIANT_MAP: Record<DeviceStatus, { label: string; className: string; dotClass: string }> = {
  OPERATIONAL: {
    label: 'Operational',
    className: 'inline-flex items-center gap-1.5 rounded-full bg-conf-high-bg px-3 py-1 text-xs font-semibold text-conf-high',
    dotClass: 'bg-conf-high',
  },
  DAMAGED: {
    label: 'Damaged',
    className: 'inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-3 py-1 text-xs font-semibold text-danger',
    dotClass: 'bg-danger',
  },
  UNDER_MAINTENANCE: {
    label: 'Under Maintenance',
    className: 'inline-flex items-center gap-1.5 rounded-full bg-warning-bg px-3 py-1 text-xs font-semibold text-conf-medium',
    dotClass: 'bg-conf-medium',
  },
  OFFLINE: {
    label: 'Offline',
    className: 'inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-ink-muted',
    dotClass: 'bg-ink-muted',
  },
  RETIRED: {
    label: 'Retired',
    className: 'inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1 text-xs font-semibold text-ink-muted',
    dotClass: 'bg-ink-muted',
  },
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const variant = VARIANT_MAP[status];
  return (
    <span className={variant.className} role="status" aria-label={`Status: ${variant.label}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${variant.dotClass}`} aria-hidden />
      {variant.label}
    </span>
  );
}

export function DeviceSummaryCards({ total, operational, damaged, underMaintenance }: {
  total: number;
  operational: number;
  damaged: number;
  underMaintenance: number;
}) {
  const scrollRoot = useAppScrollRoot();
  const cards = [
    { label: 'Total Devices', value: total, icon: Activity, iconBg: 'bg-primary-light text-primary' },
    { label: 'Operational', value: operational, icon: Check, iconBg: 'bg-conf-high-bg text-conf-high' },
    { label: 'Damaged', value: damaged, icon: AlertTriangle, iconBg: 'bg-danger-bg text-danger' },
    { label: 'Under Maintenance', value: underMaintenance, icon: Wrench, iconBg: 'bg-warning-bg text-conf-medium' },
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <Reveal key={card.label} root={scrollRoot} delayMs={i * 90} className="h-full">
          <div className="group h-full rounded-2xl border border-line bg-surface p-5 shadow-card card-polished">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{card.label}</p>
                <p className="mt-1 text-3xl font-extrabold text-ink">{card.value}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${card.iconBg}`}>
                <card.icon width={20} height={20} />
              </div>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export default DeviceSummaryCards;
