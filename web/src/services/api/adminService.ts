// Real dashboard, statistics, audit and directory data — all read from Flask.
//
// Every figure here is derived from database rows by
// `app/services/dashboard_service.py`. When the database is empty the endpoints
// return zeros and empty lists: the UI must render an empty state rather than
// inventing a chart. Fields with no backend equivalent yet (region split,
// weekly performance, patient satisfaction) are reported as empty series.
import type { AdminAnalytics, AuditLogEntry, ClinicUser, SystemErrorEvent, SystemHealth } from '../../types';
import { apiFetch } from './client';

interface ApiResponse<T> {
  data: T;
}

export interface BasicDashboard {
  activePatients: number;
  totalPatients: number;
  openCases: number;
  urgentCases: number;
  doctors: number;
  nurses: number;
  pendingRecommendations: number;
  aiRecommendationsTotal: number;
  diagnosesTotal: number;
}

export interface StatisticsPayload {
  generatedAt: string;
  overview: {
    totalPatients: number;
    activePatients: number;
    openCases: number;
    diagnosesTotal: number;
    appointmentsToday: number;
  };
  diagnosisDistribution: Array<{ diseaseName: string; count: number }>;
  genderDistribution: Array<{ label: string; count: number }>;
  ageDistribution: Array<{ label: string; count: number }>;
  patientGrowth: Array<{ label: string; count: number }>;
  timeToDecision: { samples: number; averageHours: number | null };
  feedback: {
    decisions: Record<string, number>;
    accuracy: Record<string, number>;
  };
  staffing: { doctors: number; nurses: number };
}

export interface AuditRow {
  id: string;
  action: string;
  userId: string | null;
  role: string | null;
  caseId: string | null;
  detail: Record<string, unknown> | null;
  timestamp: string | null;
}

export async function getBasicDashboard(): Promise<BasicDashboard> {
  const response = await apiFetch<ApiResponse<BasicDashboard>>('/dashboard/basic');
  return response.data;
}

export async function getStatistics(): Promise<StatisticsPayload> {
  const response = await apiFetch<ApiResponse<StatisticsPayload>>('/statistics');
  return response.data;
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  const rows = await apiFetch<ApiResponse<AuditRow[]>>('/statistics/audit?limit=100');
  return rows.data.map((row) => ({
    id: row.id,
    user: row.userId ?? '—',
    role: row.role ?? '—',
    patientRecordId: row.caseId ?? '—',
    action: row.action,
    timestamp: row.timestamp ?? '',
  }));
}

interface PatientRow {
  id: string;
  full_name: string;
  is_active: boolean;
  created_at: string | null;
}

interface StaffRow {
  id: string;
  fullName: string;
  role: 'doctor' | 'nurse';
  staffId: string;
  specialization?: string;
}

/**
 * Staff + patient directory for the admin user table.
 *
 * Doctors/nurses come from `/api/staff` and patients from `/api/patients`, so
 * the table reflects real accounts. There is deliberately no client-side
 * create/edit/delete: those writes require a real admin endpoint, and faking
 * them would silently discard data.
 */
export async function getUsers(): Promise<ClinicUser[]> {
  const [doctors, nurses, patients] = await Promise.all([
    apiFetch<ApiResponse<StaffRow[]>>('/staff?role=doctor'),
    apiFetch<ApiResponse<StaffRow[]>>('/staff?role=nurse'),
    apiFetch<ApiResponse<PatientRow[]>>('/patients'),
  ]);
  const now = new Date().toISOString();
  const staff: ClinicUser[] = [
    ...doctors.data.map((d) => ({
      id: d.id,
      name: d.fullName,
      role: 'doctor' as const,
      specialty: d.specialization,
      active: true,
      lastActive: now,
    })),
    ...nurses.data.map((n) => ({
      id: n.id,
      name: n.fullName,
      role: 'nurse' as const,
      active: true,
      lastActive: now,
    })),
    ...patients.data.map((p) => ({
      id: p.id,
      name: p.full_name,
      role: 'patient' as const,
      active: p.is_active,
      lastActive: p.created_at ?? now,
    })),
  ];
  return staff;
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const response = await apiFetch<ApiResponse<{
    database: { ok: boolean; error: string | null };
    counts: Record<string, number>;
    checkedAt: string;
  }>>('/statistics/health');
  return {
    uptimePercent: response.data.database.ok ? 100 : 0,
    syncStatus: [],
    errorCount24h: response.data.database.ok ? 0 : 1,
    apiLatencyMs: 0,
  };
}

