// Auth domain types shared by the auth service and the app store.
// These map 1:1 onto the `/api/auth/*` contract returned by Flask. Keeping them
// in a dedicated module lets both the auth service and the Zustand store share
// them without a circular import.

export interface AuthUser {
  id: string;
  name: string;
  role: 'patient' | 'nurse';
  phone: string;
  email?: string;
  staffId?: string;
  age?: number;
  sex?: 'M' | 'F';
  language: 'sw' | 'en';
}

/** Active role used to mount the correct screen set (patient vs nurse). */
export type AuthRole = 'patient' | 'nurse';

/** Store role — null until the user picks a role or authenticates. */
export type Role = AuthRole | null;