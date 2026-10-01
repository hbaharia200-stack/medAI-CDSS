const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api').replace(/\/+$/, '');
const ACCESS_TOKEN_KEY = 'medai.web.access-token.v1';
const REFRESH_TOKEN_KEY = 'medai.web.refresh-token.v1';

export class ApiError extends Error {
  status?: number;
  code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Never log request bodies, tokens, query strings or raw backend payloads.
function safeEndpoint(path = ''): string {
  try {
    const url = new URL(`${API_BASE_URL}${path}`);
    return `${url.origin}${url.pathname}`;
  } catch {
    return '[invalid API URL]';
  }
}

/** Fixed, non-leaking description of a status code for the dev console. */
function statusMessage(status: number): string {
  if (status >= 200 && status < 300) return 'Request succeeded.';
  if (status === 401) return 'Authentication required or expired.';
  if (status === 403) return 'Permission denied.';
  if (status === 404) return 'Resource not found.';
  if (status === 409) return 'Conflicts with existing data.';
  if (status === 422) return 'Request validation failed.';
  if (status >= 500) return 'The MedAI backend is temporarily unavailable.';
  return 'Request was rejected.';
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  let res = await request(path, init, accessToken);
  if (res.status === 401 && accessToken && !path.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retry = await request(path, init, refreshed);
      if (retry.ok) return (await retry.json()) as T;
      res = retry;
    }
  }
  if (!res.ok) {
    // Surface the backend's own (already generic, non-patient) message when it
    // has one instead of a bare status line, which is what a reviewer needs to
    // tell "missing sign-in" apart from "wrong payload".
    let payload: { message?: string; error?: string } = {};
    try { payload = (await res.json()) as typeof payload; } catch { /* non-JSON response */ }
    const message = res.status >= 500
      ? 'The MedAI backend is temporarily unavailable.'
      : (typeof payload.message === 'string' && payload.message)
        || (res.status === 401 ? 'Invalid or expired sign-in.' : `Request failed (${res.status}).`);
    throw new ApiError(message, res.status, payload.error);
  }
  return (await res.json()) as T;
}

async function request(path: string, init: RequestInit | undefined, token: string | null) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const method = init?.method ?? 'GET';
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    if (import.meta.env.DEV) console.info('[MedAI API]', {
      method,
      endpoint: safeEndpoint(path),
      status: response.status,
      jwtAttached: Boolean(token),
      message: statusMessage(response.status),
    });
    return response;
  } catch {
    if (import.meta.env.DEV) console.warn('[MedAI API]', {
      method,
      endpoint: safeEndpoint(path),
      jwtAttached: Boolean(token),
      status: null,
      message: 'Unable to reach the MedAI backend.',
    });
    throw new ApiError('Unable to reach the MedAI backend.', undefined, 'network_unavailable');
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  let response: Response;
  try {
    response = await request('/auth/refresh', { method: 'POST' }, refreshToken);
  } catch {
    return null;
  }
  if (!response.ok) {
    clearAuthTokens();
    return null;
  }
  const body = (await response.json()) as { access_token: string };
  localStorage.setItem(ACCESS_TOKEN_KEY, body.access_token);
  return body.access_token;
}

export function storeAuthTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function revokeRefreshToken(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (refreshToken) await request('/auth/logout', { method: 'POST' }, refreshToken);
}

export { API_BASE_URL };