import { useTranslation } from 'react-i18next';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { useState } from 'react';
import { Icons } from '../components/common/Icons';
import { useAppScrollRoot } from '../hooks/useScrollReveal';
import Reveal from '../components/marketing/Reveal';

const VIEWS = ['month', 'week', 'day'] as const;

const SCHEDULE_ITEMS = [
  { time: '08:00 - 09:00', title: 'Staff Meeting', type: 'meeting' },
  { time: '09:00 - 10:00', title: 'Patient Rounds', type: 'clinical' },
  { time: '10:00 - 12:00', title: 'Surgery - Asha Mohamed', type: 'clinical' },
  { time: '14:00 - 15:00', title: 'Admin Work', type: 'admin' },
  { time: '15:00 - 16:00', title: 'Patient Consultation', type: 'clinical' },
] as const;

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

type EventKind = 'clinical' | 'general' | 'meeting' | 'admin';

const EVENT_STYLES: Record<EventKind, { bar: string; tint: string }> = {
  clinical: { bar: 'border-primary', tint: 'bg-primary/5' },
  general: { bar: 'border-[#52d3d8]', tint: 'bg-[#52d3d8]/5' },
  meeting: { bar: 'border-conf-high', tint: 'bg-conf-high/5' },
  admin: { bar: 'border-conf-medium', tint: 'bg-conf-medium/5' },
};

const CALENDAR_EVENTS: Record<number, Array<{ title: string; time: string; kind: EventKind }>> = {
  2: [{ title: 'Dr. John Davis', time: '11:00 AM', kind: 'clinical' }],
  4: [{ title: 'Staff Meeting', time: '09:00 AM', kind: 'meeting' }],
  7: [{ title: 'Surgery - Asha Mohamed', time: '08:00 AM', kind: 'clinical' }],
  9: [{ title: 'General Consultation', time: '12:00 PM', kind: 'general' }],
  11: [{ title: 'Admin Work', time: '02:00 PM', kind: 'admin' }],
  15: [{ title: 'Dr. Amina Hassan', time: '10:30 AM', kind: 'clinical' }],
  18: [{ title: 'Clinical Meeting', time: '01:00 PM', kind: 'meeting' }],
  23: [{ title: 'Patient Rounds', time: '09:30 AM', kind: 'clinical' }],
  28: [{ title: 'Admin Work', time: '03:00 PM', kind: 'admin' }],
};

