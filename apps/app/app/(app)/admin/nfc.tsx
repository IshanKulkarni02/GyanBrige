import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Tag {
  id: string;
  publicId: string;
  rotatedAt: string;
  classroom: { id: string; name: string; building: string | null };
  createdBy?: { name: string } | null;
}

interface Classroom {
  id: string;
  name: string;
  building: string | null;
}

export default function AdminNfc() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const c = colors.light;

  const load = async () => {
    setLoading(true);
    try {
      const [t, cr] = await Promise.all([
        api<Tag[]>('/api/nfc/tags'),
        api<Classroom[]>('/api/classrooms'),
      ]);
      setTags(t);
      setClassrooms(cr);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const create = async (classroomId: string) => {
    const r = await api<{ tag: Tag; payloadToWrite: string }>('/api/nfc/tags', {
      method: 'POST',
      body: JSON.stringify({ classroomId }),
    });
    Alert.alert(
      'Tag created',
      `Write to physical tag:\n${r.payloadToWrite.slice(0, 80)}...\n\npublicId: ${r.tag.publicId}`,
    );
    await load();
  };

  const rotate = async (id: string) => {
    const r = await api<{ payloadToWrite: string }>(`/api/nfc/tags/${id}/rotate`, {
      method: 'POST',
    });
    Alert.alert('Rotated', `New payload:\n${r.payloadToWrite.slice(0, 80)}...`);
    await load();
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <View style={{ flex: 1, padding: spacing.md, backgroundColor: c.bg }}>
      <Text style={{ color: c.text, fontWeight: '600', marginBottom: spacing.sm }}>
        Issue tag for classroom
      </Text>
      <FlatList
        data={classrooms}
        horizontal
        keyExtractor={(r) => r.id}
        showsHorizontalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ width: spacing.xs }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => create(item.id)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
            }}
          >
            <Text style={{ color: c.text }}>+ {item.name}</Text>
          </Pressable>
        )}
      />
      <Text style={{ color: c.text, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.sm }}>
        Existing tags
      </Text>
      <FlatList
        data={tags}
        keyExtractor={(t) => t.id}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.border }} />}
        renderItem={({ item }) => (
          <View style={{ padding: spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text }}>{item.classroom.name}</Text>
              <Text style={{ color: c.textMuted, fontSize: 12 }}>
                {item.publicId} · rotated {new Date(item.rotatedAt).toLocaleDateString()}
              </Text>
            </View>
            <Pressable
              onPress={() => rotate(item.id)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderWidth: 1,
                borderColor: c.danger,
                borderRadius: radius.sm,
              }}
            >
              <Text style={{ color: c.danger }}>Rotate</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
