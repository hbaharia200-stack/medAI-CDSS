import { motion } from 'framer-motion';
import type { Device } from '../../types/device';
import { DeviceStatusBadge } from './DeviceStatusBadge';
import { MaintenancePanel } from './MaintenancePanel';
import { MaintenanceHistory } from './MaintenanceHistory';

interface DeviceDetailsPanelProps {
  device: Device;
}

function fmtDate(d: string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function DeviceDetailsPanel({ device }: DeviceDetailsPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex-1 min-w-0"
    >
      {/* Device Information */}
      <section className="mb-6">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Device Information</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Device Name</dt>
            <dd className="mt-0.5 text-sm font-bold text-ink">{device.name}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Device Number</dt>
            <dd className="mt-0.5 text-sm font-bold text-ink font-mono">{device.deviceNumber}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Type</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{device.type}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Category</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{device.category}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Department</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{device.department}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light sm:col-span-2">
            <dt className="text-xs font-semibold text-ink-muted">Location</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink leading-relaxed">{device.location}</dd>
          </div>
        </dl>
      </section>

      {/* Technical Information */}
      <section className="mb-6">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Technical Information</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Manufacturer</dt>
            <dd className="mt-0.5 text-sm text-ink">{device.manufacturer ?? '—'}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Model</dt>
            <dd className="mt-0.5 text-sm text-ink">{device.model ?? '—'}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Serial Number</dt>
            <dd className="mt-0.5 text-sm text-ink font-mono">{device.serialNumber ?? '—'}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Firmware / Software</dt>
            <dd className="mt-0.5 text-sm text-ink font-mono">{device.firmwareVersion ?? '—'}</dd>
          </div>
        </dl>
      </section>

      {/* Lifecycle Information */}
      <section className="mb-6">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Lifecycle Information</h3>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Installation Date</dt>
            <dd className="mt-0.5 text-sm text-ink">{fmtDate(device.installationDate)}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Warranty Expiry</dt>
            <dd className="mt-0.5 text-sm text-ink">{fmtDate(device.warrantyExpiry)}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Expected Service Life</dt>
            <dd className="mt-0.5 text-sm text-ink">{device.expectedServiceLife ?? '—'}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light">
            <dt className="text-xs font-semibold text-ink-muted">Last Maintenance</dt>
            <dd className="mt-0.5 text-sm text-ink">{fmtDate(device.lastMaintenance)}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light sm:col-span-2">
            <dt className="text-xs font-semibold text-ink-muted">Next Scheduled Maintenance</dt>
            <dd className="mt-0.5 text-sm text-ink">{fmtDate(device.nextMaintenance)}</dd>
          </div>
          <div className="rounded-xl border border-line bg-canvas p-3 card-polished-light sm:col-span-2">
            <dt className="text-xs font-semibold text-ink-muted">Maintenance Interval</dt>
            <dd className="mt-0.5 text-sm text-ink">{device.maintenanceInterval ?? '—'}</dd>
          </div>
        </dl>
      </section>

      {/* Current Status */}
      <section className="mb-6">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Current Status</h3>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-4 card-polished-light">
          <DeviceStatusBadge status={device.status} />
          {device.notes && <p className="text-xs text-ink-muted">{device.notes}</p>}
        </div>
      </section>

      {/* Maintenance */}
      <MaintenancePanel device={device} />

      {/* Maintenance History */}
      <MaintenanceHistory records={device.maintenanceHistory ?? []} />
    </motion.div>
  );
}

export default DeviceDetailsPanel;
