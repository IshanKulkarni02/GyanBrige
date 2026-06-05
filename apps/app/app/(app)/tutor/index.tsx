import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, FlatList, ActivityIndicator,
  Modal, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Session { _id: string; title: string; courseId: string | null; updatedAt: string }
interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: { lectureId: string; startSec: number; snippet: string }[];
  ts: string;
}
interface FullSession extends Session { messages: Message[] }
interface Profile { weakTopics: string[]; attendanceRatio: number }

export default function Tutor() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [active, setActive] = useState<FullSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSessions, setShowSessions] = useState(false);
  const listRef = useRef<FlatList>(null);
  const c = colors.dark;

  const loadSessions = async () => {
    setSessions(await api<Session[]>('/api/ai-tutor/sessions'));
    setLoading(false);
  };
  useEffect(() => { void loadSessions(); }, []);

  const openSession = async (s: Session) => {
    setShowSessions(false);
    setActive(await api<FullSession>(`/api/ai-tutor/sessions/${s._id}`));
  };

  const newSession = async () => {
    try {
      const { sessionId } = await api<{ sessionId: string }>('/api/ai-tutor/sessions', { method: 'POST', body: JSON.stringify({ title: 'New session' }) });
      setActive(await api<FullSession>(`/api/ai-tutor/sessions/${sessionId}`));
      setShowSessions(false);
      void loadSessions();
    } catch (e) {
      Alert.alert('Could not create session', (e as Error).message);
    }
  };

  const send = async () => {
    if (!input.trim() || !active || sending) return;
    const question = input.trim();
    setInput('');
    setSending(true);
    setActive((p) => p ? { ...p, messages: [...p.messages, { role: 'user', content: question, ts: new Date().toISOString() }] } : p);
    try {
      const res = await api<{ answer: string; citations: Message['citations']; profile: Profile }>(
        `/api/ai-tutor/sessions/${active._id}/ask`,
        { method: 'POST', body: JSON.stringify({ question }) },
      );
      setActive((p) => p ? { ...p, messages: [...p.messages, { role: 'assistant', content: res.answer, citations: res.citations, ts: new Date().toISOString() }] } : p);
      if (res.profile) setProfile(res.profile);
      void loadSessions();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
      setActive((p) => p ? { ...p, messages: p.messages.slice(0, -1) } : p);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border, gap: spacing.sm }}>
        <Pressable onPress={() => setShowSessions(true)} style={{ padding: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.text, fontSize: 18 }}>☰</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{active?.title ?? 'AI Tutor'}</Text>
          {profile && <Text style={{ color: c.textMuted, fontSize: 11 }}>{Math.round(profile.attendanceRatio * 100)}% attendance{profile.weakTopics.length > 0 ? ` · Focus: ${profile.weakTopics.slice(0, 2).join(', ')}` : ''}</Text>}
        </View>
        <Pressable onPress={newSession} style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: c.primary }}>
          <Text style={{ color: c.primaryFg, fontSize: 12, fontWeight: '600' }}>+ New</Text>
        </Pressable>
      </View>

      {/* Weak topic quick-ask chips */}
      {profile && profile.weakTopics.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 38 }}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs, alignItems: 'center' }}>
          <Text style={{ color: c.textMuted, fontSize: 11 }}>Weak areas: </Text>
          {profile.weakTopics.map((t, i) => (
            <Pressable key={i} onPress={() => setInput(`Explain ${t} to me`)}
              style={{ paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
              <Text style={{ color: c.text, fontSize: 11 }}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Message list */}
      {!active ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <Text style={{ color: c.text, fontSize: 22, fontWeight: '700', textAlign: 'center' }}>Your personal tutor</Text>
          <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 20 }}>
            Personalized to your weak topics, attendance, and upcoming deadlines.{'\n'}Tap "+ New" to start.
          </Text>
          {sessions.length > 0 && (
            <Pressable onPress={() => setShowSessions(true)} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: c.primary }}>
              <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Resume past session</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={active.messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl }}
          onLayout={() => listRef.current?.scrollToEnd()}
          ListEmptyComponent={<Text style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.xl }}>Ask anything about your courses.</Text>}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View style={{ alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                <View style={{ maxWidth: '85%', padding: spacing.md, borderRadius: radius.lg, borderBottomRightRadius: isUser ? 4 : radius.lg, borderBottomLeftRadius: isUser ? radius.lg : 4, backgroundColor: isUser ? c.primary : c.surface, borderWidth: isUser ? 0 : 1, borderColor: c.border }}>
                  <Text style={{ color: isUser ? c.primaryFg : c.text, lineHeight: 20 }}>{item.content}</Text>
                  {!isUser && item.citations && item.citations.length > 0 && (
                    <View style={{ marginTop: spacing.xs }}>
                      {item.citations.map((cit, ci) => (
                        <Text key={ci} style={{ color: c.accent, fontSize: 11 }}>↗ Lecture · {Math.floor(cit.startSec / 60)}:{String(Math.floor(cit.startSec % 60)).padStart(2, '0')}</Text>
                      ))}
                    </View>
                  )}
                  <Text style={{ color: isUser ? c.primaryFg : c.textMuted, fontSize: 10, marginTop: 4, opacity: 0.7 }}>{new Date(item.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {sending && (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xs }}>
          <View style={{ alignSelf: 'flex-start', padding: spacing.sm, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ color: c.textMuted, fontSize: 13 }}>Tutor is thinking…</Text>
          </View>
        </View>
      )}

      {active && (
        <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.border }}>
          <TextInput
            value={input} onChangeText={setInput} placeholder="Ask your tutor anything…"
            placeholderTextColor={c.textMuted} multiline
            style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: c.text, maxHeight: 120 }}
            onSubmitEditing={send} returnKeyType="send" blurOnSubmit={false}
          />
          <Pressable onPress={send} disabled={sending || !input.trim()}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: input.trim() ? c.primary : c.surface, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' }}>
            <Text style={{ color: input.trim() ? c.primaryFg : c.textMuted, fontSize: 20, lineHeight: 24 }}>↑</Text>
          </Pressable>
        </View>
      )}

      {/* Sessions sidebar */}
      <Modal visible={showSessions} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 18 }}>Sessions</Text>
            <Pressable onPress={() => setShowSessions(false)}><Text style={{ color: c.primary }}>Close</Text></Pressable>
          </View>
          <Pressable onPress={newSession} style={{ margin: spacing.md, padding: spacing.md, backgroundColor: c.primary, borderRadius: radius.md, alignItems: 'center' }}>
            <Text style={{ color: c.primaryFg, fontWeight: '700' }}>+ New session</Text>
          </Pressable>
          <FlatList
            data={sessions} keyExtractor={(s) => s._id}
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
            ListEmptyComponent={<Text style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.lg }}>No sessions yet.</Text>}
            renderItem={({ item }) => (
              <Pressable onPress={() => openSession(item)}
                style={{ padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: active?._id === item._id ? c.primary : c.surface }}>
                <Text style={{ color: active?._id === item._id ? c.primaryFg : c.text, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: active?._id === item._id ? c.primaryFg : c.textMuted, fontSize: 11, opacity: 0.8 }}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
