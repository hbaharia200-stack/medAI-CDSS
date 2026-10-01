import { useTranslation } from 'react-i18next';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboardStore } from '../../state/useDashboardStore';
import { Button } from '../../components/common/Button';
import { AlertBanner } from '../../components/common/AlertBanner';
import { sortQueue } from '../../utils/queueSort';
import { useAppScrollRoot } from '../../hooks/useScrollReveal';
import Reveal from '../../components/marketing/Reveal';

export default function PatientsDashboard() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const scrollRoot = useAppScrollRoot();
  const queue = useDashboardStore((state) => state.queue);
  const loading = useDashboardStore((state) => state.queueLoading);
  const queueError = useDashboardStore((state) => state.queueError);
  const loadQueue = useDashboardStore((state) => state.loadQueue);
  useEffect(() => { void loadQueue(); }, [loadQueue]);
  const patients = sortQueue(queue).map(({ case: c }) => ({
    ...c.patient,
    id: c.id,
    status: c.status,
    nurse: c.nurseId ?? '—',
    doctor: c.doctorId ?? '—',
    lastVisit: new Date(c.createdAt).toLocaleString(),
  }));
  const filtered = patients.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()) || (p.phone ?? '').includes(filter) || p.id.includes(filter));

  return (
    <div className="space-y-6">
      <div>
        <div className="overflow-hidden pb-1 pt-1"><h1 className="text-2xl font-extrabold text-heading">{t('nav.patientsDashboard')}</h1></div>
        <p className="subtitle-typewriter text-sm text-ink-muted">{t('app.systemName')}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal root={scrollRoot} className="h-full">
          <Card className="h-full">
            <p className="text-sm font-semibold text-ink-muted">{t('dashboards.totalPatients')}</p>
            <p className="mt-1 text-3xl font-extrabold text-ink">{new Set(queue.map((row) => row.case.patient.id)).size}</p>
          </Card>
        </Reveal>
        <Reveal root={scrollRoot} delayMs={90} className="h-full">
          <Card className="h-full">
            <p className="text-sm font-semibold text-ink-muted">{t('dashboards.patientsInTriage')}</p>
            <p className="mt-1 text-3xl font-extrabold text-conf-medium">{queue.length}</p>
          </Card>
        </Reveal>
        <Reveal root={scrollRoot} delayMs={180} className="h-full">
          <Card className="h-full">
            <p className="text-sm font-semibold text-ink-muted">{t('dashboards.averageWaitTime')}</p>
            <p className="mt-1 text-3xl font-extrabold text-ink">—</p>
          </Card>
        </Reveal>
        <Reveal root={scrollRoot} delayMs={270} className="h-full">
          <Card className="h-full">
            <p className="text-sm font-semibold text-ink-muted">{t('dashboards.nextInTriage')}</p>
            <p className="mt-1 text-lg font-bold text-primary">{patients[0]?.name ?? '—'}</p>
          </Card>
        </Reveal>
      </div>

      {/* Table */}
      <Reveal root={scrollRoot} delayMs={90}>
      <Card>
        <div className="mb-4 flex items-center gap-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={t('common.search')}
            placeholder={t('common.searchPlaceholder')}
            className="h-10 flex-1 rounded-xl border-2 border-line bg-canvas px-4 text-sm focus:border-primary focus:outline-none"
          />
          <Button label={t('common.refresh')} variant="outline" onClick={() => void loadQueue()} loading={loading} />
        </div>
        {queueError ? <AlertBanner text={t('doctor.queueLoadError')} variant="warning" /> : null}
        {!loading && !queueError && filtered.length === 0 ? <p className="py-4 text-sm text-ink-muted">{t('doctor.queueEmpty')}</p> : null}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th>{t('diagnosis.patientName')}</th>
                <th>Age</th>
                <th>Sex</th>
                <th>{t('appointments.phone')}</th>
                <th>{t('common.status')}</th>
                <th>Nurse</th>
                <th>Doctor</th>
                <th>{t('appointments.recent')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0 transition-colors hover:bg-canvas">
                  <td className="font-bold text-ink"><Link to={`/app/diagnosis/${p.id}`} className="text-primary hover:underline">{p.name}</Link><span className="block text-xs font-normal text-ink-muted">#{p.id}</span></td>
                  <td className="text-ink">{p.age}</td>
                  <td className="text-ink">{p.sex}</td>
                  <td className="text-ink-muted">{p.phone}</td>
                  <td><Badge label={p.status} variant={p.status === 'completed' ? 'high' : 'medium'} /></td>
                  <td className="text-ink">{p.nurse}</td>
                  <td className="text-ink">{p.doctor}</td>
                  <td className="text-ink-muted">{p.lastVisit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile stacked cards — same fields, no horizontal scroll */}
        <div className="space-y-3 md:hidden">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-xl border border-line bg-canvas p-3">
              <div className="flex items-center justify-between gap-2">
                <Link to={`/app/diagnosis/${p.id}`} className="text-sm font-bold text-primary hover:underline">{p.name}</Link>
                <Badge label={p.status} variant={p.status === 'completed' ? 'high' : 'medium'} />
              </div>
              <p className="mt-1 break-all text-xs text-ink-muted">#{p.id}</p>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between gap-2"><dt className="text-ink-muted">Age · Sex</dt><dd className="font-medium text-ink">{p.age} · {p.sex}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-muted">{t('appointments.phone')}</dt><dd className="font-medium text-ink">{p.phone}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-muted">Nurse</dt><dd className="truncate font-medium text-ink">{p.nurse}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-muted">Doctor</dt><dd className="truncate font-medium text-ink">{p.doctor}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-ink-muted">{t('appointments.recent')}</dt><dd className="font-medium text-ink-muted">{p.lastVisit}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      </Card>
      </Reveal>
    </div>
  );
}
