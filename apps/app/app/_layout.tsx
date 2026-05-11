import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../lib/auth-store';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const hydrate = useAuth((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}
