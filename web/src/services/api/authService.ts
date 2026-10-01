import type { AuthService, DoctorUser } from '../../types/auth';
import { apiFetch, ApiError, clearAuthTokens, revokeRefreshToken, storeAuthTokens } from './client';

interface BackendUser {
  id: string;
  full_name: string;
  role: 'doctor' | 'nurse' | 'admin';
  staff_id?: string;
  email?: string;
  phone?: string;
  specialization?: string;
  picture?: string;
}

/** Roles that may hold a Web session. The backend stays authoritative. */
const STAFF_ROLES: ReadonlyArray<BackendUser['role']> = ['doctor', 'nurse', 'admin'];

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: BackendUser;
}

function mapUser(user: BackendUser): DoctorUser {
  return {
    id: user.id,
    staffId: user.staff_id ?? '',
    fullName: user.full_name,
    specialization: user.specialization ?? '',
    phone: user.phone,
    email: user.email,
    picture: user.picture,
    role: user.role,
  };
}

const authService: AuthService = {
  async signIn(staffId: string, password?: string): Promise<DoctorUser | null> {
    const identifier = staffId.trim();
    // 1) Clinic staff sign in passwordlessly with their Staff ID. We try the
    //    clinical staff roles in turn (doctor, then nurse) because a Staff ID
    //    encodes the role — DR001 belongs to a doctor, NR001 to a nurse.
    //    This does NOT weaken authentication: the backend verifies that the
    //    account's real role matches the requested role and rejects anything
    //    else, so a doctor token can never be issued for a nurse account.
    let lastError: unknown = null;
    for (const role of ['doctor', 'nurse'] as const) {
      try {
        const response = await apiFetch<AuthResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ role, staffId: identifier, identifier }),
        });
        if (!STAFF_ROLES.includes(response.user.role)) return null;
        storeAuthTokens(response.access_token, response.refresh_token);
        return mapUser(response.user);
      } catch (error) {
        lastError = error;
        // Only a credential/role mismatch is worth retrying with the next
        // role. A network failure or 5xx must surface immediately.
        const isCredentialError =
          error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404);
        if (!isCredentialError) throw error;
      }
    }

    // 2) Admins authenticate with identifier + password. Only attempted when a
    //    password was actually supplied, so a wrong Staff ID still reports the
    //    correct "invalid staff id" error instead of a misleading one.
    if (!password) throw lastError;
    const isCredentialError =
      lastError instanceof ApiError &&
      (lastError.status === 401 || lastError.status === 403 || lastError.status === 404);
    if (!isCredentialError) throw lastError;

    const adminResponse = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'admin', identifier, password }),
    });
    if (adminResponse.user.role !== 'admin') return null;
    storeAuthTokens(adminResponse.access_token, adminResponse.refresh_token);
    return mapUser(adminResponse.user);
  },

  async signUp(data): Promise<DoctorUser> {
    const response = await apiFetch<{ user: BackendUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        role: 'doctor',
        fullName: data.fullName,
        staffId: data.staffId,
        specialization: data.specialization,
        phone: data.phone,
        email: data.email,
      }),
    });
    const session = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role: 'doctor', staffId: data.staffId, identifier: data.staffId }),
    });
    storeAuthTokens(session.access_token, session.refresh_token);
    return mapUser(response.user);
  },

  async signOut(): Promise<void> {
    try {
      await revokeRefreshToken();
    } catch {
      // Local credentials must still be removed if the backend is unavailable.
    }
    clearAuthTokens();
  },

  async getCurrentUser(): Promise<DoctorUser | null> {
    try {
      const response = await apiFetch<{ user: BackendUser }>('/auth/me');
      if (!STAFF_ROLES.includes(response.user.role)) return null;
      return mapUser(response.user);
    } catch {
      clearAuthTokens();
      return null;
    }
  },
};

export default authService;