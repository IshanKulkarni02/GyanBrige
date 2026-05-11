// In-app How to use guide. Plain prose + sectioned, scrollable, links to deep
// screens so users can jump straight into a feature after reading about it.

import { ScrollView, View, Text } from 'react-native';
import { Link } from 'expo-router';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { Hero, Tag, Surface } from '../../components/ui';

interface Section {
  tag: string;
  title: string;
  body: string;
  steps?: string[];
  href?: string;
}

const sections: Section[] = [
  {
    tag: 'Start here',
    title: 'Your first 60 seconds',
    body: 'Sign in with the credentials your admin shared, or paste the invite link they DM\'d you. The dashboard is the launchpad — every feature lives one tap away.',
    steps: [
      'Open the dashboard tile that matches what you came for.',
      'Each tile has a short caption — if it sounds right, you\'re in the right place.',
      'Hit "How to use" any time. You\'re reading it now.',
    ],
  },
  {
    tag: 'Lectures',
    title: 'Joining a live class',
    body: 'When your teacher goes live, the lecture card turns red with a LIVE badge. Tap it, then "Open stage". Camera + mic are off by default. The teacher can record — the recording shows up in the same lecture after it ends, with AI notes already attached.',
    href: '/(app)/lectures',
  },
  {
    tag: 'Attendance',
    title: 'Marking yourself present',
    body: 'Four ways: tap the classroom NFC tag, scan the QR on the screen, self-report your Wi-Fi (campus only), or let the teacher mark you. Online attendance counts against your weekly cap — see the cap in admin settings.',
    steps: [
      'In a classroom: open Attendance → Scan → tap your phone to the wall NFC.',
      'No NFC? Scan the QR on the teacher\'s screen — it refreshes every 30s.',
      'Online: just join the live room. You\'re marked automatically (until your cap).',
    ],
    href: '/(app)/attendance',
  },
  {
    tag: 'Notes',
    title: 'AI notes in your language',
    body: 'Every recorded lecture gets structured notes — title, summary, key takeaways. Tap a language chip (English, Hindi, Marathi, +) to translate. The result is cached, so flipping back is instant.',
    href: '/(app)/courses',
  },
  {
    tag: 'AI Tutor',
    title: 'Ask the corpus',
    body: 'Stuck? Ask in plain English. The tutor searches every lecture you\'re enrolled in and answers with [n] citations linking to the exact second in the recording. Click a citation, jump straight to that moment.',
    href: '/(app)/tutor',
  },
  {
    tag: 'Flashcards',
    title: 'Daily SR review',
    body: 'Cards auto-generate from lecture notes. Open Flashcards once a day, grade your recall 0-5, the algorithm reschedules them. Misses bubble into your study plan.',
    href: '/(app)/flashcards',
  },
  {
    tag: 'Assignments',
    title: 'Submit code, text, or Git repo',
    body: 'Tap the assignment, type or paste your answer, optionally drop a Git URL. Plagiarism check runs in the background — text via MinHash, code via Winnowing fingerprints. You\'ll see the similarity score on your submission.',
    href: '/(app)/assignments',
  },
  {
    tag: 'Tests',
    title: 'Online tests with proctoring',
    body: 'Tests are timed. Tab-blur and copy/paste are always tracked. If the teacher enabled strict mode you\'ll also need webcam. Don\'t panic over minor flags — the teacher reviews the full timeline before any decision.',
  },
  {
    tag: 'Notices & Feedback',
    title: 'Stay in the loop',
    body: 'Notices appear by scope — college-wide, department, course, club. Pinned ones float to the top. Tap Acknowledge so the sender knows you read it. Feedback forms are often anonymous; the form will tell you up front.',
    href: '/(app)/notices',
  },
  {
    tag: 'Community',
    title: 'Chat, clubs, mentors',
    body: 'Class chat is auto-created when a teacher first posts. DM anyone in your courses. Clubs have events with NFC/QR check-in. Mentor matching pairs you with seniors or faculty based on shared courses.',
  },
  {
    tag: 'Doubts board',
    title: 'Ask the room (and the AI)',
    body: 'Post a question on the doubts board. The AI drafts a first answer cited to lecture timestamps. Peers and teachers can upvote, correct, or mark final. Final answers become canonical.',
  },
  {
    tag: 'Applications',
    title: 'Forms with workflows',
    body: 'Course add/drop, leave, bonafide, custom — every form has an approver chain. Submit, watch the status bar move through each step.',
    href: '/(app)/applications',
  },
  {
    tag: 'Streaks',
    title: 'Show up to level up',
    body: 'Daily logins build streaks. Attending lectures, submitting on time, scoring perfect quizzes — all unlock badges. Leaderboard is opt-in per course.',
    href: '/(app)/gamification',
  },
  {
    tag: 'Search',
    title: 'One box across everything',
    body: 'The search bar pulls from lecture transcripts (embedding hits), assignments, and chat — only inside courses you\'re part of.',
    href: '/(app)/search',
  },
  {
    tag: 'Accessibility',
    title: 'Make it yours',
    body: 'Font scaling 80–200%, high contrast, dyslexia-friendly font, reduced motion. Settings persist per device.',
    href: '/(app)/settings/a11y',
  },
  {
    tag: 'For teachers',
    title: 'Run a class',
    body: 'Create a course → add students via invite link → schedule lectures. Tap "Go live" to start a stream. Recordings get H.264-transcoded and AI-noted automatically. Grade tests inline; AI suggests grades for long-form answers but you publish.',
  },
  {
    tag: 'For admins',
    title: 'Operate the college',
    body: 'Issue invite links with quotas. Configure online-attendance caps (per-subject + global, stricter wins). Manage NFC tags. Pick the AI backend — Ollama for full data sovereignty, OpenAI for speed. Watch dropout-risk dashboard nightly.',
  },
];

export default function Guide() {
  const c = colors.dark;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Hero
        eyebrow="Documentation"
        title={`How GyanBrige\nworks.`}
        subtitle="A 4-minute tour. Skim by tag or read top-to-bottom."
      />

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        {sections.map((s, i) => (
          <Surface key={i} tone={i === 0 ? 'alt' : 'default'}>
            <Tag label={s.tag} tone={i === 0 ? 'accent' : 'default'} />
            <Text style={{ ...typography.h2, color: c.text, marginTop: spacing.sm }}>{s.title}</Text>
            <Text style={{ ...typography.body, color: c.textMuted, marginTop: spacing.sm }}>{s.body}</Text>
            {s.steps && (
              <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                {s.steps.map((step, j) => (
                  <View key={j} style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Text style={{ color: c.primary, fontWeight: '700' }}>{j + 1}.</Text>
                    <Text style={{ color: c.text, flex: 1 }}>{step}</Text>
                  </View>
                ))}
              </View>
            )}
            {s.href && (
              <Link href={s.href as never} style={{ color: c.primary, marginTop: spacing.md, fontSize: 13, fontWeight: '600' }}>
                Open →
              </Link>
            )}
          </Surface>
        ))}

        <Surface tone="alt">
          <Tag label="Need more?" tone="accent" />
          <Text style={{ ...typography.h3, color: c.text, marginTop: spacing.sm }}>
            Ask in your class chat, or message a teacher directly.
          </Text>
          <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>
            Admins can also reach support at the email under Admin → Settings.
          </Text>
        </Surface>
      </View>
    </ScrollView>
  );
}
