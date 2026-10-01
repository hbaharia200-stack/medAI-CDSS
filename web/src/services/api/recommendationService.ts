import type { AIRecommendation, RecommendedTestAssignment } from '../../types';
import { apiFetch } from './client';

interface ApiResponse<T> {
  data: T;
}

function mapAssignment(raw: RecommendedTestAssignment & { doctorName?: string }): RecommendedTestAssignment {
  return {
    ...raw,
    doctorName: raw.doctorName ?? raw.doctorId,
    tests: raw.tests.map((test) => ({ ...test, type: test.type ?? 'lab' })),
  };
}

export async function getAssignments(): Promise<RecommendedTestAssignment[]> {
  const response = await apiFetch<ApiResponse<RecommendedTestAssignment[]>>('/recommendations/assignments');
  return response.data.map(mapAssignment);
}

export async function getAssignmentsForCase(caseId: string): Promise<RecommendedTestAssignment[]> {
  const response = await apiFetch<ApiResponse<RecommendedTestAssignment[]>>(
    `/recommendations/assignments?case_id=${encodeURIComponent(caseId)}`,
  );
  return response.data.map(mapAssignment);
}

/** Creates the doctor-approved assignment through Flask, never local storage. */
export async function postRecommendationData(data: {
  caseId: string;
  tests: AIRecommendation['recommendedTests'];
  nurseId?: string;
  recommendationId?: string;
}): Promise<RecommendedTestAssignment> {
  const response = await apiFetch<ApiResponse<RecommendedTestAssignment>>(
    `/cases/${encodeURIComponent(data.caseId)}/recommended-tests`,
    {
      method: 'POST',
      body: JSON.stringify({
        tests: data.tests.map((test) => ({ ...test, type: test.type ?? 'lab' })),
        nurseId: data.nurseId,
        recommendationId: data.recommendationId,
      }),
    },
  );
  return mapAssignment(response.data);
}

export async function updateAssignmentStatus(
  id: string,
  status: RecommendedTestAssignment['status'],
): Promise<RecommendedTestAssignment> {
  const response = await apiFetch<ApiResponse<RecommendedTestAssignment>>(
    `/recommendations/assignments/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify({ status }) },
  );
  return mapAssignment(response.data);
}

export async function countPendingAssignments(): Promise<number> {
  const assignments = await getAssignments();
  return assignments.filter((assignment) => assignment.status === 'pending' || assignment.status === 'sent').length;
}

// Notifications are not yet backed by a dedicated Flask endpoint. Keep the
// layout contract available without reviving assignment localStorage.
export function getNotificationCounts(): Record<string, number> {
  return {};
}

export function clearNotifications(): void {
  // No local notification state remains after assignment migration.
}

/** Facility catalogue is independent of model recommendations. */
export async function getTestCatalogue(): Promise<AIRecommendation['recommendedTests']> {
  const response = await apiFetch<ApiResponse<AIRecommendation['recommendedTests']>>('/recommendations/tests');
  return response.data;
}
