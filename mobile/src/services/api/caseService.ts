// Patient submission and the nurse console both use the canonical backend cases.
import type {
  Case,
  Patient,
  PatientIntakeDraft,
  QueueCase,
  SubmittedCaseReceipt,
  Symptom,
  VitalSigns,
} from '../../types';
import { getConnectivity } from '../connectivity';
import { enqueueAction } from '../offlineQueue';
import { ApiError, apiFetch } from './client';

export async function submitIntake(
  draft: PatientIntakeDraft,
  lang: 'sw' | 'en',
  symptoms: Symptom[],
  followUpAnswers: Case['followUpAnswers'],
): Promise<SubmittedCaseReceipt> {
  const age = Number(draft.age);
  if (
    !draft.name.trim() ||
    !Number.isInteger(age) ||
    age <= 0 ||
    !draft.sex ||
    !draft.phone.trim()
  ) {
    throw new Error('details.required');
  }
  if (!symptoms.length || symptoms.every((symptom) => !symptom.label.trim())) {
    throw new Error('review.symptomsRequired');
  }
  const intakePatient: Omit<Patient, 'id'> = {
    name: draft.name.trim(),
    age,
    sex: draft.sex,
    phone: draft.phone.trim(),
    language: lang,
  };
  const online = getConnectivity() !== 'offline';

  if (online) {
    const response = await apiFetch<{ data: Case & { queueNumber?: string; estimatedWaitMinutes?: number } }>('/cases', {
      method: 'POST',
      body: JSON.stringify({
        chiefComplaint: symptoms.map((s) => s.label).join(', '),
        symptoms,
        followUpAnswers,
        history: [],
        location: draft.location,
        intake: intakePatient,
      }),
    });
    return {
      caseId: response.data.id,
      submittedCase: response.data,
      queueNumber: response.data.queueNumber ?? `Q-${response.data.id.slice(0, 8).toUpperCase()}`,
      estimatedWaitMinutes: response.data.estimatedWaitMinutes ?? 15,
      synced: true,
    };
  }

  // Keep the draft until the server confirms a real case.
  throw new ApiError('Connect to the clinic to submit your intake.', undefined, 'offline_submit');
}

export async function getVitalsQueue(): Promise<QueueCase[]> {
  const response = await apiFetch<{ data: QueueCase[] }>('/nurses/me/queue');
  return response.data;
}

/** A doctor's recommended test as the nurse detail screen shows it. */
export interface NurseTestItem {
  id: string;
  testName?: string | null;
  name?: string | null;
  status?: string | null;
  nurseId?: string | null;
  doctorId?: string | null;
  patientId?: string | null;
  caseId?: string | null;
  createdAt?: string | null;
  acknowledgedAt?: string | null;
  completedAt?: string | null;
}

/**
 * The real Nurse "Patient details" payload for one case.
 *
 * Served by `GET /api/nurses/me/queue/<caseId>`, which composes the case, the
 * patient record and the doctor's test assignments server-side. Every field
 * below is optional on purpose: the backend omits what it does not hold, and
 * the screen renders "not recorded" rather than inventing a value.
 */
export interface NursePatientDetail {
  caseId: string;
  caseReference?: string | null;
  patient?: {
    id?: string | null;
    name?: string | null;
    age?: number | null;
    sex?: string | null;
    phone?: string | null;
    language?: string | null;
  } | null;
  chiefComplaint?: string | null;
  symptoms?: Array<{
    id?: string;
    label?: string | null;
    severity?: number | null;
    durationDays?: number | null;
    bodyRegion?: string | null;
    notes?: string | null;
  }>;
  followUpAnswers?: Array<{ questionId?: string; question?: string; answer?: boolean | number | null }>;
  history?: string[];
  status?: string | null;
  urgent?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  vitals?: Record<string, number | string | null> | null;
  assignedDoctor?: string | null;
  assignedNurse?: string | null;
  doctorId?: string | null;
  nurseId?: string | null;
  diagnoses?: Array<{ id?: string; diseaseName?: string | null; notes?: string | null; recordedAt?: string | null }>;
  tests?: NurseTestItem[];
  location?: { latitude?: number; longitude?: number; capturedAt?: string } | null;
}

/** Real patient details for a queue case (read on the Nurse details screen). */
export async function getNursePatientDetail(caseId: string): Promise<NursePatientDetail> {
  const response = await apiFetch<{ data: NursePatientDetail }>(
    `/nurses/me/queue/${encodeURIComponent(caseId)}`,
  );
  return response.data;
}

/**
 * Records a vitals reading against the real case.
 *
 * Persisted by `POST /api/cases/<id>/vitals`; the backend validates the values
 * against hard clinical bounds and moves the case to `awaiting_review`. Offline
 * the reading is queued for replay rather than written to a local fake record.
 */
export async function submitVitals(
  caseId: string,
  vitals: VitalSigns,
  urgentFlag: boolean,
): Promise<{ synced: boolean }> {
  if (getConnectivity() === 'offline') {
    await enqueueAction('submit_vitals', { caseId, vitals, urgentFlag });
    return { synced: false };
  }
  await apiFetch(`/cases/${encodeURIComponent(caseId)}/vitals`, {
    method: 'POST',
    body: JSON.stringify({ ...vitals, urgent: urgentFlag }),
  });
  return { synced: true };
}

/**
 * Nurse hands a case back to the doctor.
 *
 * This is a real `PATCH /api/cases/<id>`: the status transition and the nurse
 * assignment are stored, so the doctor sees the handoff after a refresh.
 */
export async function sendToDoctor(caseId: string): Promise<{ synced: boolean }> {
  if (getConnectivity() === 'offline') {
    await enqueueAction('send_to_doctor', { caseId });
    return { synced: false };
  }
  await apiFetch(`/cases/${encodeURIComponent(caseId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'doctor_reviewing', claimNurse: true }),
  });
  return { synced: true };
}

/** Replays a queued write against the backend once connectivity returns. */
export async function replayAction(action: {
  type: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  switch (action.type) {
    case 'submit_vitals':
      await submitVitals(
        action.payload.caseId as string,
        action.payload.vitals as VitalSigns,
        (action.payload.urgentFlag as boolean) ?? false,
      );
      return;
    case 'send_to_doctor':
      await sendToDoctor(action.payload.caseId as string);
      return;
    default:
      // 'submit_intake' is never queued: an intake is only accepted once the
      // server has issued a real case id, so there is nothing to replay.
      return;
  }
}