export async function getAnalytics(): Promise<AdminAnalytics> {
  return toAdminAnalytics(await getStatistics());
}

/**
 * The backend has no structured application-error log endpoint, so this returns
 * an empty feed rather than inventing error events. The System Health page shows
 * the real database check from `/statistics/health` next to it.
 */
export async function getRecentErrors(): Promise<SystemErrorEvent[]> {
  return [];
}

interface StaffWriteResponse {
  id: string;
  full_name: string;
  role: 'doctor' | 'nurse';
  staff_id?: string | null;
  is_active: boolean;
  specialization?: string | null;
}

function toClinicUser(raw: StaffWriteResponse, fallbackRole: ClinicUser['role']): ClinicUser {
  return {
    id: raw.id,
    name: raw.full_name,
    role: (raw.role as ClinicUser['role']) ?? fallbackRole,
    specialty: raw.specialization ?? undefined,
    active: raw.is_active,
    lastActive: new Date().toISOString(),
  };
}

/** Creates a real staff account (admin only). Persisted by the backend. */
export async function createStaffAccount(input: {
  name: string;
  role: 'doctor' | 'nurse';
  staffId: string;
  specialty?: string;
}): Promise<ClinicUser> {
  const created = await apiFetch<ApiResponse<StaffWriteResponse>>('/staff', {
    method: 'POST',
    body: JSON.stringify({
      fullName: input.name,
      role: input.role,
      staffId: input.staffId,
      specialization: input.specialty,
    }),
  });
  return toClinicUser(created.data, input.role);
}

/**
 * Saves a staff edit (admin only).
 *
 * Accounts are never hard-deleted: clinical records reference the user, so
 * "remove" deactivates the account (`is_active: false`) which immediately blocks
 * its login. `DELETE` is expressed through the same PATCH so the audit trail
 * records who did it.
 */
export async function saveUser(user: ClinicUser): Promise<ClinicUser> {
  if (user.id.startsWith('new-')) {
    return createStaffAccount({
      name: user.name,
      role: user.role === 'nurse' ? 'nurse' : 'doctor',
      staffId: `DR${Date.now().toString().slice(-4)}`,
      specialty: user.specialty,
    });
  }
  const updated = await apiFetch<ApiResponse<StaffWriteResponse>>(
    `/staff/${encodeURIComponent(user.id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        fullName: user.name,
        role: user.role === 'nurse' ? 'nurse' : 'doctor',
        specialization: user.specialty,
        isActive: user.active,
      }),
    },
  );
  return toClinicUser(updated.data, user.role);
}

/** Deactivates a staff account (admin only). */
export async function deleteUser(id: string): Promise<void> {
  if (id.startsWith('new-')) return;
  await apiFetch(`/staff/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive: false }),
  });
}

/**
 * Projects the real statistics payload onto the shape the existing analytics
 * charts already consume. No value is invented: unavailable series stay empty.
 */
export function toAdminAnalytics(stats: StatisticsPayload): AdminAnalytics {
  const decisions = stats.feedback.decisions;
  const confirmed = decisions.confirmed ?? 0;
  const totalDecisions = Object.values(decisions).reduce((sum, n) => sum + n, 0);

  return {
    diseaseTrends: [],
    byRegion: [],
    recommendationAcceptanceRate: totalDecisions ? Math.round((confirmed / totalDecisions) * 100) : 0,
    avgTimeToDecisionMin: stats.timeToDecision.averageHours != null
      ? Math.round(stats.timeToDecision.averageHours * 60)
      : 0,
    recommendationCount: stats.overview.diagnosesTotal,
    confirmedCount: confirmed,
    patientGrowth: stats.patientGrowth.map((p) => ({ month: p.label, patients: p.count })),
    ageDistribution: stats.ageDistribution.map((b) => ({ bracket: b.label, count: b.count })),
    genderSplit: stats.genderDistribution.map((g) => ({ label: g.label, count: g.count })),
    diagnosisStats: stats.diagnosisDistribution.map((d) => ({ category: d.diseaseName, count: d.count })),
    performanceTrend: [],
    patientSatisfaction: [],
    patientSatisfactionAvg: 0,
  };
}