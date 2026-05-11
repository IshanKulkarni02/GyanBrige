import { Stack, Redirect } from 'expo-router';
import { useAuth } from '../../lib/auth-store';

export default function AppLayout() {
  const me = useAuth((s) => s.me);
  if (!me) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: true }} />;
}
