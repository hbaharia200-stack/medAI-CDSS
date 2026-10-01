import { create } from 'zustand';
import type { DoctorUser } from '../types/auth';
import { ApiError } from '../services/api/client';
import authService from '../services/api/authService';

/**
 * Maps a real failure onto a *translated* message key.
 *
 * The keys exist in both en.json and sw.json, so the UI never renders a raw
 * `auth.something` identifier to a clinician. Each branch corresponds to a
 * distinct, actionable condition:
 *
 *  - 401/403        -> the Staff ID is not valid for this clinic.
 *  - 422            -> the request itself was malformed (a bug, not the user).
 *  - 404            -> this backend build has no staff-login route.
 *  - network        -> the Flask backend could not be reached at all.
 *  - 5xx            -> the backend is up but failing.
 */
function signInErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'auth.loginFailed';
  if (error.code === 'network_unavailable' || error.status === undefined) {
    return 'auth.serviceUnavailable';
  }
  if (error.status === 401 || error.status === 403) return 'auth.loginFailed';
  if (error.status === 404) return 'auth.endpointMissing';
  if (error.status === 422) return 'auth.requestRejected';
  if (error.status >= 500) return 'auth.backendError';
  return 'auth.loginFailed';
}

export interface AuthStore {
  user: DoctorUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  signInError: string | null;
  signIn: (staffId: string, password?: string) => Promise<boolean>;
  signUp: (data: {
    staffId: string;
    fullName: string;
    specialization: string;
    phone?: string;
    email?: string;
    picture?: string;
  }) => Promise<boolean>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  signInError: null,

  signIn: async (staffId, password) => {
    set({ signInError: null });
    try {
      const user = await authService.signIn(staffId, password);
      if (user) {
        set({ user, isAuthenticated: true, loading: false, signInError: null });
        return true;
      }
      // A successful login for a non-staff account is still a failed staff sign-in.
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        signInError: 'auth.notStaff',
      });
      return false;
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        signInError: signInErrorKey(error),
      });
      return false;
    }
  },

  signUp: async (data) => {
    set({ signInError: null });
    try {
      const user = await authService.signUp(data);
      set({ user, isAuthenticated: true, loading: false, signInError: null });
      return true;
    } catch (error) {
      set({
        user: null,
        isAuthenticated: false,
        loading: false,
        signInError: signInErrorKey(error),
      });
      return false;
    }
  },

  signOut: async () => {
    await authService.signOut();
    set({ user: null, isAuthenticated: false, loading: false, signInError: null });
  },

  restoreSession: async () => {
    const user = await authService.getCurrentUser();
    set({ user, isAuthenticated: !!user, loading: false });
  },
}));

export { authService };
