import { View, Text, Pressable, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../lib/auth-store';
import { colors, spacing, radius } from '../../lib/theme';

export default function Dashboard() {
  const { me, logout } = useAuth();
  const c = colors.light;
  const roles = me?.roles.map((r) => r.role) ?? [];
  const isAdmin = roles.includes('ADMIN') || roles.includes('STAFF');

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: c.text }}>
        Welcome, {me?.name ?? 'student'}
      </Text>
      <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>{roles.join(', ') || 'no roles'}</Text>

      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <Tile href="/(app)/courses" label="My courses" c={c} />
        {isAdmin && <Tile href="/(app)/admin/users" label="Admin · Users" c={c} />}
        {isAdmin && <Tile href="/(app)/admin/invites" label="Admin · Invite links" c={c} />}
        {isAdmin && <Tile href="/(app)/admin/audit" label="Admin · Audit log" c={c} />}
      </View>

      <Pressable
        onPress={logout}
        style={{
          marginTop: spacing.xl,
          padding: spacing.md,
          alignItems: 'center',
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius.md,
        }}
      >
        <Text style={{ color: c.text }}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

function Tile({ href, label, c }: { href: string; label: string; c: typeof colors.light }) {
  return (
    <Link href={href as never} asChild>
      <Pressable
        style={{
          padding: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.surface,
        }}
      >
        <Text style={{ color: c.text, fontWeight: '600' }}>{label}</Text>
      </Pressable>
    </Link>
  );
}
