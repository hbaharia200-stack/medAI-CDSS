import { useTranslation } from 'react-i18next';
import type { ClinicUser } from '../../types';
import { Badge } from '../common/Badge';

interface UserTableProps {
  users: ClinicUser[];
  onEdit: (user: ClinicUser) => void;
  onRemove: (user: ClinicUser) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.round(diff / 3_600_000);
  if (h < 1) return '< 1h ago';
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function UserTable({ users, onEdit, onRemove }: UserTableProps) {
  const { t } = useTranslation();

  if (users.length === 0) {
    return <p className="text-sm text-ink-muted">{t('admin.noUsers')}</p>;
  }
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface md:block">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-3">{t('admin.userTableName')}</th>
            <th className="px-4 py-3">{t('admin.userTableRole')}</th>
            <th className="px-4 py-3">{t('admin.userTableStatus')}</th>
            <th className="px-4 py-3">{t('admin.userTableLastActive')}</th>
            <th className="px-4 py-3 text-right">{t('admin.userTableActions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3">
                <p className="font-bold text-ink">{u.name}</p>
                {u.specialty ? <p className="text-xs text-ink-muted">{u.specialty}</p> : null}
              </td>
              <td className="px-4 py-3">
                <Badge
                  label={u.role}
                  variant={u.role === 'doctor' ? 'info' : u.role === 'admin' ? 'high' : 'neutral'}
                />
              </td>
              <td className="px-4 py-3">
                <Badge
                  label={u.active ? t('common.active') : t('common.inactive')}
                  variant={u.active ? 'high' : 'low'}
                />
              </td>
              <td className="px-4 py-3 text-ink-muted">{timeAgo(u.lastActive)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(u)}
                    className="min-h-[40px] rounded-lg border border-line px-3 font-semibold text-primary hover:bg-primary-light"
                  >
                    {t('admin.userTableEdit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(u)}
                    className="min-h-[40px] rounded-lg border border-line px-3 font-semibold text-danger hover:bg-danger-bg"
                  >
                    {t('admin.userTableRemove')}
                  </button>
                </div>
              </td>
            </tr>
          ))}

        </tbody>
      </table>
      </div>
      {/* Mobile stacked cards — same fields, no horizontal scroll */}
      <div className="space-y-3 md:hidden">
        {users.map((u) => (
          <div key={u.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{u.name}</p>
                {u.specialty ? <p className="truncate text-xs text-ink-muted">{u.specialty}</p> : null}
              </div>
              <Badge
                label={u.role}
                variant={u.role === 'doctor' ? 'info' : u.role === 'admin' ? 'high' : 'neutral'}
              />
            </div>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between gap-2"><dt className="text-ink-muted">{t('admin.userTableStatus')}</dt><dd><Badge label={u.active ? t('common.active') : t('common.inactive')} variant={u.active ? 'high' : 'low'} /></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-muted">{t('admin.userTableLastActive')}</dt><dd className="font-medium text-ink-muted">{timeAgo(u.lastActive)}</dd></div>
            </dl>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(u)}
                className="min-h-[40px] flex-1 rounded-lg border border-line px-3 text-sm font-semibold text-primary hover:bg-primary-light"
              >
                {t('admin.userTableEdit')}
              </button>
              <button
                type="button"
                onClick={() => onRemove(u)}
                className="min-h-[40px] flex-1 rounded-lg border border-line px-3 text-sm font-semibold text-danger hover:bg-danger-bg"
              >
                {t('admin.userTableRemove')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default UserTable;