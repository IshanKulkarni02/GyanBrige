import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Modal, ScrollView, TextInput, Alert } from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Application {
  id: string;
  kind: string;
  status: string;
  createdAt: string;
  form: { name: string };
}

interface FormField {
  id: string;
  type: 'text' | 'long' | 'number' | 'date' | 'select' | 'file';
  label: string;
  options?: string[];
  required: boolean;
}

interface AppForm {
  id: string;
  kind: string;
  name: string;
  schema: { fields: FormField[] };
}

const STATUS_COLOR: Record<string, string> = {
  APPROVED: '#22c55e',
  REJECTED: '#ef4444',
  IN_REVIEW: '#f59e0b',
};

export default function MyApplications() {
  const [rows, setRows] = useState<Application[]>([]);
  const [forms, setForms] = useState<AppForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForms, setShowForms] = useState(false);
  const [selectedForm, setSelectedForm] = useState<AppForm | null>(null);
  const [payload, setPayload] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const c = colors.light;

  const load = async () => {
    const [apps, fms] = await Promise.all([
      api<Application[]>('/api/applications/mine'),
      api<AppForm[]>('/api/applications/forms'),
    ]);
    setRows(apps);
    setForms(fms);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const openForm = (form: AppForm) => {
    const defaults: Record<string, string> = {};
    form.schema.fields.forEach((f) => { defaults[f.id] = ''; });
    setPayload(defaults);
    setSelectedForm(form);
    setShowForms(false);
  };

  const submit = async () => {
    if (!selectedForm) return;
    const missing = selectedForm.schema.fields.filter((f) => f.required && !payload[f.id]?.trim());
    if (missing.length > 0) {
      Alert.alert('Required fields', missing.map((f) => f.label).join(', '));
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ formId: selectedForm.id, payload }),
      });
      Alert.alert('Submitted', 'Your application has been submitted for review.');
      setSelectedForm(null);
      await load();
    } catch (e) {
      Alert.alert('Failed', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(a) => a.id}
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        ListHeaderComponent={
          <Pressable
            onPress={() => setShowForms(true)}
            style={{
              padding: spacing.md,
              borderRadius: radius.md,
              backgroundColor: c.primary,
              alignItems: 'center',
              marginBottom: spacing.sm,
            }}
          >
            <Text style={{ color: c.primaryFg, fontWeight: '700' }}>+ New Application</Text>
          </Pressable>
        }
        ListEmptyComponent={
          <Text style={{ color: c.textMuted, textAlign: 'center', marginTop: spacing.lg }}>
            No applications yet. Tap above to submit one.
          </Text>
        }
        renderItem={({ item }) => (
          <View
            style={{
              padding: spacing.md,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: radius.md,
              backgroundColor: c.surface,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '600' }}>{item.form.name}</Text>
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: spacing.xs }}>
              {item.kind} · {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            <Text style={{ color: STATUS_COLOR[item.status] ?? c.textMuted, fontWeight: '600', marginTop: spacing.xs }}>
              {item.status.replace('_', ' ')}
            </Text>
          </View>
        )}
      />

      {/* Form picker modal */}
      <Modal visible={showForms} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 18 }}>Choose form</Text>
            <Pressable onPress={() => setShowForms(false)}>
              <Text style={{ color: c.primary }}>Close</Text>
            </Pressable>
          </View>
          <FlatList
            data={forms}
            keyExtractor={(f) => f.id}
            contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
            ListEmptyComponent={<Text style={{ color: c.textMuted, textAlign: 'center' }}>No forms available.</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => openForm(item)}
                style={{
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: c.border,
                  backgroundColor: c.surface,
                }}
              >
                <Text style={{ color: c.text, fontWeight: '600' }}>{item.name}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>{item.kind}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      {/* Application fill-in modal */}
      <Modal visible={!!selectedForm} animationType="slide" presentationStyle="pageSheet">
        {selectedForm && (
          <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 20 }}>{selectedForm.name}</Text>
              <Pressable onPress={() => setSelectedForm(null)}>
                <Text style={{ color: c.primary }}>Cancel</Text>
              </Pressable>
            </View>

            {selectedForm.schema.fields.map((field) => (
              <View key={field.id} style={{ marginBottom: spacing.md }}>
                <Text style={{ color: c.text, fontWeight: '600', marginBottom: spacing.xs }}>
                  {field.label}{field.required ? ' *' : ''}
                </Text>
                {field.type === 'select' && field.options ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                    {field.options.map((opt) => (
                      <Pressable
                        key={opt}
                        onPress={() => setPayload((p) => ({ ...p, [field.id]: opt }))}
                        style={{
                          paddingHorizontal: spacing.sm,
                          paddingVertical: spacing.xs,
                          borderRadius: radius.sm,
                          borderWidth: 1,
                          borderColor: payload[field.id] === opt ? c.primary : c.border,
                          backgroundColor: payload[field.id] === opt ? c.primary : c.surface,
                        }}
                      >
                        <Text style={{ color: payload[field.id] === opt ? c.primaryFg : c.text, fontSize: 13 }}>{opt}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    value={payload[field.id] ?? ''}
                    onChangeText={(v) => setPayload((p) => ({ ...p, [field.id]: v }))}
                    multiline={field.type === 'long'}
                    keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                    placeholder={field.type === 'date' ? 'YYYY-MM-DD' : `Enter ${field.label.toLowerCase()}`}
                    style={{
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: radius.md,
                      padding: spacing.sm,
                      color: c.text,
                      minHeight: field.type === 'long' ? 100 : undefined,
                      textAlignVertical: field.type === 'long' ? 'top' : undefined,
                    }}
                  />
                )}
              </View>
            ))}

            <Pressable
              onPress={submit}
              disabled={submitting}
              style={{
                marginTop: spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: c.primary,
                alignItems: 'center',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              <Text style={{ color: c.primaryFg, fontWeight: '700' }}>
                {submitting ? 'Submitting…' : 'Submit application'}
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </Modal>
    </>
  );
}
