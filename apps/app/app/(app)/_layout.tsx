import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../lib/auth-store';
import { useColors } from '../../lib/theme';

export default function AppLayout() {
  const me = useAuth((s) => s.me);
  const c = useColors();
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
