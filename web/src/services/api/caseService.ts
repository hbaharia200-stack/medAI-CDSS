// Canonical cases are read from Flask; cached data is used only while offline.
import type {
  Case,
  QueueCase,
  RecommendationFeedback,
} from '../../types';
import { getConnectivity } from '../connectivity';
import { getCachedQueue, setCachedQueue } from '../cache';
import { apiFetch, ApiError } from './client';

export class NetworkError extends Error {
  constructor() {
    super('network-offline');
    this.name = 'NetworkError';
  }
}

export async function getQueue(): Promise<QueueCase[]> {
  if (getConnectivity() === 'offline') {
    const cached = getCachedQueue();
    if (cached) return cached;
    throw new NetworkError();
  }
  const response = await apiFetch<{ data: QueueCase[] }>('/cases/queue');
  setCachedQueue(response.data);
  return response.data;
}

export async function getCase(caseId: string): Promise<Case | undefined> {
  if (getConnectivity() === 'offline') {
    const cached = getCachedQueue()?.find((row) => row.case.id === caseId)?.case;
    if (cached) return cached;
    throw new NetworkError();
  }
  try {
    const response = await apiFetch<{ data: Case }>(`/cases/${encodeURIComponent(caseId)}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

/** Doctor advances the case workflow (status / urgency / assignment). */
export async function updateCase(
  caseId: string,
  patch: {
    status?: string;
    urgent?: boolean;
    doctorId?: string;
    nurseId?: string;
    claim?: boolean;
  },
): Promise<Case> {
  const response = await apiFetch<{ data: Case }>(`/cases/${encodeURIComponent(caseId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return response.data;
}

/**
 * Persists the doctor's decision to accept a suggestion as the diagnosis.
 *
 * This is a real write: the backend stores a `Diagnosis` row, closes the case
 * and writes the matching `FeedbackRecord`. Throws `ApiError` on failure so the
 * UI never shows a success that was not persisted.
 */
export async function confirmDiagnosis(
  caseId: string,
  diseaseName: string,
  options: { recommendationId?: string; recommendationIndex?: number } = {},
): Promise<{ ok: boolean }> {
  await apiFetch(`/cases/${encodeURIComponent(caseId)}/confirm-diagnosis`, {
    method: 'POST',
    body: JSON.stringify({
      diseaseName,
      recommendationId: options.recommendationId,
      recommendationIndex: options.recommendationIndex,
    }),
  });
  return { ok: true };
}

/** Records "Not this — adjust" as a durable, attributed decision. */
export async function rejectRecommendation(
  caseId: string,
  diseaseName: string,
  recommendationIndex = 0,
): Promise<{ ok: boolean }> {
  await apiFetch(`/cases/${encodeURIComponent(caseId)}/reject-recommendation`, {
    method: 'POST',
    body: JSON.stringify({ diseaseName, recommendationIndex }),
  });
  return { ok: true };
}

/** Persists the doctor's accuracy feedback (the learning-loop signal). */
export async function submitRecommendationFeedback(
  caseId: string,
  diseaseName: string,
  feedback: RecommendationFeedback,
): Promise<{ ok: boolean }> {
  await apiFetch(`/cases/${encodeURIComponent(caseId)}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ diseaseName, feedback, decision: 'confirmed' }),
  });
  return { ok: true };
}