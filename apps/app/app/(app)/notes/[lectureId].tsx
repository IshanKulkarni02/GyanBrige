import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Notes {
  id: string;
  contentJson: NoteContent;
  translations: { id: string; lang: string; createdAt: string }[];
}

interface NoteContent {
  title?: string;
  summary?: string;
  sections?: { heading: string; content: string[]; keyTerms?: string[] }[];
  keyTakeaways?: string[];
}

const LANGS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'mr', label: 'मराठी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'gu', label: 'ગુજરાતી' },
];

export default function NotesScreen() {
  const { lectureId } = useLocalSearchParams<{ lectureId: string }>();
  const [notes, setNotes] = useState<Notes | null>(null);
  const [lang, setLang] = useState('en');
  const [content, setContent] = useState<NoteContent | null>(null);
  const [busy, setBusy] = useState(false);
  const c = colors.light;

  const loadNotes = async () => {
    if (!lectureId) return;
    try {
      const n = await api<Notes>(`/api/notes/lecture/${lectureId}`);
      setNotes(n);
      setContent(n.contentJson);
    } catch (e) {
      Alert.alert('Notes not ready', (e as Error).message);
    }
  };

  useEffect(() => {
    void loadNotes();
  }, [lectureId]);

  const switchLang = async (target: string) => {
    if (!notes) return;
    setLang(target);
    setBusy(true);
    try {
      if (target === 'en') {
        setContent(notes.contentJson);
      } else {
        try {
          const cached = await api<{ contentJson: NoteContent }>(
            `/api/notes/${notes.id}/translation?lang=${target}`,
          );
          setContent(cached.contentJson);
        } catch {
          const fresh = await api<{ contentJson: NoteContent }>(
            `/api/notes/${notes.id}/translate`,
            { method: 'POST', body: JSON.stringify({ lang: target }) },
          );
          setContent(fresh.contentJson);
        }
      }
    } catch (e) {
      Alert.alert('Translation failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!notes || !content) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
        {LANGS.map((l) => (
          <Pressable
            key={l.code}
            onPress={() => switchLang(l.code)}
            style={{
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
              marginRight: spacing.xs,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: lang === l.code ? c.primary : c.border,
              backgroundColor: lang === l.code ? c.primary : c.surface,
            }}
          >
            <Text
              style={{
                color: lang === l.code ? c.primaryFg : c.text,
                fontWeight: lang === l.code ? '600' : '400',
                fontSize: 13,
              }}
            >
              {l.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {busy && <ActivityIndicator style={{ marginBottom: spacing.md }} />}

      <Text style={{ fontSize: 24, fontWeight: '700', color: c.text }}>
        {content.title ?? 'Lecture Notes'}
      </Text>
      {content.summary && (
        <Text style={{ color: c.textMuted, marginTop: spacing.sm, lineHeight: 22 }}>
          {content.summary}
        </Text>
      )}
      {content.sections?.map((sec, i) => (
        <View key={i} style={{ marginTop: spacing.lg }}>
          <Text style={{ fontWeight: '600', color: c.text, fontSize: 16 }}>{sec.heading}</Text>
          {sec.content.map((b, j) => (
            <Text key={j} style={{ color: c.text, marginTop: spacing.xs, lineHeight: 22 }}>
              • {b}
            </Text>
          ))}
          {sec.keyTerms?.length ? (
            <Text style={{ color: c.textMuted, marginTop: spacing.xs, fontSize: 12 }}>
              Terms: {sec.keyTerms.join(', ')}
            </Text>
          ) : null}
        </View>
      ))}
      {content.keyTakeaways && content.keyTakeaways.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ fontWeight: '600', color: c.text, fontSize: 16 }}>Key Takeaways</Text>
          {content.keyTakeaways.map((t, i) => (
            <Text key={i} style={{ color: c.text, marginTop: spacing.xs, lineHeight: 22 }}>
              ★ {t}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
