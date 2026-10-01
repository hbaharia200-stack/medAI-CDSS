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
    <span
      className={variant.className}
      role="status"
      aria-label={`Status: ${variant.label}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${variant.dotClass}`}
        aria-hidden
      />
      {variant.label}
    </span>
  );
}

export default DeviceStatusBadge;
