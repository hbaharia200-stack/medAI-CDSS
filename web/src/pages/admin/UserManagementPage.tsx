import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClinicUser } from '../../types';
import { getUsers, saveUser, deleteUser } from '../../services/api/adminService';
import { Sidebar } from '../../components/common/Sidebar';
import { TopNav } from '../../components/common/TopNav';
import { Button } from '../../components/common/Button';
import { UserTable } from '../../components/admin/UserTable';
import { Card } from '../../components/common/Card';
import { useAppScrollRoot } from '../../hooks/useScrollReveal';
import Reveal from '../../components/marketing/Reveal';

const EMPTY_USER: Omit<ClinicUser, 'id' | 'lastActive'> = {
  name: '',
  role: 'nurse',
  active: true,
};

type Capability = 'viewQueue' | 'recordVitals' | 'confirmDx' | 'manageUsers' | 'viewAudit';

// Reference matrix of what each role is *allowed* to do. Authorization is
// actually enforced server-side by `@role_guard` on every route — this grid is a
// documentation aid for the admin, not the enforcement point.
const ROLE_PERMISSIONS: Record<ClinicUser['role'], Capability[]> = {
  doctor: ['viewQueue', 'confirmDx', 'viewAudit'],
  nurse: ['viewQueue', 'recordVitals'],
  admin: ['manageUsers', 'viewAudit'],
  staff: ['viewQueue'],
  patient: [],
};

const CAPABILITIES: Capability[] = ['viewQueue', 'recordVitals', 'confirmDx', 'manageUsers', 'viewAudit'];
const ROLES: ClinicUser['role'][] = ['doctor', 'nurse', 'admin', 'staff'];

/** Static role → capability matrix (mocked). */
function PermissionsMatrix() {
  const { t } = useTranslation();
  const scrollRoot = useAppScrollRoot();
  return (
    <div className="mt-6">
      <Reveal root={scrollRoot}>
      <Card title={t('admin.permissionsTitle')}>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-3 py-2">{t('admin.userTableRole')}</th>
                {CAPABILITIES.map((c) => (
                  <th key={c} className="px-3 py-2 text-center">
                    {t(`admin.cap.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((role) => (
                <tr key={role} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-semibold capitalize text-ink">{role}</td>
                  {CAPABILITIES.map((c) => (
                    <td key={c} className="px-3 py-2 text-center">
                      {ROLE_PERMISSIONS[role].includes(c) ? (
                        <span aria-label={t('admin.permGranted')} className="text-conf-high">✓</span>
                      ) : (
                        <span aria-label={t('admin.permDenied')} className="text-ink-muted">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile stacked cards — same matrix, no horizontal scroll */}
        <div className="space-y-3 md:hidden">
          {ROLES.map((role) => (
            <div key={role} className="rounded-xl border border-line bg-canvas p-3">
              <p className="text-sm font-bold capitalize text-ink">{role}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {CAPABILITIES.map((c) => (
                  <li key={c} className="flex items-center justify-between gap-2">
                    <span className="text-ink-muted">{t(`admin.cap.${c}`)}</span>
                    {ROLE_PERMISSIONS[role].includes(c) ? (
                      <span aria-label={t('admin.permGranted')} className="font-bold text-conf-high">✓</span>
                    ) : (
                      <span aria-label={t('admin.permDenied')} className="text-ink-muted">—</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
      </Reveal>
    </div>
  );
}

export function UserManagementPage() {
  const { t } = useTranslation();
  const scrollRoot = useAppScrollRoot();
  const [users, setUsers] = useState<ClinicUser[]>([]);
  const [roleFilter, setRoleFilter] = useState<'all' | ClinicUser['role']>('all');
  const [editing, setEditing] = useState<ClinicUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getUsers().then(setUsers);
  }, []);

  const visibleUsers = useMemo(
    () => (roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter)),
    [users, roleFilter],
  );

  const openNew = () =>
    setEditing({ ...EMPTY_USER, id: `new-${Date.now()}`, lastActive: new Date().toISOString() });

  const onSave = useCallback(async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError(t('admin.nameRequired'));
      return;
    }
    setError(null);
    setSaving(true);
    const saved = await saveUser(editing);
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === saved.id && !u.id.startsWith('new-'));
      return exists ? prev.map((u) => (u.id === saved.id ? saved : u)) : [...prev, saved];
    });
    setEditing(null);
    setSaving(false);
  }, [editing, t]);

  const onRemove = useCallback(async (user: ClinicUser) => {
    await deleteUser(user.id);
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <TopNav title={t('admin.userManagementTitle')} subtitle={t('admin.userManagementSubtitle')} />
        <main className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-ink">{t('admin.staffAccounts')}</h2>
              <p className="text-sm text-ink-muted">
                {users.length} {t('admin.accountCount')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                {t('admin.filterByRole')}
                <select
                  value={roleFilter}
                  onChange={(e) =>
                    setRoleFilter(e.target.value as 'all' | ClinicUser['role'])
                  }
                  className="min-h-[44px] rounded-xl border-2 border-line px-3 text-base"
                >
                  <option value="all">{t('admin.allRoles')}</option>
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                </select>
              </label>
              {!editing ? (
                <Button label={t('common.addUser')} onClick={openNew} icon="+" />
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-danger bg-danger-bg px-4 py-3 text-danger">
              {error}
            </div>
          ) : null}

          {editing ? (
            <div className="mb-6 rounded-2xl border border-line bg-surface p-4">
              <h3 className="mb-3 text-lg font-bold text-ink">
                {editing.id.startsWith('new-') ? t('admin.newUser') : `Edit ${editing.name}`}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">{t('admin.fullName')}</span>
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="min-h-[44px] w-full rounded-xl border-2 border-line px-3 text-base"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">{t('admin.role')}</span>
                  <select
                    value={editing.role}
                    onChange={(e) =>
                      setEditing({ ...editing, role: e.target.value as ClinicUser['role'] })
                    }
                    className="min-h-[44px] w-full rounded-xl border-2 border-line px-3 text-base"
                  >
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">{t('admin.specialty')}</span>
                  <input
                    value={editing.specialty ?? ''}
                    onChange={(e) => setEditing({ ...editing, specialty: e.target.value })}
                    placeholder={t('admin.specialtyPlaceholder')}
                    className="min-h-[44px] w-full rounded-xl border-2 border-line px-3 text-base"
                  />
                </label>
                <label className="flex min-h-[44px] items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-sm font-semibold">{t('admin.activeAccount')}</span>
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <Button label={t('common.save')} onClick={() => void onSave()} loading={saving} icon="✓" />
                <Button label={t('common.cancel')} variant="outline" onClick={() => setEditing(null)} />
              </div>
            </div>
          ) : null}

          <Reveal root={scrollRoot}>
            <UserTable users={visibleUsers} onEdit={setEditing} onRemove={(u) => void onRemove(u)} />
          </Reveal>

          <PermissionsMatrix />
        </main>
      </div>
    </div>
  );
}

export default UserManagementPage;