import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../lib/auth-store';
import { useColors, radius, spacing, typography } from '../../lib/theme';
import { Button, Tag } from '../../components/ui';

export default function Login() {
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('admin@gyanbrige.local');
  const [password, setPassword] = useState('admin1234');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const c = useColors();

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
    <View style={{ flex: 1, backgroundColor: c.bg, padding: spacing.lg, justifyContent: 'center' }}>
      <View style={{ maxWidth: 460, width: '100%', alignSelf: 'center', gap: spacing.lg }}>
        <Tag label="GyanBrige · Sign in" tone="accent" />
        <Text style={{ ...typography.display, color: c.text }}>Welcome back.</Text>
        <Text style={{ ...typography.body, color: c.textMuted }}>Your campus, your tools, one feed.</Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Text style={{ color: c.textMuted, ...typography.micro }}>Email</Text>
          <TextInput
            placeholder="you@college.edu"
            placeholderTextColor={c.textSubtle}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={{
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
              borderRadius: radius.md,
              padding: spacing.md,
              color: c.text,
              fontSize: 15,
            }}
          />
          <Text style={{ color: c.textMuted, ...typography.micro, marginTop: spacing.sm }}>Password</Text>
          <TextInput
            placeholder="••••••••"
            placeholderTextColor={c.textSubtle}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={{
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
              borderRadius: radius.md,
              padding: spacing.md,
              color: c.text,
              fontSize: 15,
            }}
          />
        </View>

        {err && <Text style={{ color: c.danger }}>{err}</Text>}
        <Button label="Sign in" onPress={submit} busy={busy} full size="lg" />
        <Link
          href="/(auth)/signup"
          style={{ color: c.textMuted, textAlign: 'center', fontSize: 14, marginTop: spacing.sm }}
        >
          Create account →
        </Link>
        <Link
          href="/(app)/guide"
          style={{ color: c.accent, textAlign: 'center', fontSize: 13, marginTop: spacing.sm }}
        >
          How does GyanBrige work?
        </Link>
      </View>
    </View>
  );
}
