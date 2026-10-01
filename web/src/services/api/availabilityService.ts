// Doctor availability (Settings -> Available | Not Available).
//
// The status is PERSISTED on the backend (DoctorProfile), not local UI state,
// so it survives a refresh and a logout/login. Reads go through /api/auth/me
// (which already carries the value) with an explicit endpoint for writes.

import { apiFetch } from './client';

export type DoctorAvailability = 'available' | 'not_available';

export interface AvailabilityStatus {
  availability: DoctorAvailability;
  isAvailable: boolean;
}

export async function getAvailability(): Promise<AvailabilityStatus> {
  const response = await apiFetch<{ data: AvailabilityStatus }>('/auth/me/availability');
  return response.data;
}

export async function setAvailability(
  availability: DoctorAvailability,
): Promise<AvailabilityStatus> {
  const response = await apiFetch<{ data: AvailabilityStatus }>('/auth/me/availability', {
    method: 'PATCH',
    body: JSON.stringify({ availability }),
  });
  return response.data;
}

export const availabilityService = { getAvailability, setAvailability };
export default availabilityService;