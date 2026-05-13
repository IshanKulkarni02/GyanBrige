import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../lib/auth-store';
import { useColors, radius, spacing, typography } from '../../lib/theme';
import { Button, Tag } from '../../components/ui';

export default function Signup() {
  const params = useLocalSearchParams<{ invite?: string }>();
  const signup = useAuth((s) => s.signup);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const c = useColors();

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await signup(email.trim(), name.trim(), password, params.invite);
      router.replace('/(app)/dashboard');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fields: { label: string; val: string; set: (v: string) => void; secret: boolean; cap: 'none' | 'words' }[] = [
    { label: 'Name', val: name, set: setName, secret: false, cap: 'words' },
    { label: 'Email', val: email, set: setEmail, secret: false, cap: 'none' },
    { label: 'Password (min 8)', val: password, set: setPassword, secret: true, cap: 'none' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: spacing.lg, justifyContent: 'center' }}>
      <View style={{ maxWidth: 460, width: '100%', alignSelf: 'center', gap: spacing.lg }}>
        <Tag label={params.invite ? 'Joining via invite' : 'Create account'} tone="accent" />
        <Text style={{ ...typography.display, color: c.text }}>Start learning.</Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {fields.map((f) => (
            <View key={f.label}>
              <Text style={{ color: c.textMuted, ...typography.micro }}>{f.label}</Text>
              <TextInput
                placeholderTextColor={c.textSubtle}
                autoCapitalize={f.cap}
                keyboardType={f.label === 'Email' ? 'email-address' : 'default'}
                secureTextEntry={f.secret}
                value={f.val}
                onChangeText={f.set}
                style={{
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: c.surface,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  color: c.text,
                  fontSize: 15,
                  marginTop: 4,
                }}
              />
            </View>
          ))}
        </View>

        {err && <Text style={{ color: c.danger }}>{err}</Text>}
        <Button label="Create account" onPress={submit} busy={busy} full size="lg" />
        <Link
          href="/(auth)/login"
          style={{ color: c.textMuted, textAlign: 'center', fontSize: 14, marginTop: spacing.sm }}
        >
          Have an account? Sign in
        </Link>
      </View>
    </View>
  );
}
