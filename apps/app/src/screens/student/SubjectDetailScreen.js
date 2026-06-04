/**
 * Subject Detail Screen - Lectures List View with Attendance Progress
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
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

// Mock lectures data with more details
const generateLectures = (subjectName) => [
  { id: '1', title: `Introduction to ${subjectName}`, duration: '45 min', completed: true, type: 'video', date: '2024-01-15', hasNotes: true },
  { id: '2', title: 'Fundamental Concepts', duration: '52 min', completed: true, type: 'video', date: '2024-01-17', hasNotes: true },
  { id: '3', title: 'Core Principles Part 1', duration: '38 min', completed: true, type: 'video', date: '2024-01-19', hasNotes: true },
  { id: '4', title: 'Core Principles Part 2', duration: '41 min', completed: false, type: 'video', date: '2024-01-22', hasNotes: true },
  { id: '5', title: 'Advanced Topics', duration: '55 min', completed: false, type: 'video', date: '2024-01-24', hasNotes: false },
  { id: '6', title: 'Practice Problems', duration: '30 min', completed: false, type: 'quiz', date: '2024-01-26', hasNotes: false },
  { id: '7', title: 'Real-world Applications', duration: '48 min', completed: false, type: 'video', date: '2024-01-29', hasNotes: false },
  { id: '8', title: 'Problem Solving Workshop', duration: '60 min', completed: false, type: 'video', date: '2024-01-31', hasNotes: false },
  { id: '9', title: 'Review Session', duration: '35 min', completed: false, type: 'video', date: '2024-02-02', hasNotes: false },
  { id: '10', title: 'Final Assessment', duration: '90 min', completed: false, type: 'exam', date: '2024-02-05', hasNotes: false },
];

// Mock attendance data
const ATTENDANCE_DATA = {
  totalClasses: 20,
  attended: 17,
  percentage: 85,
  recentClasses: [
    { date: 'Feb 12', status: 'present' },
    { date: 'Feb 10', status: 'present' },
    { date: 'Feb 8', status: 'absent' },
    { date: 'Feb 5', status: 'present' },
    { date: 'Feb 3', status: 'present' },
    { date: 'Feb 1', status: 'present' },
    { date: 'Jan 29', status: 'present' },
  ],
};

const SubjectDetailScreen = ({ route, navigation }) => {
  const { subject } = route.params;
  const lectures = generateLectures(subject.name);
  const [activeTab, setActiveTab] = useState('lectures');

  const completedCount = lectures.filter(l => l.completed).length;
  const attendance = subject.attendance || ATTENDANCE_DATA.percentage;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'video': return '🎬';
      case 'quiz': return '📝';
      case 'exam': return '📋';
      default: return '📄';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'video': return Colors.emeraldLight;
      case 'quiz': return Colors.gold;
      case 'exam': return Colors.coral;
      default: return Colors.text.muted;
    }
  };

  const renderLectureItem = ({ item: lecture, index }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('LecturePlayer', { lecture, subject })}
      activeOpacity={0.8}
    >
      <GlassCard style={styles.lectureCard}>
        <View style={styles.lectureRow}>
          {/* Lecture Number/Status */}
          <View style={[
            styles.lectureNumber,
            lecture.completed && styles.completedNumber
          ]}>
            {lecture.completed ? (
              <Text style={styles.checkmark}>✓</Text>
            ) : (
              <Text style={styles.numberText}>{index + 1}</Text>
            )}
          </View>

          {/* Lecture Info */}
          <View style={styles.lectureInfo}>
            <View style={styles.lectureTypeRow}>
              <View style={[styles.typeBadge, { backgroundColor: getTypeColor(lecture.type) + '20' }]}>
                <Text style={styles.typeIcon}>{getTypeIcon(lecture.type)}</Text>
                <Text style={[styles.typeText, { color: getTypeColor(lecture.type) }]}>
                  {lecture.type}
                </Text>
              </View>
              {lecture.hasNotes && (
                <View style={styles.notesBadge}>
                  <Text style={styles.notesIcon}>🧠</Text>
                  <Text style={styles.notesText}>AI Notes</Text>
                </View>
              )}
            </View>
            <Text style={[
              styles.lectureTitle,
              lecture.completed && styles.completedTitle
            ]} numberOfLines={2}>
              {lecture.title}
            </Text>
            <View style={styles.lectureMeta}>
              <Text style={styles.duration}>⏱ {lecture.duration}</Text>
              <Text style={styles.dateSeparator}>•</Text>
              <Text style={styles.lectureDate}>{lecture.date}</Text>
            </View>
          </View>

          {/* Play Button */}
          <View style={[
            styles.playButton,
            lecture.completed && styles.replayButton
          ]}>
            <Text style={styles.playIcon}>{lecture.completed ? '↻' : '▶'}</Text>
          </View>
        </View>

        {/* Progress indicator for in-progress lectures */}
        {!lecture.completed && index === completedCount && (
          <View style={styles.inProgressBar}>
            <LinearGradient
              colors={subject.color}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.inProgressFill, { width: '35%' }]}
            />
          </View>
        )}
      </GlassCard>
    </TouchableOpacity>
  );

  return (
    <View style={LayoutStyles.screen}>
      <LinearGradient
        colors={Gradients.background.colors}
        start={Gradients.background.start}
        end={Gradients.background.end}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Subject Header */}
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerTop}>
            <LinearGradient
              colors={subject.color}
              style={styles.subjectIcon}
            >
              <Text style={styles.iconText}>{subject.icon}</Text>
            </LinearGradient>
            <View style={styles.headerInfo}>
              <Text style={TextStyles.h2}>{subject.name}</Text>
              <Text style={TextStyles.bodySmall}>
                {lectures.length} Lectures • {completedCount} Completed
              </Text>
            </View>
          </View>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Course Progress</Text>
              <Text style={styles.progressPercent}>{subject.progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={subject.color}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${subject.progress}%` }]}
              />
            </View>
          </View>
        </GlassCard>

        {/* Attendance Progress Card */}
        <GlassCard style={styles.attendanceCard}>
          <View style={styles.attendanceHeader}>
            <Text style={TextStyles.h3}>Attendance</Text>
            <View style={[
              styles.attendanceStatus,
              { backgroundColor: attendance >= 75 ? Colors.success + '20' : Colors.warning + '20' }
            ]}>
              <Text style={[
                styles.attendanceStatusText,
                { color: attendance >= 75 ? Colors.success : Colors.warning }
              ]}>
                {attendance >= 75 ? 'Good Standing' : 'Needs Attention'}
              </Text>
            </View>
          </View>

          {/* Attendance Progress Bar */}
          <View style={styles.attendanceProgress}>
            <View style={styles.attendanceTrack}>
              <LinearGradient
                colors={attendance >= 75 ? ['#22c55e', '#4ade80'] : ['#eab308', '#fbbf24']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.attendanceFill, { width: `${attendance}%` }]}
              />
              {/* Minimum threshold marker */}
              <View style={styles.thresholdMarker}>
                <View style={styles.thresholdLine} />
                <Text style={styles.thresholdText}>75%</Text>
              </View>
            </View>
          </View>

          {/* Attendance Stats */}
          <View style={styles.attendanceStats}>
            <View style={styles.attendanceStat}>
              <Text style={styles.attendanceValue}>{ATTENDANCE_DATA.attended}</Text>
              <Text style={styles.attendanceLabel}>Attended</Text>
            </View>
            <View style={styles.attendanceDivider} />
            <View style={styles.attendanceStat}>
              <Text style={styles.attendanceValue}>{ATTENDANCE_DATA.totalClasses - ATTENDANCE_DATA.attended}</Text>
              <Text style={styles.attendanceLabel}>Missed</Text>
            </View>
            <View style={styles.attendanceDivider} />
            <View style={styles.attendanceStat}>
              <Text style={[styles.attendanceValue, { color: Colors.emeraldLight }]}>{attendance}%</Text>
              <Text style={styles.attendanceLabel}>Rate</Text>
            </View>
          </View>

          {/* Recent Attendance */}
          <View style={styles.recentAttendance}>
            <Text style={styles.recentLabel}>Recent Classes</Text>
            <View style={styles.attendanceDots}>
              {ATTENDANCE_DATA.recentClasses.map((cls, index) => (
                <View key={index} style={styles.attendanceDotWrapper}>
                  <View style={[
                    styles.attendanceDot,
                    { backgroundColor: cls.status === 'present' ? Colors.success : Colors.danger }
                  ]} />
                  <Text style={styles.dotDate}>{cls.date.split(' ')[0]}</Text>
                </View>
              ))}
            </View>
          </View>
        </GlassCard>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'lectures' && styles.activeTab]}
            onPress={() => setActiveTab('lectures')}
          >
            <Text style={[styles.tabText, activeTab === 'lectures' && styles.activeTabText]}>
              Lectures ({lectures.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'resources' && styles.activeTab]}
            onPress={() => setActiveTab('resources')}
          >
            <Text style={[styles.tabText, activeTab === 'resources' && styles.activeTabText]}>
              Resources
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lectures List */}
        {activeTab === 'lectures' && (
          <View style={styles.lecturesList}>
            {lectures.map((lecture, index) => (
              <View key={lecture.id}>
                {renderLectureItem({ item: lecture, index })}
              </View>
            ))}
          </View>
        )}

        {/* Resources Tab */}
        {activeTab === 'resources' && (
          <GlassCard style={styles.resourcesCard}>
            <View style={styles.resourceItem}>
              <Text style={styles.resourceIcon}>📖</Text>
              <View style={styles.resourceInfo}>
                <Text style={TextStyles.label}>Course Syllabus</Text>
                <Text style={TextStyles.bodySmall}>PDF • 2.4 MB</Text>
              </View>
              <Text style={styles.downloadIcon}>⬇</Text>
            </View>
            <View style={styles.resourceItem}>
              <Text style={styles.resourceIcon}>📁</Text>
              <View style={styles.resourceInfo}>
                <Text style={TextStyles.label}>Practice Questions</Text>
                <Text style={TextStyles.bodySmall}>PDF • 5.1 MB</Text>
              </View>
              <Text style={styles.downloadIcon}>⬇</Text>
            </View>
            <View style={styles.resourceItem}>
              <Text style={styles.resourceIcon}>🎥</Text>
              <View style={styles.resourceInfo}>
                <Text style={TextStyles.label}>Supplementary Videos</Text>
                <Text style={TextStyles.bodySmall}>5 Videos</Text>
              </View>
              <Text style={styles.downloadIcon}>→</Text>
            </View>
          </GlassCard>
        )}
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
    paddingBottom: 40,
  },
  headerCard: {
    marginBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  subjectIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 32,
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  progressSection: {
    marginTop: Spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  progressLabel: {
    fontSize: 13,
    color: Colors.text.muted,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.emeraldLight,
  },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  attendanceCard: {
    marginBottom: Spacing.lg,
  },
  attendanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  attendanceStatus: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
  },
  attendanceStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  attendanceProgress: {
    marginBottom: Spacing.lg,
  },
  attendanceTrack: {
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    overflow: 'visible',
    position: 'relative',
  },
  attendanceFill: {
    height: '100%',
    borderRadius: 6,
  },
  thresholdMarker: {
    position: 'absolute',
    left: '75%',
    top: -4,
    alignItems: 'center',
  },
  thresholdLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.text.muted,
  },
  thresholdText: {
    fontSize: 9,
    color: Colors.text.muted,
    marginTop: 2,
  },
  attendanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
  },
  attendanceStat: {
    alignItems: 'center',
  },
  attendanceDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.glass.border,
  },
  attendanceValue: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  attendanceLabel: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
  recentAttendance: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
  },
  recentLabel: {
    fontSize: 12,
    color: Colors.text.muted,
    marginBottom: Spacing.sm,
  },
  attendanceDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attendanceDotWrapper: {
    alignItems: 'center',
  },
  attendanceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  dotDate: {
    fontSize: 9,
    color: Colors.text.muted,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.glass.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  activeTab: {
    backgroundColor: Colors.emerald,
  },
  tabText: {
    fontSize: 14,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.white,
  },
  lecturesList: {
    gap: Spacing.md,
  },
  lectureCard: {
    padding: Spacing.lg,
  },
  lectureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lectureNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedNumber: {
    backgroundColor: Colors.emerald,
    borderColor: Colors.emerald,
  },
  numberText: {
    color: Colors.text.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
  checkmark: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  lectureInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  lectureTypeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  typeIcon: {
    fontSize: 10,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  notesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    backgroundColor: Colors.info + '20',
    gap: 4,
  },
  notesIcon: {
    fontSize: 10,
  },
  notesText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.info,
  },
  lectureTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  completedTitle: {
    color: Colors.text.secondary,
  },
  lectureMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  duration: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  dateSeparator: {
    color: Colors.text.muted,
    marginHorizontal: Spacing.xs,
  },
  lectureDate: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.emerald,
    justifyContent: 'center',
    alignItems: 'center',
  },
  replayButton: {
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.emeraldLight,
  },
  playIcon: {
    color: Colors.white,
    fontSize: 16,
  },
  inProgressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  inProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  resourcesCard: {
    gap: Spacing.md,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  resourceIcon: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  resourceInfo: {
    flex: 1,
  },
  downloadIcon: {
    color: Colors.emeraldLight,
    fontSize: 18,
  },
});

export default SubjectDetailScreen;
