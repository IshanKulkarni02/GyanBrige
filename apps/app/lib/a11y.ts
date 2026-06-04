// Accessibility prefs: font scale, dyslexia mode, high contrast, reduced motion.
// Persisted in localStorage/AsyncStorage; applied as a theme overlay.

import { create } from 'zustand';
import { Platform } from 'react-native';
import { colors } from './theme';

export interface A11yState {
  fontScale: number;
  dyslexia: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  setFontScale: (n: number) => void;
  toggleDyslexia: () => void;
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  hydrate: () => Promise<void>;
}

const KEY = 'gb_a11y_prefs';

const persist = async (state: Omit<A11yState, 'hydrate' | 'setFontScale' | 'toggleDyslexia' | 'toggleHighContrast' | 'toggleReducedMotion'>) => {
  const json = JSON.stringify(state);
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, json);
    return;
  }
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(KEY, json);
};

export const useA11y = create<A11yState>((set, get) => ({
  fontScale: 1,
  dyslexia: false,
  highContrast: false,
  reducedMotion: false,
  hydrate: async () => {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    } else {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      raw = await AsyncStorage.getItem(KEY);
    }
    if (raw) set(JSON.parse(raw) as Partial<A11yState>);
  },
  setFontScale: (n) => {
    set({ fontScale: Math.max(0.8, Math.min(2, n)) });
    void persist(get());
  },
  toggleDyslexia: () => {
    set({ dyslexia: !get().dyslexia });
    void persist(get());
  },
  toggleHighContrast: () => {
    set({ highContrast: !get().highContrast });
    void persist(get());
  },
  toggleReducedMotion: () => {
    set({ reducedMotion: !get().reducedMotion });
    void persist(get());
  },
}));

export function themedColors(highContrast: boolean) {
  if (!highContrast) return colors.light;
  return {
    ...colors.light,
    text: '#000000',
    textMuted: '#222222',
    border: '#000000',
    bg: '#ffffff',
    surface: '#f0f0f0',
    primary: '#0033cc',
  };
}

export function dyslexiaFontFamily(active: boolean): string | undefined {
  return active ? 'OpenDyslexic, Comic Sans MS, sans-serif' : undefined;
}
