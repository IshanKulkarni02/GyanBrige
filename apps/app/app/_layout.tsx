import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../lib/auth-store';
import { useTheme } from '../lib/theme-store';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const hydrate = useAuth((s) => s.hydrate);
  const hydrateTheme = useTheme((s) => s.hydrate);
  const resolved = useTheme((s) => s.resolved);
  useEffect(() => {
    void hydrate();
    void hydrateTheme();
  }, [hydrate, hydrateTheme]);
  return (
    <>
      <StatusBar style={resolved === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}
