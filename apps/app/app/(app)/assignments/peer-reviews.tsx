import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface PeerReview {
  id: string;
  status: string;
  score: number | null;
  comments: string | null;
  assignedAt: string;
  submission: {
    contentText: string | null;
    gitRepoUrl: string | null;
    assignment: {
      title: string;
      maxScore: number;
      course: { subject: { code: string; name: string } };
    };
  };
}

export default function PeerReviews() {
  const [reviews, setReviews] = useState<PeerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<PeerReview | null>(null);
  const [score, setScore] = useState('');
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const c = colors.light;

  const load = async () => {
    setReviews(await api<PeerReview[]>('/api/assignments/peer-reviews/me'));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openReview = (r: PeerReview) => {
    setActive(r);
    setScore(r.score != null ? String(r.score) : '');
    setComments(r.comments ?? '');
  };

  const submit = async () => {
    if (!active) return;
    const parsed = Number(score);
    if (isNaN(parsed) || parsed < 0 || parsed > active.submission.assignment.maxScore) {
      Alert.alert('Invalid score', `Enter a number between 0 and ${active.submission.assignment.maxScore}`);
      return;
    }
    setBusy(true);
    try {
      await api(`/api/assignments/peer-reviews/${active.id}`, {
        method: 'POST',
        body: JSON.stringify({ score: parsed, comments: comments || undefined }),
      });
      setActive(null);
      await load();
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  const pending = reviews.filter((r) => r.status !== 'SUBMITTED');
  const done = reviews.filter((r) => r.status === 'SUBMITTED');

  return (
    <>
      <FlatList
        data={[...pending, ...done]}
        keyExtractor={(r) => r.id}
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>No peer reviews assigned</Text>
            <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>Check back after your teacher allocates reviews.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const submitted = item.status === 'SUBMITTED';
          return (
            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: submitted ? c.border : c.primary,
                backgroundColor: c.surface,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '600' }}>{item.submission.assignment.title}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
                    {item.submission.assignment.course.subject.code} · assigned {new Date(item.assignedAt).toLocaleDateString()}
                  </Text>
                </View>
                {submitted ? (
                  <Text style={{ color: c.textMuted, fontSize: 12 }}>Done · {item.score}/{item.submission.assignment.maxScore}</Text>
                ) : (
                  <Pressable
                    onPress={() => openReview(item)}
                    style={{
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs,
                      borderRadius: radius.sm,
                      backgroundColor: c.primary,
                    }}
                  >
                    <Text style={{ color: c.primaryFg, fontWeight: '600', fontSize: 12 }}>Review</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />

      <Modal visible={!!active} animationType="slide" presentationStyle="pageSheet">
        {active && (
          <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>
              {active.submission.assignment.title}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
              {active.submission.assignment.course.subject.code} · max {active.submission.assignment.maxScore}
            </Text>

            <Text style={{ color: c.text, fontWeight: '600', marginTop: spacing.lg }}>Submission</Text>
            {active.submission.contentText ? (
              <View
                style={{
                  marginTop: spacing.xs,
                  padding: spacing.sm,
                  borderRadius: radius.md,
                  backgroundColor: c.surface,
                  borderWidth: 1,
                  borderColor: c.border,
                }}
              >
                <Text style={{ color: c.text }}>{active.submission.contentText}</Text>
              </View>
            ) : active.submission.gitRepoUrl ? (
              <Text style={{ color: c.primary, marginTop: spacing.xs }}>{active.submission.gitRepoUrl}</Text>
            ) : (
              <Text style={{ color: c.textMuted, marginTop: spacing.xs }}>File submission (no preview)</Text>
            )}

            <Text style={{ color: c.text, fontWeight: '600', marginTop: spacing.lg }}>
              Score (0–{active.submission.assignment.maxScore})
            </Text>
            <TextInput
              value={score}
              onChangeText={setScore}
              keyboardType="numeric"
              placeholder={`0–${active.submission.assignment.maxScore}`}
              style={{
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: radius.md,
                padding: spacing.sm,
                color: c.text,
                marginTop: spacing.xs,
              }}
            />

            <Text style={{ color: c.text, fontWeight: '600', marginTop: spacing.md }}>Comments (optional)</Text>
            <TextInput
              value={comments}
              onChangeText={setComments}
              multiline
              placeholder="Feedback for the author..."
              style={{
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: radius.md,
                padding: spacing.sm,
                color: c.text,
                minHeight: 100,
                marginTop: spacing.xs,
                textAlignVertical: 'top',
              }}
            />

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <Pressable
                onPress={() => setActive(null)}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: c.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={busy}
                style={{
                  flex: 2,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  backgroundColor: c.primary,
                  alignItems: 'center',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Submit review</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </Modal>
    </>
  );
}
