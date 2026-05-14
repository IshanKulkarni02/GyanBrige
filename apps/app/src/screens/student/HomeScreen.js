/**
 * Student Home Screen - Grid Layout for All Subjects
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../components';
import {
  Colors,
  Gradients,
  TextStyles,
  Spacing,
  BorderRadius,
  LayoutStyles,
} from '../../theme';
import { useAuth } from '../../services/AuthContext';

const { width } = Dimensions.get('window');
const GRID_GAP = Spacing.md;
const CARD_WIDTH = (width - (Spacing.xxl * 2) - GRID_GAP) / 2;

// Mock subjects data
const SUBJECTS = [
  { id: '1', name: 'Mathematics', icon: '📐', lectures: 24, progress: 75, attendance: 92, color: ['#059669', '#34d399'] },
  { id: '2', name: 'Physics', icon: '⚛️', lectures: 18, progress: 60, attendance: 88, color: ['#0ea5e9', '#38bdf8'] },
  { id: '3', name: 'Chemistry', icon: '🧪', lectures: 20, progress: 45, attendance: 95, color: ['#d4a574', '#e8c9a0'] },
  { id: '4', name: 'Biology', icon: '🧬', lectures: 22, progress: 30, attendance: 78, color: ['#22c55e', '#4ade80'] },
  { id: '5', name: 'English', icon: '📚', lectures: 16, progress: 90, attendance: 100, color: ['#e07a5f', '#f59e0b'] },
  { id: '6', name: 'Computer Science', icon: '💻', lectures: 28, progress: 55, attendance: 85, color: ['#8b5cf6', '#a78bfa'] },
  { id: '7', name: 'History', icon: '🏛️', lectures: 14, progress: 40, attendance: 90, color: ['#ec4899', '#f472b6'] },
  { id: '8', name: 'Geography', icon: '🌍', lectures: 12, progress: 65, attendance: 82, color: ['#14b8a6', '#5eead4'] },
];

const HomeScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();

  const totalLectures = SUBJECTS.reduce((acc, s) => acc + s.lectures, 0);
  const avgProgress = Math.round(SUBJECTS.reduce((acc, s) => acc + s.progress, 0) / SUBJECTS.length);
  const avgAttendance = Math.round(SUBJECTS.reduce((acc, s) => acc + s.attendance, 0) / SUBJECTS.length);

  return (
    <View style={LayoutStyles.screen}>
      <LinearGradient
        colors={Gradients.background.colors}
        start={Gradients.background.start}
        end={Gradients.background.end}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={Gradients.brand.colors}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>
                {user?.name?.split(' ').map(n => n[0]).join('') || 'S'}
              </Text>
            </LinearGradient>
            <View>
              <Text style={TextStyles.body}>Welcome back,</Text>
              <Text style={TextStyles.h2}>{user?.name || 'Student'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>↪</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Overview */}
        <GlassCard style={styles.overviewCard}>
          <View style={styles.overviewRow}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{SUBJECTS.length}</Text>
              <Text style={styles.overviewLabel}>Subjects</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewValue}>{totalLectures}</Text>
              <Text style={styles.overviewLabel}>Lectures</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={[styles.overviewValue, { color: Colors.emeraldLight }]}>{avgProgress}%</Text>
              <Text style={styles.overviewLabel}>Progress</Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={[styles.overviewValue, { color: Colors.gold }]}>{avgAttendance}%</Text>
              <Text style={styles.overviewLabel}>Attendance</Text>
            </View>
          </View>
        </GlassCard>

        {/* Section Title */}
        <View style={styles.sectionHeader}>
          <Text style={TextStyles.h3}>All Subjects</Text>
          <View style={styles.filterBadge}>
            <Text style={styles.filterText}>{SUBJECTS.length} Enrolled</Text>
          </View>
        </View>

        {/* Subjects Grid */}
        <View style={styles.grid}>
          {SUBJECTS.map((subject) => (
            <TouchableOpacity
              key={subject.id}
              onPress={() => navigation.navigate('SubjectDetail', { subject })}
              activeOpacity={0.8}
              style={styles.gridItem}
            >
              <GlassCard style={styles.subjectCard}>
                {/* Icon & Progress Ring */}
                <View style={styles.cardTop}>
                  <LinearGradient
                    colors={subject.color}
                    style={styles.subjectIcon}
                  >
                    <Text style={styles.iconText}>{subject.icon}</Text>
                  </LinearGradient>
                  <View style={styles.progressRing}>
                    <Text style={styles.progressRingText}>{subject.progress}%</Text>
                  </View>
                </View>

                {/* Subject Info */}
                <Text style={styles.subjectName} numberOfLines={1}>{subject.name}</Text>
                <Text style={styles.lectureCount}>{subject.lectures} Lectures</Text>

                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressTrack}>
                    <LinearGradient
                      colors={subject.color}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.progressFill, { width: `${subject.progress}%` }]}
                    />
                  </View>
                </View>

                {/* Attendance Badge */}
                <View style={styles.attendanceBadge}>
                  <View style={[
                    styles.attendanceDot,
                    { backgroundColor: subject.attendance >= 75 ? Colors.success : Colors.warning }
                  ]} />
                  <Text style={styles.attendanceText}>{subject.attendance}% Attendance</Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>

        {/* Continue Learning */}
        <Text style={[TextStyles.h3, styles.continueTitle]}>Continue Learning</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('SubjectDetail', { subject: SUBJECTS[0] })}
          activeOpacity={0.8}
        >
          <GlassCard style={styles.continueCard}>
            <LinearGradient
              colors={SUBJECTS[0].color}
              style={styles.continueThumbnail}
            >
              <Text style={styles.playIcon}>▶</Text>
            </LinearGradient>
            <View style={styles.continueInfo}>
              <Text style={TextStyles.labelUppercase}>Last watched</Text>
              <Text style={TextStyles.h3}>Introduction to Calculus</Text>
              <Text style={TextStyles.bodySmall}>{SUBJECTS[0].name} • Lecture 5 of 24</Text>
              <View style={styles.continueProgress}>
                <View style={styles.continueTrack}>
                  <LinearGradient
                    colors={SUBJECTS[0].color}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.continueFill, { width: '65%' }]}
                  />
                </View>
                <Text style={styles.continueTime}>12:30 / 45:00</Text>
              </View>
            </View>
          </GlassCard>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.xxl,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 18,
  },
  logoutBtn: {
    width: 44,
    height: 44,
    backgroundColor: Colors.glass.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: Colors.coral,
    fontSize: 20,
  },
  overviewCard: {
    marginBottom: Spacing.xxl,
    padding: Spacing.lg,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  overviewDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.glass.border,
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  overviewLabel: {
    fontSize: 11,
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  filterBadge: {
    backgroundColor: Colors.glass.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  filterText: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginBottom: Spacing.xxl,
  },
  gridItem: {
    width: CARD_WIDTH,
  },
  subjectCard: {
    padding: Spacing.lg,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  subjectIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 24,
  },
  progressRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: Colors.emeraldLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRingText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.emeraldLight,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  lectureCount: {
    fontSize: 12,
    color: Colors.text.muted,
    marginBottom: Spacing.md,
  },
  progressBarContainer: {
    marginBottom: Spacing.sm,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  attendanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  attendanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  attendanceText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  continueTitle: {
    marginBottom: Spacing.lg,
  },
  continueCard: {
    flexDirection: 'row',
    padding: Spacing.md,
  },
  continueThumbnail: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 30,
    color: Colors.white,
  },
  continueInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    justifyContent: 'center',
  },
  continueProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  continueTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  continueFill: {
    height: '100%',
    borderRadius: 2,
  },
  continueTime: {
    fontSize: 11,
    color: Colors.text.muted,
  },
});

export default HomeScreen;
