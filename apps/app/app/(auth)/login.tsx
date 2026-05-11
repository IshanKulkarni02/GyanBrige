import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../lib/auth-store';
import { colors, spacing, radius } from '../../lib/theme';

export default function Login() {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const c = colors.light;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await login(email.trim(), password);
      router.replace('/(app)/dashboard');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center', backgroundColor: c.bg }}>
      <Text style={{ fontSize: 28, fontWeight: '700', color: c.text, marginBottom: spacing.lg }}>
        GyanBrige
      </Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
          color: c.text,
        }}
      />
      <TextInput
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.md,
          color: c.text,
        }}
      />
      {err && <Text style={{ color: c.danger, marginBottom: spacing.sm }}>{err}</Text>}
      <Pressable
        onPress={submit}
        disabled={busy}
        style={{
          backgroundColor: c.primary,
          padding: spacing.md,
          borderRadius: radius.md,
          alignItems: 'center',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color={c.primaryFg} />
        ) : (
          <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Sign in</Text>
        )}
      </Pressable>
      <Link href="/(auth)/signup" style={{ marginTop: spacing.md, color: c.primary, textAlign: 'center' }}>
        Create account
      </Link>
    </View>
  );
}
