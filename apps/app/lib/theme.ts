import { useColorScheme } from 'react-native';

export const colors = {
  light: {
    bg: '#ffffff',
    surface: '#f6f7f9',
    border: '#e4e6ea',
    text: '#0b1220',
    textMuted: '#5b6473',
    primary: '#2563eb',
    primaryFg: '#ffffff',
    accent: '#2563eb',
    accentFg: '#ffffff',
    danger: '#dc2626',
    success: '#16a34a',
  },
  dark: {
    bg: '#0b1220',
    surface: '#121a2b',
    border: '#1f2a44',
    text: '#e6ecf6',
    textMuted: '#8a93a6',
    primary: '#60a5fa',
    primaryFg: '#0b1220',
    accent: '#60a5fa',
    accentFg: '#0b1220',
    danger: '#f87171',
    success: '#4ade80',
  },
};

export function useColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? colors.dark : colors.light;
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 6, md: 12, lg: 16 };

export const typography = {
  display: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  h2:      { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  h3:      { fontSize: 17, fontWeight: '600' as const, lineHeight: 22 },
  body:    { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  micro:   { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
};
