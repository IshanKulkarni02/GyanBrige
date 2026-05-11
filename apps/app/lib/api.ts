import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const extras = (Constants.expoConfig?.extra ?? {}) as {
  apiUrl: string;
  realtimeUrl: string;
  transcriptionUrl: string;
  livekitUrl: string;
};

export const apiUrl = extras.apiUrl;
export const realtimeUrl = extras.realtimeUrl;
export const transcriptionUrl = extras.transcriptionUrl;
export const livekitUrl = extras.livekitUrl;

const TOKEN_KEY = 'gb_token';

const webStore = {
  get: async () => (typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null),
  set: async (v: string) => typeof localStorage !== 'undefined' && localStorage.setItem(TOKEN_KEY, v),
  del: async () => typeof localStorage !== 'undefined' && localStorage.removeItem(TOKEN_KEY),
};

export const tokenStore =
  Platform.OS === 'web'
    ? webStore
    : {
        get: () => SecureStore.getItemAsync(TOKEN_KEY),
        set: (v: string) => SecureStore.setItemAsync(TOKEN_KEY, v),
        del: () => SecureStore.deleteItemAsync(TOKEN_KEY),
      };

export async function api<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const token = init.auth !== false ? await tokenStore.get() : null;
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${apiUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
