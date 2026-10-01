import type { AuditLogEntry } from '../../types';

interface AuditLogTableProps {
  entries: AuditLogEntry[];
}

export function AuditLogTable({ entries }: AuditLogTableProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">No matching log entries.</p>;
  }
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Record</th>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-semibold text-ink">{e.user}</td>
              <td className="px-4 py-3 text-ink-muted">{e.role}</td>
              <td className="px-4 py-3 font-mono text-xs text-primary">{e.patientRecordId}</td>
              <td className="px-4 py-3 text-ink">{e.action}</td>
              <td className="px-4 py-3 text-ink-muted">
                {new Date(e.timestamp).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {/* Mobile stacked cards — same fields, no horizontal scroll */}
      <div className="space-y-3 md:hidden">
        {entries.map((e) => (
          <div key={e.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-bold text-ink">{e.user}</p>
              <p className="shrink-0 text-xs text-ink-muted">{e.role}</p>
            </div>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between gap-2"><dt className="text-ink-muted">Record</dt><dd className="truncate font-mono text-primary">{e.patientRecordId}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-muted">Action</dt><dd className="text-right font-medium text-ink">{e.action}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-muted">Timestamp</dt><dd className="text-right font-medium text-ink-muted">{new Date(e.timestamp).toLocaleString()}</dd></div>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}

export default AuditLogTable;