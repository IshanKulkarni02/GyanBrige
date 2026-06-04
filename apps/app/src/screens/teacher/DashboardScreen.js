/**
 * Teacher Dashboard Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

// Mock data
const STATS = [
  { label: 'Students', value: '156', icon: '👥', color: ['#059669', '#34d399'] },
  { label: 'Subjects', value: '4', icon: '📚', color: ['#0ea5e9', '#38bdf8'] },
  { label: 'Lectures', value: '48', icon: '🎬', color: ['#d4a574', '#e8c9a0'] },
  { label: 'Avg. Score', value: '78%', icon: '📊', color: ['#22c55e', '#4ade80'] },
];

const SUBJECTS = [
  { id: '1', name: 'Mathematics', students: 45, pendingAttendance: 3 },
  { id: '2', name: 'Physics', students: 38, pendingAttendance: 1 },
  { id: '3', name: 'Chemistry', students: 42, pendingAttendance: 0 },
  { id: '4', name: 'Biology', students: 31, pendingAttendance: 2 },
];

const RECENT_ACTIVITY = [
  { id: '1', action: 'Uploaded lecture', subject: 'Mathematics', time: '2 hours ago' },
  { id: '2', action: 'Marked attendance', subject: 'Physics', time: '5 hours ago' },
  { id: '3', action: 'Graded assignments', subject: 'Chemistry', time: '1 day ago' },
];

const DashboardScreen = ({ navigation }) => {
  const { user, signOut } = useAuth();

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
          <View>
            <Text style={TextStyles.body}>Good Morning,</Text>
            <Text style={TextStyles.h2}>{user?.name || 'Teacher'}</Text>
          </View>
          <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {STATS.map((stat, index) => (
            <GlassCard key={index} style={styles.statCard}>
              <LinearGradient colors={stat.color} style={styles.statIcon}>
                <Text style={styles.statEmoji}>{stat.icon}</Text>
              </LinearGradient>
              <Text style={TextStyles.statValue}>{stat.value}</Text>
              <Text style={TextStyles.bodySmall}>{stat.label}</Text>
            </GlassCard>
          ))}
        </View>

        {/* Quick Actions */}
        <Text style={[TextStyles.h3, styles.sectionTitle]}>Quick Actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => navigation.navigate('SubjectManagement')}
          >
            <GlassCard style={styles.actionCard}>
              <Text style={styles.actionIcon}>📖</Text>
              <Text style={TextStyles.label}>Manage Subjects</Text>
            </GlassCard>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionBtn}
            onPress={() => navigation.navigate('AttendanceUpload')}
          >
            <GlassCard style={styles.actionCard}>
              <Text style={styles.actionIcon}>📝</Text>
              <Text style={TextStyles.label}>Attendance</Text>
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* My Subjects */}
        <Text style={[TextStyles.h3, styles.sectionTitle]}>My Subjects</Text>
        {SUBJECTS.map((subject) => (
          <TouchableOpacity
            key={subject.id}
            onPress={() => navigation.navigate('SubjectManagement', { subject })}
          >
            <GlassCard style={styles.subjectCard}>
              <View style={styles.subjectRow}>
                <View>
                  <Text style={TextStyles.h3}>{subject.name}</Text>
                  <Text style={TextStyles.bodySmall}>{subject.students} Students</Text>
                </View>
                {subject.pendingAttendance > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {subject.pendingAttendance} pending
                    </Text>
                  </View>
                )}
              </View>
            </GlassCard>
          </TouchableOpacity>
        ))}

        {/* Recent Activity */}
        <Text style={[TextStyles.h3, styles.sectionTitle]}>Recent Activity</Text>
        <GlassCard>
          {RECENT_ACTIVITY.map((activity, index) => (
            <View 
              key={activity.id} 
              style={[
                styles.activityItem,
                index < RECENT_ACTIVITY.length - 1 && styles.activityBorder
              ]}
            >
              <View style={styles.activityDot} />
              <View style={styles.activityContent}>
                <Text style={TextStyles.body}>{activity.action}</Text>
                <Text style={TextStyles.bodySmall}>
                  {activity.subject} • {activity.time}
                </Text>
              </View>
            </View>
          ))}
        </GlassCard>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoutBtn: {
    backgroundColor: Colors.glass.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  logoutText: {
    color: Colors.coral,
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statEmoji: {
    fontSize: 24,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  actionBtn: {
    flex: 1,
  },
  actionCard: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  subjectCard: {
    marginBottom: Spacing.md,
  },
  subjectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    color: Colors.black,
    fontSize: 12,
    fontWeight: '600',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
  },
  activityBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.emeraldLight,
    marginTop: 6,
    marginRight: Spacing.md,
  },
  activityContent: {
    flex: 1,
  },
});

export default DashboardScreen;