/** Builds the weeks array for a month grid (Sunday-first, 0 = empty cell). */
function buildMonthGrid(date: Date): Array<Array<number>> {
  const leading = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const cells: number[] = Array(leading).fill(0);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(0);
  const weeks: Array<Array<number>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export default function SchedulePage() {
  const { t } = useTranslation();
  const scrollRoot = useAppScrollRoot();
  const [view, setView] = useState<(typeof VIEWS)[number]>('week');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calDate, setCalDate] = useState<Date>(new Date());
  const [events, setEvents] = useState(CALENDAR_EVENTS);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<{ title: string; day: string; time: string; kind: EventKind }>({
    title: '',
    day: '',
    time: '',
    kind: 'general',
  });

  const statusVariant = (status: string) =>
    status === 'available' ? 'high' : 'urgent';

  const now = new Date();
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calDate);
  const isCurrentMonth = calDate.getMonth() === now.getMonth() && calDate.getFullYear() === now.getFullYear();
  const daysInMonth = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 0).getDate();
  const shiftMonth = (delta: number) => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + delta, 1));
  const weeks = buildMonthGrid(calDate);

  const saveEvent = () => {
    const day = Number(form.day);
    if (!form.title.trim() || !Number.isInteger(day) || day < 1 || day > daysInMonth) return;
    const time = form.time
      ? new Date(`2000-01-01T${form.time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '';
    setEvents((prev) => ({
      ...prev,
      [day]: [...(prev[day] ?? []), { title: form.title.trim(), time, kind: form.kind }],
    }));
    setModalOpen(false);
    setForm({ title: '', day: '', time: '', kind: 'general' });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal root={scrollRoot} className="h-full">
        <Card title={t('schedule.staffActivities')} className="h-full">
          <div className="space-y-3">
            {SCHEDULE_ITEMS.map((item, i) => (
              <Reveal key={i} root={scrollRoot} delayMs={i * 90}>
              <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-4 card-polished-light">
                <span className="text-sm font-bold text-primary">{item.time}</span>
                <span className="text-sm font-medium text-ink">{item.title}</span>
              </div>
              </Reveal>
            ))}
          </div>
        </Card>
        </Reveal>

        <Reveal root={scrollRoot} delayMs={90} className="h-full">
        <Card title={t('schedule.doctorAvailability')} className="h-full">
          <div className="space-y-3">
            {[
              { name: 'Dr. Amina Hassan', status: 'available', hours: '08:00 - 16:00' },
              { name: 'Dr. David Otieno', status: 'available', hours: '09:00 - 17:00' },
              { name: 'Dr. Grace Mwakimbeti', status: 'unavailable', hours: 'On leave' },
            ].map((doc, i) => (
              <Reveal key={i} root={scrollRoot} delayMs={i * 90}>
              <div className="flex items-center justify-between rounded-xl border border-line bg-canvas p-4 card-polished-light">
                <div>
                  <p className="text-sm font-semibold text-ink">{doc.name}</p>
                  <p className="text-xs text-ink-muted">{doc.hours}</p>
                </div>
                <Badge label={doc.status === 'available' ? t('schedule.available') : t('schedule.unavailable')} variant={statusVariant(doc.status)} />
              </div>
              </Reveal>
            ))}
          </div>
        </Card>
        </Reveal>
      </div>

      {/* Central bridge between summary cards and the detailed schedule */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setCalendarOpen(!calendarOpen)}
          aria-expanded={calendarOpen}
          className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-8 py-2 text-sm font-bold text-ink transition-colors hover:bg-canvas"
        >
          {calendarOpen ? t('schedule.hideSchedule') : t('schedule.viewFullSchedule')}
          <span className={`transition-transform duration-200 ${calendarOpen ? 'rotate-180' : ''}`}>
            {Icons.chevronDown({ width: 16, height: 16 })}
          </span>
        </button>
      </div>

      {calendarOpen && (
        <Reveal root={scrollRoot}>
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-card">
          {/* Calendar toolbar: navigation + view toggles + add action */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                {Icons.chevronsLeft({ width: 16, height: 16 })}
              </button>
              <h2 className="w-44 text-center text-lg font-bold text-ink">{monthLabel}</h2>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
              >
                {Icons.chevronsRight({ width: 16, height: 16 })}
              </button>
            </div>

            <div className="flex gap-1 rounded-lg border border-line bg-canvas p-1">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize ${view === v ? 'bg-primary text-white' : 'text-ink hover:bg-surface'}`}
                >
                  {t(`schedule.${v}`)}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              {Icons.plus({ width: 14, height: 14 })}
              {t('schedule.addSchedule')}
            </button>
          </div>

          {/* Month grid — desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse border border-line">
              <thead>
                <tr className="bg-canvas/50">
                  {DAY_LABELS.map((label) => (
                    <th key={label} className="border border-line p-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((day, di) => {
                      const isToday = isCurrentMonth && day === now.getDate();
                      return (
                        <td
                          key={di}
                          className={`h-32 border border-line p-2 align-top ${
                            day === 0 ? 'bg-canvas/40' : isToday ? 'bg-primary/10' : ''
                          }`}
                        >
                          {day > 0 && (
                            <>
                              <p className={`text-xs leading-tight text-ink-muted ${isToday ? 'font-black text-primary' : 'font-bold'}`}>
                                {day}
                              </p>
                              {(events[day] ?? []).map((ev, j) => {
                                const style = EVENT_STYLES[ev.kind];
                                return (
                                  <div key={j} className={`mt-1 rounded-lg border-l-4 ${style.bar} ${style.tint} p-1.5`}>
                                    <p className="text-[10px] font-bold leading-tight text-ink">{ev.title}</p>
                                    <p className="text-[10px] leading-tight text-ink-muted">{ev.time}</p>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Month agenda — mobile stacked cards, no horizontal scroll */}
          <div className="space-y-3 md:hidden">
            {weeks.flatMap((week) => week.filter((day) => day > 0)).map((day) => (
              <div key={day} className="rounded-xl border border-line bg-canvas p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm font-bold ${isCurrentMonth && day === now.getDate() ? 'text-primary' : 'text-ink'}`}>Day {day}</p>
                  <p className="text-xs text-ink-muted">{(events[day] ?? []).length} event(s)</p>
                </div>
                <div className="mt-2 space-y-1.5">
                  {(events[day] ?? []).length === 0 ? (
                    <p className="text-xs text-ink-muted">No events</p>
                  ) : (
                    (events[day] ?? []).map((ev, j) => {
                      const style = EVENT_STYLES[ev.kind];
                      return (
                        <div key={j} className={`rounded-lg border-l-4 ${style.bar} ${style.tint} p-2`}>
                          <p className="text-xs font-bold leading-tight text-ink">{ev.title}</p>
                          <p className="text-[11px] leading-tight text-ink-muted">{ev.time}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        </Reveal>
      )}

      {/* Add Schedule modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink">{t('schedule.addNewSchedule')}</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label={t('schedule.cancel')}
                className="text-ink-muted transition-colors hover:text-ink"
              >
                {Icons.x({ width: 18, height: 18 })}
              </button>
            </div>

            <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="sched-title">
              {t('schedule.doctorName')}
            </label>
            <input
              id="sched-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('schedule.doctorName')}
              className="mb-3 w-full rounded-lg border border-line bg-canvas p-2 text-sm text-ink outline-none focus:border-primary"
            />

            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="sched-day">
                  {t('schedule.dayOfMonth')}
                </label>
                <input
                  id="sched-day"
                  type="number"
                  min={1}
                  max={daysInMonth}
                  value={form.day}
                  onChange={(e) => setForm({ ...form, day: e.target.value })}
                  className="w-full rounded-lg border border-line bg-canvas p-2 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="sched-time">
                  {t('schedule.time')}
                </label>
                <input
                  id="sched-time"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="w-full rounded-lg border border-line bg-canvas p-2 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <label className="mb-1 block text-xs font-semibold text-ink-muted" htmlFor="sched-kind">
              {t('schedule.category')}
            </label>
            <select
              id="sched-kind"
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as EventKind })}
              className="mb-4 w-full rounded-lg border border-line bg-canvas p-2 text-sm text-ink outline-none focus:border-primary"
            >
              <option value="clinical">{t('schedule.optDoctor')}</option>
              <option value="general">{t('schedule.optGeneral')}</option>
              <option value="meeting">{t('schedule.optMeeting')}</option>
              <option value="admin">{t('schedule.optAdmin')}</option>
            </select>

            <button
              type="button"
              onClick={saveEvent}
              className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              {t('schedule.saveSchedule')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
