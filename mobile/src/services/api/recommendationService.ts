// Doctor-approved test assignments the nurse has to carry out.
//
// Everything here is read from / written to Flask:
//   GET   /api/nurses/me/recommendations       the nurse's inbox
//   PATCH /api/nurses/assignments/<id>/status  the assignment lifecycle
//
// The backend's AssignmentStatus values (pending -> sent -> acknowledged ->
// completed) are the single source of truth; they are mapped onto the four
// presentation states the mobile UI already has.
import type { RecommendedTestItem, RecommendedTestStatus } from '../../types';
import { apiFetch } from './client';

interface ApiResponse<T> {
  data: T;
}

type AssignmentStatus = 'pending' | 'sent' | 'acknowledged' | 'completed';

interface Assignment {
  id: string;
  caseId: string;
  /** Short human-scannable reference (first 8 of the case id). */
  caseReference?: string | null;
  patientId: string;
  /** Resolved from the database by the API — never a placeholder id. */
  patientName?: string | null;
  patientPhone?: string | null;
  doctorId: string;
  doctorName?: string | null;
  tests: Array<{ id: string; name: string; type?: 'lab' | 'vital' }>;
  status: AssignmentStatus;
  createdAt: string;
  sentAt?: string | null;
  acknowledgedAt?: string | null;
  completedAt?: string | null;
}

function itemStatus(status: AssignmentStatus): RecommendedTestStatus {
  if (status === 'completed') return 'completed';
  if (status === 'acknowledged') return 'in_progress';
  if (status === 'sent') return 'ordered';
  return 'recommended';
}

function flattenAssignment(assignment: Assignment): RecommendedTestItem[] {
  // The API resolves the real patient name. A short case reference is kept as
  // secondary metadata. Only if the name is genuinely missing do we fall back
  // to a short id — a bare UUID is never used as the headline label.
  const patientName =
    assignment.patientName?.trim() ||
    `Unknown patient · case ${assignment.caseReference ?? assignment.caseId.slice(0, 8)}`;
  return assignment.tests.map((test) => ({
    id: `${assignment.id}:${test.id}`,
    assignmentId: assignment.id,
    caseId: assignment.caseId,
    patientName,
    testName: test.name,
    type: test.type ?? 'lab',
    recommendationSource: 'doctor',
    status: itemStatus(assignment.status),
    createdAt: assignment.createdAt,
    // `completed` is the real terminal state; the badge is derived from it so a
    // refresh cannot contradict the database.
    sentToPatient: assignment.status === 'completed',
    sentAt: assignment.completedAt ?? assignment.acknowledgedAt ?? assignment.sentAt ?? undefined,
  }));
}

export async function getRecommendedTests(): Promise<RecommendedTestItem[]> {
  const response = await apiFetch<ApiResponse<Assignment[]>>('/nurses/me/recommendations');
  return response.data.flatMap(flattenAssignment);
}

/** Advances the whole assignment to the next lifecycle state. */
export async function setAssignmentStatus(
  assignmentId: string,
  status: AssignmentStatus,
): Promise<Assignment> {
  const response = await apiFetch<ApiResponse<Assignment>>(
    `/nurses/assignments/${encodeURIComponent(assignmentId)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  );
  return response.data;
}

/** The nurse has started the requested tests. */
export async function acknowledgeAssignment(assignmentId: string): Promise<boolean> {
  await setAssignmentStatus(assignmentId, 'acknowledged');
  return true;
}

/** The nurse has finished the requested tests and recorded the result. */
export async function completeAssignment(assignmentId: string): Promise<boolean> {
  await setAssignmentStatus(assignmentId, 'completed');
  return true;
}

/** Kept for the existing call sites; now performs a real status write. */
export async function sendRecommendedTestToPatient(id: string): Promise<boolean> {
  const assignmentId = id.split(':', 1)[0];
  await setAssignmentStatus(assignmentId, 'acknowledged');
  return true;
}
