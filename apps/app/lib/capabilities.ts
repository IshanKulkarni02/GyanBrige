import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isNative = isIOS || isAndroid;

export const isTauri =
  typeof globalThis !== 'undefined' && (globalThis as { __TAURI__?: unknown }).__TAURI__ != null;

export const platformLabel = (): 'IOS' | 'ANDROID' | 'WEB' | 'DESKTOP' => {
  if (isTauri) return 'DESKTOP';
  if (isIOS) return 'IOS';
  if (isAndroid) return 'ANDROID';
  return 'WEB';
};
