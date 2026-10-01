import { apiFetch, API_BASE_URL } from './client';
import { getAccessToken } from '../auth/tokenStorage';

/**
 * The patient's own clinical intake, read back from the backend.
 *
 * Everything here comes from Flask + the database:
 *   GET /api/auth/me              -> name / phone / age / sex
 *   GET /api/patients/<id>/cases  -> the most recent case with its real
 *                                    symptoms and follow-up answers
 *
 * Nothing falls back to the temporary onboarding draft, which is empty after a
 * refresh and is therefore not a source of truth.
 */
export interface StoredSymptom {
  id: string;
  label: string;
  severity?: number | null;
  bodyRegion?: string | null;
  notes?: string | null;
}

export interface StoredFollowUpAnswer {
  questionId: string;
  question: string;
  answer: boolean | number | null;
}

export interface PatientProfile {
  patientId: string;
  name: string;
  age: number | null;
  sex: 'M' | 'F' | null;
  phone: string;
  email?: string | null;
  caseId: string | null;
  caseStatus: string | null;
  chiefComplaint: string | null;
  submittedAt: string | null;
  symptoms: StoredSymptom[];
  followUpAnswers: StoredFollowUpAnswer[];
}

interface MeResponse {
  user: {
    id: string;
    full_name: string | null;
    age?: number | null;
    sex?: 'M' | 'F' | null;
    phone?: string | null;
    email?: string | null;
  };
}

interface CaseRow {
  id: string;
  status: string | null;
  chiefComplaint: string | null;
  createdAt: string | null;
  symptoms?: Array<{ id: string; label: string; severity?: number | null; bodyRegion?: string | null; notes?: string | null }>;
  followUpAnswers?: Array<{ questionId: string; question: string; answer: boolean | number | null }>;
}

export async function fetchMyProfile(): Promise<PatientProfile> {
  const me = await apiFetch<MeResponse>('/auth/me');
  const user = me.user;

  // The case list is the canonical place symptoms / follow-ups live.
  let latest: CaseRow | null = null;
  try {
    const cases = await apiFetch<{ data: CaseRow[] }>(`/patients/${user.id}/cases`);
    const rows = [...(cases.data ?? [])].sort((a, b) =>
      String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')),
    );
    latest = rows[0] ?? null;
  } catch {
    // A patient with no case yet is a normal state (account created, intake
    // not finished). Profile identity still renders; clinical rows stay empty.
    latest = null;
  }

  return {
    patientId: user.id,
    name: user.full_name ?? '',
    age: user.age ?? null,
    sex: user.sex ?? null,
    phone: user.phone ?? '',
    email: user.email ?? null,
    caseId: latest?.id ?? null,
    caseStatus: latest?.status ?? null,
    chiefComplaint: latest?.chiefComplaint ?? null,
    submittedAt: latest?.createdAt ?? null,
    symptoms: (latest?.symptoms ?? []).map((s) => ({
      id: s.id, label: s.label, severity: s.severity ?? null,
      bodyRegion: s.bodyRegion ?? null, notes: s.notes ?? null,
    })),
    followUpAnswers: (latest?.followUpAnswers ?? []).map((a) => ({
      questionId: a.questionId, question: a.question, answer: a.answer ?? null,
    })),
  };
}

/**
 * Upload a real file (image / PDF / text / recorded audio) owned by the case.
 *
 * The multipart POST is built by hand so it works identically on Expo Web and
 * native without pulling in an extra HTTP dependency; `FormData`/`Blob` are
 * available on both platforms.
 */
export async function uploadAttachment(
  file: { uri: string; name: string; type: string },
  caseId?: string | null,
): Promise<{ id: string; filename: string; contentType: string; sizeBytes: number; kind: string }> {
  const form = new FormData();
  // React Native's FormData accepts this {uri,name,type} shape; the browser
  // accepts it too (uri is read as the body when a Blob is not supplied).
  form.append('file', file as unknown as Blob);
  if (caseId) form.append('caseId', caseId);

  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  // Do NOT set Content-Type manually: the runtime must add the multipart
  // boundary itself.
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}/agent/attachments`, {
    method: 'POST',
    headers,
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message ?? 'Upload failed.') as Error & {
      status?: number; code?: string;
    };
    error.status = response.status;
    error.code = payload?.error;
    throw error;
  }
  return payload.data as { id: string; filename: string; contentType: string; sizeBytes: number; kind: string };
}
