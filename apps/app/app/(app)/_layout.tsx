import { useEffect } from 'react';
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../lib/auth-store';
import { useColors } from '../../lib/theme';
import { setSessionExpiredHandler } from '../../lib/api';

export default function AppLayout() {
  const me = useAuth((s) => s.me);
  const logout = useAuth((s) => s.logout);
  const c = useColors();

  // When any API call receives a 401, clear session and redirect to login
  useEffect(() => {
    setSessionExpiredHandler(() => { void logout(); });
    return () => setSessionExpiredHandler(() => {}); // cleanup on unmount
  }, [logout]);

  if (!me) return <Redirect href="/(auth)/login" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleStyle: { color: c.text, fontWeight: '700' },
        contentStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
      }}
    />
  );
}
