// Chat room. REST for history, Socket.IO for realtime.
// Persistence is server-side (Mongo); the app holds last 100 in memory.

import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api, realtimeUrl, tokenStore } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-store';
import { colors, spacing, radius } from '../../../lib/theme';

interface Msg {
  _id: string;
  roomId: string;
  senderId: string;
  kind: string;
  body: string | null;
  createdAt: string;
  readBy: { userId: string; at: string }[];
}

export default function ChatRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useAuth((s) => s.me);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<{ emit: (e: string, p: unknown) => void; disconnect: () => void } | null>(null);
  const c = colors.light;

  useEffect(() => {
    if (!id) return;
    api<Msg[]>(`/api/chat/rooms/${id}/messages?limit=100`)
      .then((rows) => setMsgs([...rows].reverse()))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    (async () => {
      const { io } = await import('socket.io-client');
      const token = await tokenStore.get();
      const socket = io(realtimeUrl, { auth: { token }, transports: ['websocket'] });
      socket.on('connect', () => socket.emit('chat:join', id));
      socket.on('chat:new', (m: Msg) => {
        if (m.roomId !== id) return;
        if (mounted) setMsgs((cur) => [...cur, m]);
      });
      socketRef.current = socket as never;
    })();
    return () => {
      mounted = false;
      socketRef.current?.disconnect();
    };
  }, [id]);

  const send = () => {
    if (!draft.trim()) return;
    socketRef.current?.emit('chat:send', { roomId: id, kind: 'text', body: draft });
    setDraft('');
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={msgs}
        keyExtractor={(m) => m._id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.xs }}
        renderItem={({ item }) => {
          const mine = item.senderId === me?.id;
          return (
            <View
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                padding: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: mine ? c.primary : c.surface,
              }}
            >
              <Text style={{ color: mine ? c.primaryFg : c.text }}>{item.body}</Text>
              <Text
                style={{
                  color: mine ? c.primaryFg : c.textMuted,
                  fontSize: 10,
                  marginTop: spacing.xs,
                  opacity: 0.7,
                }}
              >
                {new Date(item.createdAt).toLocaleTimeString()}
                {mine && item.readBy.length > 1 ? ' · seen' : ''}
              </Text>
            </View>
          );
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
          padding: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: c.border,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
          placeholder="Type a message..."
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: c.border,
            borderRadius: radius.md,
            padding: spacing.sm,
            color: c.text,
          }}
        />
        <Pressable
          onPress={send}
          style={{
            paddingHorizontal: spacing.md,
            justifyContent: 'center',
            backgroundColor: c.primary,
            borderRadius: radius.md,
          }}
        >
          <Text style={{ color: c.primaryFg, fontWeight: '600' }}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
