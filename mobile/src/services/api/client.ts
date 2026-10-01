import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
  TokenStorageError,
} from '../auth/tokenStorage';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || 'http://localhost:4000/api').replace(/\/+$/, '');

export class ApiError extends Error {
  status?: number;
  code?: string;
  userMessage: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.userMessage = message;
  }
}

// Never log request bodies, tokens, query strings, or backend error payloads.
function safeUrl(path = ''): string {
  try {
    const url = new URL(`${API_BASE_URL}${path}`);
    return `${url.origin}${url.pathname}`;
  } catch { return '[invalid API URL]'; }
}

if (__DEV__) console.info('[MedAI API] base URL:', safeUrl());

async function request(path: string, init: RequestInit | undefined, token: string | null) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const method = init?.method ?? 'GET';
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    // Fixed messages only: backend validation text can contain patient input.
    if (__DEV__) console.info('[MedAI API]', {
      method, endpoint: safeUrl(path), status: response.status, jwtAttached: Boolean(token),
      message: response.ok ? 'Request succeeded.'
        : response.status === 401 ? 'Authentication required or expired.'
        : response.status === 403 ? 'Permission denied.'
        : response.status === 422 ? 'Request validation or token validation failed.'
        : response.status >= 500 ? 'The MedAI backend is temporarily unavailable.'
        : 'Request was rejected.',
    });
    return response;
  } catch {
    if (__DEV__) console.warn('[MedAI API]', {
      method, endpoint: safeUrl(path), jwtAttached: Boolean(token), status: null, message: 'Unable to reach the MedAI backend.',
    });
    throw new ApiError('Unable to reach the MedAI backend.', undefined, 'network_unavailable');
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;
  let response: Response;
  try {
    response = await request('/auth/refresh', { method: 'POST' }, refreshToken);
  } catch {
    throw new ApiError('Unable to reach the MedAI backend.', undefined, 'network_unavailable');
  }
  if (!response.ok) {
    await clearAuthTokens();
    return null;
  }
  const body = (await response.json()) as { access_token: string };
  await setTokens(body.access_token, refreshToken);
  return body.access_token;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let accessToken: string | null;
  try {
    accessToken = await getAccessToken();
  } catch (error) {
    if (error instanceof TokenStorageError) {
      throw new ApiError(error.message, undefined, 'auth_storage_unavailable');
    }
    throw error;
  }
  let response: Response;
  try {
    response = await request(path, init, accessToken);
  } catch {
    throw new ApiError('Unable to reach the MedAI backend.', undefined, 'network_unavailable');
  }
  if (response.status === 401 && accessToken && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      let retry: Response;
      try {
        retry = await request(path, init, refreshed);
      } catch {
        throw new ApiError('Unable to reach the MedAI backend.', undefined, 'network_unavailable');
      }
      if (retry.ok) return (await retry.json()) as T;
      response = retry;
    }
  }
  if (!response.ok) {
    let payload: { message?: string; error?: string } = {};
    try { payload = (await response.json()) as typeof payload; } catch { /* non-JSON response */ }
    const message = response.status >= 500
      ? 'The MedAI backend is temporarily unavailable.'
      : (typeof payload.message === 'string' && payload.message)
        || (response.status === 401 ? 'Invalid or expired sign-in.' : `Request failed (${response.status}).`);
    throw new ApiError(message, response.status, payload.error);
  }
  return (await response.json()) as T;
}

export async function storeAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  try {
    await setTokens(accessToken, refreshToken);
  } catch (error) {
    if (error instanceof TokenStorageError) {
      throw new ApiError(error.message, undefined, 'auth_storage_unavailable');
    }
    throw error;
  }
}

export async function clearAuthTokens(): Promise<void> {
  try {
    await clearTokens();
  } catch (error) {
    if (error instanceof TokenStorageError) {
      throw new ApiError(error.message, undefined, 'auth_storage_unavailable');
    }
    throw error;
  }
}

export async function revokeRefreshToken(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) await request('/auth/logout', { method: 'POST' }, refreshToken);
}

export { API_BASE_URL };
