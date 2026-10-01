import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthUser } from '../../types/auth';
import type { AppLanguage } from '../../i18n';
import { getAccessToken } from '../auth/tokenStorage';
import { ApiError, apiFetch, clearAuthTokens, revokeRefreshToken, storeAuthTokens } from './client';

const AUTH_CACHE_KEY = '@medai_auth_user_v1';

interface BackendUser {
  id: string;
  full_name: string;
  role: 'patient' | 'nurse';
  phone?: string;
  email?: string;
  staff_id?: string;
  age?: number;
  sex?: 'M' | 'F';
  language?: 'sw' | 'en';
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: BackendUser;
}

function mapUser(user: BackendUser): AuthUser {
  return {
    id: user.id,
    name: user.full_name,
    role: user.role,
    phone: user.phone ?? '',
    email: user.email,
    staffId: user.staff_id,
    age: user.age,
    sex: user.sex,
    language: user.language ?? 'en',
  };
}

export async function saveSession(user: AuthUser): Promise<void> {
  await AsyncStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
}

export async function restoreSession(): Promise<AuthUser | null> {
  // A cached profile is not a session: Expo Web tokens live in sessionStorage.
  if (!await getAccessToken()) {
    await clearSession();
    return null;
  }
  try {
    const response = await apiFetch<{ user: BackendUser }>('/auth/me');
    const user = mapUser(response.user);
    await saveSession(user);
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'network_unavailable') {
      const raw = await AsyncStorage.getItem(AUTH_CACHE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    }
    await clearAuthTokens();
    await clearSession();
    return null;
  }
}

async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_CACHE_KEY);
}

export async function register(
  data: Omit<AuthUser, 'id' | 'language'> & { password?: string },
  language: AppLanguage,
): Promise<AuthUser> {
  const response = await apiFetch<{ user: BackendUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      role: data.role,
      name: data.name,
      fullName: data.name,
      phone: data.phone,
      email: data.email,
      staffId: data.staffId,
      age: data.age,
      sex: data.sex,
      password: data.password,
      language,
    }),
  });
  const loginResponse = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      role: data.role,
      identifier: data.role === 'nurse' ? data.staffId : data.phone,
      staffId: data.role === 'nurse' ? data.staffId : undefined,
      password: data.role === 'patient' ? data.password : undefined,
    }),
  });
  await storeAuthTokens(loginResponse.access_token, loginResponse.refresh_token);
  const user = mapUser(loginResponse.user);
  await saveSession(user);
  return user;
}

export async function login(identifier: string, secret: string, role: AuthUser['role']): Promise<AuthUser | null> {
  const response = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      role,
      identifier: identifier.trim(),
      staffId: role === 'nurse' ? identifier.trim() : undefined,
      password: role === 'patient' ? secret : undefined,
    }),
  });
  await storeAuthTokens(response.access_token, response.refresh_token);
  const user = mapUser(response.user);
  await saveSession(user);
  return user;
}

export async function logout(): Promise<void> {
  try {
    await revokeRefreshToken();
  } catch {
    // Local token removal is still required when the network is unavailable.
  }
  await clearAuthTokens();
  await clearSession();
}
