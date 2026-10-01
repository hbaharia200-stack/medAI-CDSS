import type { MaintenanceRecord } from '../../types/device';
import { motion } from 'framer-motion';

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function MaintenanceHistory({ records }: { records: MaintenanceRecord[] }) {
  if (!records || records.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-muted">Maintenance History</h3>
        <p className="text-sm text-ink-muted">No maintenance records yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Maintenance History</h3>
        {records.length > 3 && (
          <button className="text-xs font-semibold text-primary hover:underline">
            View Maintenance History
          </button>
        )}
      </div>
      <div className="space-y-0">
        {records.map((rec, i) => (
          <motion.div
            key={rec.id}
            initial={{ opacity: 0, x: 12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.25, delay: i * 50, ease: [0.22, 1, 0.36, 1] }}
            className="flex gap-4 pb-4 last:pb-0"
          >
            <div className="flex flex-col items-center">
              <div className={"h-3 w-3 rounded-full ring-4 " + (rec.status === 'Completed' ? 'ring-conf-high-bg' : rec.status === 'Scheduled' ? 'ring-warning-bg' : 'ring-danger-bg')}>
                <div className={"h-2 w-2 rounded-full " + (rec.status === 'Completed' ? 'bg-conf-high' : rec.status === 'Scheduled' ? 'bg-conf-medium' : 'bg-danger')} />
              </div>
              {i < records.length - 1 && <div className="my-1 flex h-0.5 w-0.5 bg-line" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-ink">{rec.type}</p>
                <p className="text-xs font-semibold text-ink-muted">{fmtDate(rec.date)}</p>
              </div>
              <p className="text-xs font-semibold text-ink">{rec.status}</p>
              <p className="text-xs text-ink-muted">Technician: {rec.technician}</p>
              {rec.notes && <p className="mt-0.5 text-xs text-ink-muted italic">{rec.notes}</p>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
