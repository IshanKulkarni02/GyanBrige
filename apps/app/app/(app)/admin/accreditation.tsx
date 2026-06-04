import { useState } from 'react';
import { View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { api, apiUrl, tokenStore } from '../../../lib/api';
import { colors, radius, spacing, typography } from '../../../lib/theme';
import { Hero, Surface, Button, Tag } from '../../../components/ui';

interface Outcomes {
  codes: string[];
  rows: Record<string, string | number>[];
}

export default function Accreditation() {
  const [courseId, setCourseId] = useState('');
  const [data, setData] = useState<Outcomes | null>(null);
  const [busy, setBusy] = useState(false);
  const c = colors.dark;

  const load = async () => {
    if (!courseId) return;
    setBusy(true);
    try {
      setData(await api<Outcomes>(`/api/accreditation/course/${courseId}/outcomes`));
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = async () => {
    const token = await tokenStore.get();
    const url = `${apiUrl}/api/accreditation/course/${courseId}/outcomes?format=csv`;
    if (typeof window !== 'undefined') {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `course-${courseId}-outcomes.csv`;
      a.click();
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Hero
        eyebrow="Reports"
        title="Outcome attainment."
        subtitle="NAAC / NBA-shaped course outcome → student matrix. Export as CSV."
      />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            placeholder="Course ID"
            placeholderTextColor={c.textSubtle}
            value={courseId}
            onChangeText={setCourseId}
            autoCapitalize="none"
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.surface,
              borderRadius: 999,
              paddingHorizontal: spacing.md,
              color: c.text,
            }}
          />
          <Button label="Load" onPress={load} busy={busy} />
          <Button label="CSV" variant="ghost" onPress={downloadCsv} />
        </View>

        {data && data.rows.length > 0 && (
          <Surface padded={false}>
            <ScrollView horizontal>
              <View>
                <View style={{ flexDirection: 'row', padding: spacing.sm, backgroundColor: c.surfaceAlt }}>
                  <Text style={{ width: 140, color: c.text, fontWeight: '700' }}>Student</Text>
                  {data.codes.map((co) => (
                    <Text key={co} style={{ width: 80, color: c.primary, fontWeight: '700' }}>
                      {co}
                    </Text>
                  ))}
                </View>
                {data.rows.map((r, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      padding: spacing.sm,
                      borderTopWidth: 1,
                      borderTopColor: c.border,
                    }}
                  >
                    <Text style={{ width: 140, color: c.text }} numberOfLines={1}>
                      {String(r.studentName)}
                    </Text>
                    {data.codes.map((co) => (
                      <Text key={co} style={{ width: 80, color: c.textMuted }}>
                        {String(r[co] ?? '—')}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </Surface>
        )}
      </View>
    </ScrollView>
  );
}
