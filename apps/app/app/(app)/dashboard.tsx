import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-store';
import { useColors, spacing, typography } from '../../lib/theme';
import { useTheme } from '../../lib/theme-store';
import { Hero, Card, Tag } from '../../components/ui';

interface Tile { href: string; title: string; desc: string; tag: string; tone?: 'default' | 'accent' }
interface Analytics {
  attendanceRatio: number;
  loginStreak: number;
  totalPoints: number;
  pendingAssignments: number;
  weakTopics: string[];
  nextClass: { subjectCode: string; startTime: string; weekday: number } | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Dashboard() {
  const { me, logout } = useAuth();
  const roles = me?.roles.map((r) => r.role) ?? [];
  const isAdmin = roles.includes('ADMIN') || roles.includes('STAFF');
  const isTeacher = roles.includes('TEACHER');
  const isStudent = roles.includes('STUDENT') || (!isAdmin && !isTeacher);
  const c = useColors();
  const { mode, setMode, resolved } = useTheme();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    if (!isStudent) return;
    // Fetch gamification + timetable in parallel for the analytics strip
    Promise.all([
      api<{ stats: { loginStreak: number; totalPoints: number; attendance: number }; badges: { code: string }[] }>('/api/gamification/me').catch(() => null),
      api<{ items: { day: number; durationMin: number; task: string; why: string }[]; generatedFor: string }[]>('/api/study-plan/me').catch(() => null),
      api<{ weekday: number; startTime: string; course: { subject: { code: string } } }[]>('/api/timetable?mine=true').catch(() => null),
      api<{ id: string; title: string; dueAt: string }[]>('/api/assignments/course/all').catch(() => [] as { id: string; title: string; dueAt: string }[]),
    ]).then(([gami, _plan, timetable, _assignments]) => {
      const today = new Date().getDay();
      const todaySlots = (timetable ?? []).filter((s) => s.weekday === today);
      const now = new Date();
      const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const nextClass = todaySlots.find((s) => s.startTime >= nowStr) ?? null;

      setAnalytics({
        attendanceRatio: (gami?.stats.attendance ?? 0) / 100,
        loginStreak: gami?.stats.loginStreak ?? 0,
        totalPoints: gami?.stats.totalPoints ?? 0,
        pendingAssignments: 0,
        weakTopics: [],
        nextClass: nextClass ? { subjectCode: nextClass.course.subject.code, startTime: nextClass.startTime, weekday: nextClass.weekday } : null,
      });
    });
  }, [isStudent]);

  const studentTiles: Tile[] = [
    { href: '/(app)/courses', title: 'My courses', desc: 'Lectures, notes, attendance', tag: 'Learn', tone: 'accent' },
    { href: '/(app)/lectures', title: 'Lectures', desc: 'Watch live + recorded', tag: 'Live' },
    { href: '/(app)/timetable', title: 'Timetable', desc: 'Your weekly schedule', tag: 'Schedule' },
    { href: '/(app)/tutor', title: 'AI Tutor', desc: 'Personal tutor — knows your weak spots', tag: 'AI', tone: 'accent' },
    { href: '/(app)/study-plan', title: 'Study plan', desc: 'This week, tailored to you', tag: 'Plan' },
    { href: '/(app)/flashcards', title: 'Flashcards', desc: 'Daily review (SM-2)', tag: 'Practice' },
    { href: '/(app)/assignments', title: 'Assignments', desc: 'Submit and track', tag: 'Tasks' },
    { href: '/(app)/assignments/peer-reviews', title: 'Peer reviews', desc: 'Review classmates\' work', tag: 'Tasks' },
    { href: '/(app)/tests/index', title: 'Tests & exams', desc: 'Take exams', tag: 'Exams' },
    { href: '/(app)/results', title: 'Results', desc: 'Grades + GPA', tag: 'Records' },
    { href: '/(app)/attendance', title: 'Attendance', desc: 'Tap in, view history', tag: 'Daily' },
    { href: '/(app)/notices', title: 'Notice board', desc: 'College + course updates', tag: 'News' },
    { href: '/(app)/chat', title: 'Messages', desc: 'DMs, groups, class chat', tag: 'Talk' },
    { href: '/(app)/doubts', title: 'Doubt board', desc: 'Ask questions, get AI answers', tag: 'Help' },
    { href: '/(app)/clubs', title: 'Clubs', desc: 'Join + RSVP events', tag: 'Community' },
    { href: '/(app)/applications', title: 'Applications', desc: 'Add/drop, leave, bonafide', tag: 'Forms' },
    { href: '/(app)/feedback', title: 'Feedback', desc: 'Anonymous or named', tag: 'Voice' },
    { href: '/(app)/mentors', title: 'Mentors', desc: 'Find senior guidance', tag: 'Connect' },
    { href: '/(app)/gamification', title: 'Points & badges', desc: 'Streaks, leaderboard', tag: 'Play' },
    { href: '/(app)/search', title: 'Smart search', desc: 'Across lectures, notes, chat', tag: 'Find' },
    { href: '/(app)/integrations', title: 'Integrations', desc: 'Google Calendar sync', tag: 'Tools' },
    { href: '/(app)/settings/appearance', title: 'Appearance', desc: 'Light / dark / system', tag: 'Settings' },
    { href: '/(app)/settings/a11y', title: 'Accessibility', desc: 'Font, contrast, dyslexia mode', tag: 'Settings' },
    { href: '/(app)/guide', title: 'How to use', desc: 'In-app guide', tag: 'Help' },
  ];

  const teacherTiles: Tile[] = [
    { href: '/(app)/lectures', title: 'Lectures', desc: 'Create + go live', tag: 'Teach', tone: 'accent' },
    { href: '/(app)/courses', title: 'My courses', desc: 'Manage enrolments', tag: 'Teach' },
    { href: '/(app)/assignments', title: 'Assignments', desc: 'Set + grade work', tag: 'Teach' },
    { href: '/(app)/tests/index', title: 'Tests', desc: 'Create + proctor exams', tag: 'Teach' },
    { href: '/(app)/attendance', title: 'Attendance', desc: 'Mark + review', tag: 'Teach' },
    { href: '/(app)/whiteboard', title: 'Whiteboard', desc: 'Live collaborative drawing', tag: 'Live' },
  ];

  const adminTiles: Tile[] = [
    { href: '/(app)/admin/users', title: 'Users', desc: 'People + roles', tag: 'Admin' },
    { href: '/(app)/admin/batches', title: 'Batches', desc: 'Year/programme cohorts', tag: 'Admin' },
    { href: '/(app)/admin/invites', title: 'Invite links', desc: 'Bulk onboard', tag: 'Admin' },
    { href: '/(app)/admin/applications', title: 'Applications inbox', desc: 'Approve/reject requests', tag: 'Admin' },
    { href: '/(app)/admin/caps', title: 'Online caps', desc: 'Per-subject + global', tag: 'Admin' },
    { href: '/(app)/admin/nfc', title: 'NFC tags', desc: 'Issue + rotate', tag: 'Admin' },
    { href: '/(app)/admin/ai-settings', title: 'AI backend', desc: 'OpenAI ↔ Ollama', tag: 'Admin' },
    { href: '/(app)/admin/analytics', title: 'Course analytics', desc: 'Engagement & attendance', tag: 'Insights' },
    { href: '/(app)/admin/accreditation', title: 'Outcome export', desc: 'NAAC/NBA CSV', tag: 'Reports' },
    { href: '/(app)/admin/dropout-risk', title: 'Dropout risk', desc: 'At-risk students dashboard', tag: 'Insights' },
    { href: '/(app)/admin/audit', title: 'Audit log', desc: 'Mutation trail', tag: 'Security' },
  ];

  const attPct = analytics ? Math.round(analytics.attendanceRatio * 100) : null;
  const attColor = attPct === null ? c.textMuted : attPct >= 75 ? c.success : attPct >= 60 ? '#f59e0b' : c.danger;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Hero
        eyebrow={`Hello, ${me?.name?.split(' ')[0] ?? roles[0] ?? 'there'}`}
        title={`Welcome back.`}
        subtitle="Your campus, all in one place."
        right={
          <View style={{ gap: spacing.sm }}>
            <Tag label={roles.join(' · ') || 'STUDENT'} tone="accent" />
            <Pressable onPress={() => setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light')}>
              <Tag label={`Theme · ${mode}`} />
            </Pressable>
            <Pressable onPress={() => logout()}>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>Sign out</Text>
            </Pressable>
          </View>
        }
      />

      {/* Analytics strip for students */}
      {isStudent && (
        <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
          {/* Attendance ring */}
          <View style={{ flex: 1, padding: spacing.md, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}>
            <Text style={{ color: attColor, fontSize: 26, fontWeight: '800' }}>{attPct !== null ? `${attPct}%` : '—'}</Text>
            <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>Attendance</Text>
            {attPct !== null && attPct < 75 && (
              <Text style={{ color: c.danger, fontSize: 10, marginTop: 2, textAlign: 'center' }}>Below 75% minimum</Text>
            )}
          </View>
          {/* Streak */}
          <View style={{ flex: 1, padding: spacing.md, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}>
            <Text style={{ color: c.primary, fontSize: 26, fontWeight: '800' }}>{analytics?.loginStreak ?? '—'}</Text>
            <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>Day streak</Text>
          </View>
          {/* Points */}
          <View style={{ flex: 1, padding: spacing.md, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center' }}>
            <Text style={{ color: c.accent, fontSize: 26, fontWeight: '800' }}>{analytics?.totalPoints ?? '—'}</Text>
            <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>Points</Text>
          </View>
        </View>
      )}

      {/* Next class banner */}
      {isStudent && analytics?.nextClass && (
        <Link href="/(app)/timetable" asChild>
          <Pressable style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, borderRadius: 12, backgroundColor: c.primary, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ color: c.primaryFg, fontSize: 11, opacity: 0.8 }}>NEXT CLASS TODAY</Text>
              <Text style={{ color: c.primaryFg, fontWeight: '700', fontSize: 16 }}>{analytics.nextClass.subjectCode}</Text>
            </View>
            <Text style={{ color: c.primaryFg, fontWeight: '600' }}>{analytics.nextClass.startTime} →</Text>
          </Pressable>
        </Link>
      )}

      {/* Quick-ask tutor bar for students */}
      {isStudent && (
        <Link href="/(app)/tutor" asChild>
          <Pressable style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ color: c.textMuted, flex: 1, fontSize: 14 }}>Ask your AI tutor anything…</Text>
            <View style={{ backgroundColor: c.primary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ color: c.primaryFg, fontSize: 12, fontWeight: '600' }}>Ask →</Text>
            </View>
          </Pressable>
        </Link>
      )}

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ ...typography.h2, color: c.text }}>
            {isAdmin ? 'Workspace' : isTeacher ? 'Dashboard' : 'For you'}
          </Text>
          <Link href="/(app)/guide" asChild>
            <Pressable><Text style={{ color: c.accent, fontSize: 13, fontWeight: '600' }}>Guide →</Text></Pressable>
          </Link>
        </View>

        {isStudent && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {studentTiles.map((t) => (
              <View key={t.href} style={{ width: '48%', minWidth: 260, flexGrow: 1 }}>
                <Card title={t.title} description={t.desc} tag={t.tag} href={t.href} tone={t.tone} />
              </View>
            ))}
          </View>
        )}

        {isTeacher && !isAdmin && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {teacherTiles.map((t) => (
              <View key={t.href} style={{ width: '48%', minWidth: 260, flexGrow: 1 }}>
                <Card title={t.title} description={t.desc} tag={t.tag} href={t.href} tone={t.tone} />
              </View>
            ))}
          </View>
        )}

        {isAdmin && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {[...teacherTiles, ...adminTiles].map((t) => (
              <View key={t.href} style={{ width: '48%', minWidth: 260, flexGrow: 1 }}>
                <Card title={t.title} description={t.desc} tag={t.tag} href={t.href} tone={t.tone} />
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
