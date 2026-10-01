import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = '@medai_access_token_v1';
const REFRESH_TOKEN_KEY = '@medai_refresh_token_v1';

export class TokenStorageError extends Error {
  constructor(message = 'Authentication storage is unavailable.') {
    super(message);
    this.name = 'TokenStorageError';
  }
}

function browserStorage(): Storage {
  if (typeof sessionStorage === 'undefined') {
    throw new TokenStorageError();
  }
  return sessionStorage;
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return Platform.OS === 'web'
      ? browserStorage().getItem(ACCESS_TOKEN_KEY)
      : await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  } catch {
    throw new TokenStorageError();
  }
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return Platform.OS === 'web'
      ? browserStorage().getItem(REFRESH_TOKEN_KEY)
      : await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    throw new TokenStorageError();
  }
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const storage = browserStorage();
      storage.setItem(ACCESS_TOKEN_KEY, accessToken);
      storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      return;
    }
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  } catch {
    throw new TokenStorageError();
  }
}

export async function clearTokens(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const storage = browserStorage();
      storage.removeItem(ACCESS_TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    throw new TokenStorageError();
  }
}
