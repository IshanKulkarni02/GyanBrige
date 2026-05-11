import { View, Text, ScrollView, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../lib/auth-store';
import { useColors, spacing, typography } from '../../lib/theme';
import { useTheme } from '../../lib/theme-store';
import { Hero, Card, Tag } from '../../components/ui';

interface Tile {
  href: string;
  title: string;
  desc: string;
  tag: string;
  tone?: 'default' | 'accent';
}

export default function Dashboard() {
  const { me, logout } = useAuth();
  const roles = me?.roles.map((r) => r.role) ?? [];
  const isAdmin = roles.includes('ADMIN') || roles.includes('STAFF');
  const isTeacher = roles.includes('TEACHER');
  const c = useColors();
  const { mode, setMode, resolved } = useTheme();

  const studentTiles: Tile[] = [
    { href: '/(app)/courses', title: 'My courses', desc: 'Lectures, notes, attendance', tag: 'Learn', tone: 'accent' },
    { href: '/(app)/lectures', title: 'Lectures', desc: 'Watch live + recorded', tag: 'Live' },
    { href: '/(app)/tutor', title: 'AI Tutor', desc: 'Ask anything, get cited answers', tag: 'AI' },
    { href: '/(app)/study-plan', title: 'Study plan', desc: 'This week, tailored to you', tag: 'Plan' },
    { href: '/(app)/flashcards', title: 'Flashcards', desc: 'Daily review (SM-2)', tag: 'Practice' },
    { href: '/(app)/assignments', title: 'Assignments', desc: 'Submit and track', tag: 'Tasks' },
    { href: '/(app)/results', title: 'Results', desc: 'Grades + GPA', tag: 'Records' },
    { href: '/(app)/attendance', title: 'Attendance', desc: 'Tap in, view history', tag: 'Daily' },
    { href: '/(app)/notices', title: 'Notice board', desc: 'College + course updates', tag: 'News' },
    { href: '/(app)/chat', title: 'Messages', desc: 'DMs, groups, class', tag: 'Talk' },
    { href: '/(app)/clubs', title: 'Clubs', desc: 'Join + RSVP events', tag: 'Community' },
    { href: '/(app)/clubs/events', title: 'Club events', desc: 'Upcoming events', tag: 'Events' },
    { href: '/(app)/applications', title: 'Applications', desc: 'Add/drop, leave, bonafide', tag: 'Forms' },
    { href: '/(app)/feedback', title: 'Feedback', desc: 'Anonymous or named', tag: 'Voice' },
    { href: '/(app)/mentors', title: 'Mentors', desc: 'Find guidance', tag: 'Connect' },
    { href: '/(app)/gamification', title: 'Streaks & badges', desc: 'See your points', tag: 'Play' },
    { href: '/(app)/search', title: 'Smart search', desc: 'Across everything', tag: 'Find' },
    { href: '/(app)/integrations', title: 'Integrations', desc: 'Calendar sync, more', tag: 'Connect' },
    { href: '/(app)/settings/appearance', title: 'Appearance', desc: 'Light / dark / system', tag: 'Settings' },
    { href: '/(app)/settings/a11y', title: 'Accessibility', desc: 'Font, contrast, dyslexia mode', tag: 'Settings' },
    { href: '/(app)/guide', title: 'How to use', desc: 'In-app guide', tag: 'Help' },
  ];

  const adminTiles: Tile[] = [
    { href: '/(app)/admin/users', title: 'Users', desc: 'People + roles', tag: 'Admin' },
    { href: '/(app)/admin/invites', title: 'Invite links', desc: 'Bulk onboard', tag: 'Admin' },
    { href: '/(app)/admin/caps', title: 'Online caps', desc: 'Per-subject + global', tag: 'Admin' },
    { href: '/(app)/admin/nfc', title: 'NFC tags', desc: 'Issue + rotate', tag: 'Admin' },
    { href: '/(app)/admin/ai-settings', title: 'AI backend', desc: 'OpenAI ↔ Ollama', tag: 'Admin' },
    { href: '/(app)/admin/analytics', title: 'Course analytics', desc: 'Engagement & attendance', tag: 'Insights' },
    { href: '/(app)/admin/accreditation', title: 'Outcome export', desc: 'NAAC/NBA CSV', tag: 'Reports' },
    { href: '/(app)/admin/dropout-risk', title: 'Dropout risk', desc: 'At-risk students', tag: 'Insights' },
    { href: '/(app)/admin/audit', title: 'Audit log', desc: 'Mutation trail', tag: 'Security' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Hero
        eyebrow={`Hello, ${roles[0] ?? 'STUDENT'}`}
        title={`Welcome\n${me?.name ?? ''}.`}
        subtitle="Your campus runs here. Live lectures, AI notes, attendance, tests, community — one feed."
        right={
          <View style={{ gap: spacing.sm }}>
            <Tag label={roles.join(' · ') || 'STUDENT'} tone="accent" />
            <Pressable
              onPress={() =>
                setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light')
              }
            >
              <Tag label={`Theme · ${mode} (${resolved})`} />
            </Pressable>
            <Pressable onPress={() => logout()}>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>Sign out</Text>
            </Pressable>
          </View>
        }
      />

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...typography.h2, color: c.text }}>For you</Text>
          <Link href="/(app)/guide" asChild>
            <Pressable>
              <Text style={{ color: c.accent, fontSize: 13, fontWeight: '600' }}>How to use →</Text>
            </Pressable>
          </Link>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {studentTiles.map((t) => (
            <View key={t.href} style={{ width: '48%', minWidth: 260, flexGrow: 1 }}>
              <Card title={t.title} description={t.desc} tag={t.tag} href={t.href} tone={t.tone} />
            </View>
          ))}
        </View>

        {(isAdmin || isTeacher) && (
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <Text style={{ ...typography.h2, color: c.text }}>Workspace</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {adminTiles.map((t) => (
                <View key={t.href} style={{ width: '48%', minWidth: 260, flexGrow: 1 }}>
                  <Card title={t.title} description={t.desc} tag={t.tag} href={t.href} />
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
