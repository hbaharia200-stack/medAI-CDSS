// Public booking API + the authenticated staff appointment book.
//
// Real persistence: `POST /api/appointments` creates an `Appointment` row, which
// the doctor/admin dashboard reads back through `GET /api/appointments`. There
// is no localStorage fallback — a failed booking surfaces as an error instead of
// a fake confirmation, because telling a patient their appointment is recorded
// when it is not would be a clinical-safety problem.
//
// Request body (JSON):
//   { patientName, phone, email?, doctor?, preferredDate: "YYYY-MM-DD",
//     preferredTime: "HH:MM", reason? }

import { ApiError, apiFetch } from './client';

export interface AppointmentRequest {
  patientName: string;
  phone: string;
  email?: string;
  doctor?: string;
  preferredDate: string;
  preferredTime: string;
  reason?: string;
}

export interface AppointmentConfirmation {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
}

export const APPOINTMENTS_ENDPOINT = '/appointments';

export async function createAppointment(
  request: AppointmentRequest,
): Promise<AppointmentConfirmation> {
  // The public booking route returns `{ success, data, id, status }` so that a
  // top-level `id` is available without unwrapping (see api/appointments.py).
  const created = await apiFetch<{
    id?: string;
    status?: string;
    data?: { id?: string; status?: string; created_at?: string };
  }>(APPOINTMENTS_ENDPOINT, { method: 'POST', body: JSON.stringify(request) });

  const id = created.id ?? created.data?.id;
  if (!id) {
    throw new ApiError(
      'The appointment was not saved. Please try again.',
      502,
      'appointment_not_persisted',
    );
  }
  const status = created.status ?? created.data?.status;
  return {
    id,
    status:
      status === 'confirmed' || status === 'cancelled' || status === 'completed'
        ? status
        : 'pending',
    createdAt: created.data?.created_at ?? new Date().toISOString(),
  };
}

/**
 * A real appointment row, exactly as `serialize_appointment_detail` returns it.
 *
 * `fees` is the facility's own configured figure. It is `null`/0 unless
 * `APPOINTMENT_DEFAULT_FEES` is set server-side — it is never invented here.
 */
export interface AppointmentRow {
  id: string;
  patientId?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  doctorId?: string | null;
  doctorName?: string | null;
  doctorSpecialization?: string | null;
  doctorLabel?: string | null;
  title?: string | null;
  reason?: string | null;
  /** Local appointment date, YYYY-MM-DD (the application timezone). */
  date?: string | null;
  /** Local appointment time, HH:MM. */
  time?: string | null;
  startTime: string | null;
  endTime: string | null;
  /** Real configured fee, or null when the facility has not set one. */
  fees?: number | null;
  status: string;
  createdAt?: string | null;
}

/** Staff view of the appointment book (doctor/admin). */
export async function listAppointments(params: {
  date?: string;
  from?: string;
  to?: string;
  status?: string;
  limit?: number;
  /** 'asc' (soonest first, the default) or 'desc'. */
  order?: 'asc' | 'desc';
} = {}): Promise<AppointmentRow[]> {
  const query = new URLSearchParams();
  if (params.date) query.set('date', params.date);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.order) query.set('order', params.order);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await apiFetch<{ data: AppointmentRow[] }>(`/appointments${suffix}`);
  return response.data;
}

/** Today's per-status counts straight from the backend. */
export async function getAppointmentsToday(): Promise<{
  date: string;
  counts: Record<string, number>;
}> {
  return apiFetch<{ data: { date: string; counts: Record<string, number> } }>(
    '/appointments/today',
  ).then((r) => r.data);
}

/**
 * Today in the APPLICATION timezone, as YYYY-MM-DD.
 *
 * Deliberately built from local date parts rather than `toISOString()`, which
 * would convert to UTC and can shift the day for users east or west of it —
 * that mismatch is exactly what made "Today's Appointments" disagree with the
 * rows actually stored.
 */
export function todayLocalISO(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today's date as YYYY-MM-DD-DD offset from the current one. */
export function localISODate(offsetDays = 0, now: Date = new Date()): string {
  const shifted = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  return todayLocalISO(shifted);
}

export const appointmentService = {
  createAppointment,
  listAppointments,
  getAppointmentsToday,
};

export default appointmentService;
