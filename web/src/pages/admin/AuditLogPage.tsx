import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuditLogEntry } from '../../types';
import { getAuditLogs } from '../../services/api/adminService';
import { Sidebar } from '../../components/common/Sidebar';
import { TopNav } from '../../components/common/TopNav';
import { AuditLogTable } from '../../components/admin/AuditLogTable';

export function AuditLogPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    void getAuditLogs().then(setEntries);
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return entries.filter((e) => {
      const matchesQuery =
        q === '' ||
        e.user.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.patientRecordId.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || e.role === roleFilter;
      return matchesQuery && matchesRole;
    });
  }, [entries, query, roleFilter]);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1">
        <TopNav title={t('admin.auditLogTitle')} subtitle={t('admin.auditLogSubtitle')} />
        <main className="p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('common.searchPlaceholder')}
              aria-label={t('common.search')}
              className="min-h-[44px] min-w-[260px] flex-1 rounded-xl border-2 border-line bg-surface px-3 text-base"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              aria-label={t('common.status')}
              className="min-h-[44px] rounded-xl border-2 border-line bg-surface px-3 text-base"
            >
              <option value="all">{t('common.filterAllRoles')}</option>
              <option value="doctor">{t('common.filterDoctor')}</option>
              <option value="nurse">{t('common.filterNurse')}</option>
              <option value="admin">{t('common.filterAdmin')}</option>
            </select>
          </div>

          <p className="mb-2 text-sm text-ink-muted">
            {filtered.length} {t('admin.entriesCount')}
          </p>
          <AuditLogTable entries={filtered} />
        </main>
      </div>
    </div>
  );
}

export default AuditLogPage;