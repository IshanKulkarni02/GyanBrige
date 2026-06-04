import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Room {
  _id: string;
  kind: 'dm' | 'group' | 'class' | 'club';
  title: string | null;
  memberIds: string[];
  lastMessageAt: string;
}

export default function ChatRooms() {
  const [rows, setRows] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  useEffect(() => {
    api<Room[]>('/api/chat/rooms')
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (rows.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <Text style={{ color: c.textMuted, textAlign: 'center' }}>
          No rooms yet. Class rooms are auto-created when teachers post.
        </Text>
      </View>
    );
  }
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r._id}
      style={{ backgroundColor: c.bg }}
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
      renderItem={({ item }) => (
        <Link href={`/(app)/chat/${item._id}`} asChild>
          <Pressable style={{ padding: spacing.md, backgroundColor: c.surface }}>
            <Text style={{ color: c.text, fontWeight: '600' }}>
              {item.title ?? `${item.kind.toUpperCase()} · ${item.memberIds.length} members`}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
              {new Date(item.lastMessageAt).toLocaleString()}
            </Text>
          </Pressable>
        </Link>
      )}
    />
  );
}
