// Theme store: light | dark | system. Persists; subscribes to OS changes.

import { create } from 'zustand';
import { Platform, Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface State {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (m: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

const KEY = 'gb_theme_mode';

const persist = async (mode: ThemeMode) => {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, mode);
    return;
  }
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(KEY, mode);
};

const resolve = (mode: ThemeMode): 'light' | 'dark' =>
  mode === 'system' ? (Appearance.getColorScheme() ?? 'dark') : mode;

export const useTheme = create<State>((set, get) => ({
  mode: 'dark',
  resolved: 'dark',
  hydrate: async () => {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      raw = await AsyncStorage.getItem(KEY);
    }
    const mode = (raw as ThemeMode) ?? 'dark';
    set({ mode, resolved: resolve(mode) });
    Appearance.addChangeListener(() => {
      if (get().mode === 'system') set({ resolved: resolve('system') });
    });
  },
  setMode: (mode) => {
    set({ mode, resolved: resolve(mode) });
    void persist(mode);
  },
}));
