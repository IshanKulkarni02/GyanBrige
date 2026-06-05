import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  Modal, ScrollView, TextInput, Alert,
} from 'react-native';
import { api } from '../../../lib/api';
import { colors, spacing, radius } from '../../../lib/theme';

interface Dept { id: string; name: string }
interface Batch {
  id: string;
  name: string;
  programmeCode: string;
  startYear: number;
  graduationYear: number;
  currentSemester: number;
  department: { name: string };
  _count: { enrollments: number };
}
interface Course { id: string; subject: { code: string; name: string } }

export default function AdminBatches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [enrollTarget, setEnrollTarget] = useState<Batch | null>(null);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: '', programmeCode: '', deptId: '', startYear: String(new Date().getFullYear()), graduationYear: String(new Date().getFullYear() + 4), currentSemester: '1' });
  const [busy, setBusy] = useState(false);
  const c = colors.light;

  const load = async () => {
    const [b, d, co] = await Promise.all([
      api<Batch[]>('/api/batches'),
      api<Dept[]>('/api/departments'),
      api<Course[]>('/api/courses').catch(() => [] as Course[]),
    ]);
    setBatches(b); setDepts(d); setCourses(co);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (!form.name || !form.deptId || !form.programmeCode) { Alert.alert('Fill all fields'); return; }
    setBusy(true);
    try {
      await api('/api/batches', { method: 'POST', body: JSON.stringify({ ...form, startYear: +form.startYear, graduationYear: +form.graduationYear, currentSemester: +form.currentSemester }) });
      setShowCreate(false); await load();
    } catch (e) { Alert.alert('Failed', (e as Error).message); }
    finally { setBusy(false); }
  };

  const bulkEnroll = async () => {
    if (!enrollTarget || selectedCourses.size === 0) return;
    setBusy(true);
    try {
      const r = await api<{ enrolled: number }>(`/api/batches/${enrollTarget.id}/enroll`, { method: 'POST', body: JSON.stringify({ courseIds: [...selectedCourses] }) });
      Alert.alert('Enrolled', `${r.enrolled} enrolments created`);
      setEnrollTarget(null); setSelectedCourses(new Set()); await load();
    } catch (e) { Alert.alert('Failed', (e as Error).message); }
    finally { setBusy(false); }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;

  return (
    <>
      <FlatList
        data={batches}
        keyExtractor={b => b.id}
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        ListHeaderComponent={
          <Pressable onPress={() => setShowCreate(true)} style={{ padding: spacing.md, backgroundColor: c.primary, borderRadius: radius.md, alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={{ color: c.primaryFg, fontWeight: '700' }}>+ New Batch / Cohort</Text>
          </Pressable>
        }
        ListEmptyComponent={<Text style={{ color: c.textMuted, textAlign: 'center', marginTop: 32 }}>No batches yet.</Text>}
        renderItem={({ item }) => (
          <View style={{ padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>
                  {item.programmeCode} · {item.department.name} · Sem {item.currentSemester}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: 12 }}>
                  {item.startYear}–{item.graduationYear} · {item._count.enrollments} enrolments
                </Text>
              </View>
              <Pressable onPress={() => { setEnrollTarget(item); setSelectedCourses(new Set()); }}
                style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: c.primary, alignSelf: 'flex-start' }}>
                <Text style={{ color: c.primaryFg, fontSize: 12, fontWeight: '600' }}>Enrol in courses</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      {/* Create batch modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 20 }}>New Batch</Text>
            <Pressable onPress={() => setShowCreate(false)}><Text style={{ color: c.primary }}>Cancel</Text></Pressable>
          </View>
          {([['Batch name', 'name', 'e.g. CS 2022-26'], ['Programme code', 'programmeCode', 'e.g. B.Tech CS'], ['Start year', 'startYear', '2022'], ['Graduation year', 'graduationYear', '2026'], ['Current semester', 'currentSemester', '1']] as [string, keyof typeof form, string][]).map(([label, key, ph]) => (
            <View key={key} style={{ marginBottom: spacing.md }}>
              <Text style={{ color: c.text, fontWeight: '600', marginBottom: spacing.xs }}>{label}</Text>
              <TextInput value={form[key]} onChangeText={v => setForm(f => ({ ...f, [key]: v }))} placeholder={ph} keyboardType={['startYear','graduationYear','currentSemester'].includes(key) ? 'numeric' : 'default'}
                style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.sm, color: c.text }} />
            </View>
          ))}
          <Text style={{ color: c.text, fontWeight: '600', marginBottom: spacing.xs }}>Department</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg }}>
            {depts.map(d => (
              <Pressable key={d.id} onPress={() => setForm(f => ({ ...f, deptId: d.id }))}
                style={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: form.deptId === d.id ? c.primary : c.border, backgroundColor: form.deptId === d.id ? c.primary : c.surface }}>
                <Text style={{ color: form.deptId === d.id ? c.primaryFg : c.text, fontSize: 13 }}>{d.name}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={create} disabled={busy} style={{ padding: spacing.md, backgroundColor: c.primary, borderRadius: radius.md, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: c.primaryFg, fontWeight: '700' }}>{busy ? 'Creating…' : 'Create batch'}</Text>
          </Pressable>
        </ScrollView>
      </Modal>

      {/* Bulk enrol modal */}
      <Modal visible={!!enrollTarget} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <View style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: c.border }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 18 }}>Enrol {enrollTarget?.name}</Text>
            <Pressable onPress={() => setEnrollTarget(null)}><Text style={{ color: c.primary }}>Cancel</Text></Pressable>
          </View>
          <Text style={{ color: c.textMuted, fontSize: 12, padding: spacing.md }}>Select courses to enrol all batch students into:</Text>
          <FlatList
            data={courses}
            keyExtractor={c => c.id}
            contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs }}
            renderItem={({ item }) => {
              const sel = selectedCourses.has(item.id);
              return (
                <Pressable onPress={() => setSelectedCourses(prev => { const n = new Set(prev); sel ? n.delete(item.id) : n.add(item.id); return n; })}
                  style={{ padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: sel ? c.primary : c.border, backgroundColor: sel ? c.primary : c.surface, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: sel ? c.primaryFg : c.text }}>{item.subject.code} — {item.subject.name}</Text>
                  {sel && <Text style={{ color: c.primaryFg }}>✓</Text>}
                </Pressable>
              );
            }}
          />
          <Pressable onPress={bulkEnroll} disabled={busy || selectedCourses.size === 0}
            style={{ margin: spacing.md, padding: spacing.md, backgroundColor: c.primary, borderRadius: radius.md, alignItems: 'center', opacity: (busy || selectedCourses.size === 0) ? 0.5 : 1 }}>
            <Text style={{ color: c.primaryFg, fontWeight: '700' }}>{busy ? 'Enrolling…' : `Enrol in ${selectedCourses.size} course${selectedCourses.size !== 1 ? 's' : ''}`}</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
