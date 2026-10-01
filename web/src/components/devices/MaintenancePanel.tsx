import type { Device } from '../../types/device';

export function MaintenancePanel({ device }: { device: Device }) {
  const isHealthy = device.status === 'OPERATIONAL';
  const fmt = (d: string | undefined) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-muted">Maintenance</h3>
      {isHealthy ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-line bg-canvas p-3">
            <span className="text-xs font-semibold text-ink-muted">Maintenance Status</span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-conf-high">
              <span className="h-2 w-2 rounded-full bg-conf-high" /> Operational
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-canvas p-3">
              <dt className="text-xs font-semibold text-ink-muted">Last Maintenance</dt>
              <dd className="mt-0.5 text-sm text-ink">{fmt(device.lastMaintenance)}</dd>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-3">
              <dt className="text-xs font-semibold text-ink-muted">Next Scheduled Maintenance</dt>
              <dd className="mt-0.5 text-sm text-ink">{fmt(device.nextMaintenance)}</dd>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-3 sm:col-span-2">
              <dt className="text-xs font-semibold text-ink-muted">Maintenance Interval</dt>
              <dd className="mt-0.5 text-sm text-ink">{device.maintenanceInterval ?? '—'}</dd>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-3 sm:col-span-2">
              <dt className="text-xs font-semibold text-ink-muted">Maintenance Provider</dt>
              <dd className="mt-0.5 text-sm text-ink">{device.maintenanceProvider ?? '—'}</dd>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-danger-bg bg-danger-bg/30 p-3">
            <span className="text-xs font-semibold text-ink-muted">Maintenance Status</span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-danger">
              <span className="h-2 w-2 rounded-full bg-danger animate-pulse" /> Requires Attention
            </span>
          </div>
          {device.detectedIssue && (
            <div className="rounded-xl border border-danger-bg bg-danger-bg/20 p-3">
              <dt className="text-xs font-semibold text-ink-muted">Detected Issue</dt>
              <dd className="mt-0.5 text-sm font-semibold text-danger">{device.detectedIssue}</dd>
            </div>
          )}
          <div className="rounded-xl border border-line bg-canvas p-3">
            <dt className="text-xs font-semibold text-ink-muted">Priority</dt>
            <dd className="mt-0.5 text-sm font-semibold text-ink">{device.priority ?? 'Medium'}</dd>
          </div>
          {device.recommendedActions && device.recommendedActions.length > 0 && (
            <div>
              <dt className="text-xs font-semibold text-ink-muted mb-2">Recommended Action</dt>
              <ul className="space-y-1.5">
                {device.recommendedActions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
