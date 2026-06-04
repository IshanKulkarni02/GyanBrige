/**
 * Attendance & Upload Screen - Teacher
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../components';
import {
  Colors,
  Gradients,
  TextStyles,
  ButtonStyles,
  Spacing,
  BorderRadius,
  LayoutStyles,
} from '../../theme';

// Mock students data
const MOCK_STUDENTS = [
  { id: '1', name: 'Rahul Sharma', rollNo: 'CS001', present: null },
  { id: '2', name: 'Priya Patel', rollNo: 'CS002', present: null },
  { id: '3', name: 'Amit Kumar', rollNo: 'CS003', present: null },
  { id: '4', name: 'Sneha Gupta', rollNo: 'CS004', present: null },
  { id: '5', name: 'Vikram Singh', rollNo: 'CS005', present: null },
  { id: '6', name: 'Anjali Verma', rollNo: 'CS006', present: null },
  { id: '7', name: 'Deepak Joshi', rollNo: 'CS007', present: null },
  { id: '8', name: 'Kavita Reddy', rollNo: 'CS008', present: null },
];

const AttendanceUploadScreen = ({ route }) => {
  const subject = route.params?.subject || { name: 'Mathematics' };
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const markAttendance = (studentId, present) => {
    setStudents(students.map(s => 
      s.id === studentId ? { ...s, present } : s
    ));
  };

  const markAllPresent = () => {
    setStudents(students.map(s => ({ ...s, present: true })));
  };

  const markAllAbsent = () => {
    setStudents(students.map(s => ({ ...s, present: false })));
  };

  const handleSubmit = () => {
    const unmarked = students.filter(s => s.present === null);
    if (unmarked.length > 0) {
      Alert.alert(
        'Incomplete Attendance',
        `${unmarked.length} student(s) are not marked. Do you want to mark them as absent?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Mark Absent & Submit',
            onPress: () => {
              setStudents(students.map(s => 
                s.present === null ? { ...s, present: false } : s
              ));
              submitAttendance();
            },
          },
        ]
      );
    } else {
      submitAttendance();
    }
  };

  const submitAttendance = () => {
    const presentCount = students.filter(s => s.present).length;
    Alert.alert(
      'Attendance Submitted',
      `${presentCount} present, ${students.length - presentCount} absent for ${selectedDate}`,
    );
  };

  const presentCount = students.filter(s => s.present === true).length;
  const absentCount = students.filter(s => s.present === false).length;
  const unmarkedCount = students.filter(s => s.present === null).length;

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
        <GlassCard style={styles.headerCard}>
          <Text style={TextStyles.h2}>{subject.name}</Text>
          <Text style={TextStyles.body}>Attendance for {selectedDate}</Text>

          {/* Summary Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statItem, styles.presentStat]}>
              <Text style={[TextStyles.statValue, { color: Colors.success }]}>{presentCount}</Text>
              <Text style={TextStyles.bodySmall}>Present</Text>
            </View>
            <View style={[styles.statItem, styles.absentStat]}>
              <Text style={[TextStyles.statValue, { color: Colors.danger }]}>{absentCount}</Text>
              <Text style={TextStyles.bodySmall}>Absent</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[TextStyles.statValue, { color: Colors.warning }]}>{unmarkedCount}</Text>
              <Text style={TextStyles.bodySmall}>Unmarked</Text>
            </View>
          </View>
        </GlassCard>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={markAllPresent}>
            <GlassCard style={[styles.quickBtnCard, styles.presentBtn]}>
              <Text style={styles.quickBtnText}>✓ All Present</Text>
            </GlassCard>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={markAllAbsent}>
            <GlassCard style={[styles.quickBtnCard, styles.absentBtn]}>
              <Text style={styles.quickBtnText}>✗ All Absent</Text>
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* Students List */}
        <Text style={[TextStyles.h3, styles.sectionTitle]}>
          Students ({students.length})
        </Text>

        {students.map((student) => (
          <GlassCard key={student.id} style={styles.studentCard}>
            <View style={styles.studentInfo}>
              <LinearGradient
                colors={Gradients.brand.colors}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>
                  {student.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </LinearGradient>
              <View>
                <Text style={TextStyles.label}>{student.name}</Text>
                <Text style={TextStyles.bodySmall}>{student.rollNo}</Text>
              </View>
            </View>

            <View style={styles.attendanceButtons}>
              <TouchableOpacity
                style={[
                  styles.attendanceBtn,
                  styles.presentToggle,
                  student.present === true && styles.presentActive,
                ]}
                onPress={() => markAttendance(student.id, true)}
              >
                <Text style={[
                  styles.attendanceBtnText,
                  student.present === true && styles.activeBtnText,
                ]}>P</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.attendanceBtn,
                  styles.absentToggle,
                  student.present === false && styles.absentActive,
                ]}
                onPress={() => markAttendance(student.id, false)}
              >
                <Text style={[
                  styles.attendanceBtnText,
                  student.present === false && styles.activeBtnText,
                ]}>A</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ))}

        {/* Submit Button */}
        <TouchableOpacity onPress={handleSubmit} style={styles.submitWrapper}>
          <LinearGradient
            colors={Gradients.primary.colors}
            style={[ButtonStyles.primary, styles.submitBtn]}
          >
            <Text style={ButtonStyles.primaryText}>Submit Attendance</Text>
          </LinearGradient>
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
  },
  headerCard: {
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.xxl,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  quickBtn: {
    flex: 1,
  },
  quickBtnCard: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  presentBtn: {
    borderColor: Colors.success,
    borderWidth: 1,
  },
  absentBtn: {
    borderColor: Colors.danger,
    borderWidth: 1,
  },
  quickBtnText: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  studentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    color: Colors.white,
    fontWeight: '600',
  },
  attendanceButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  attendanceBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  presentToggle: {
    borderColor: Colors.success,
    backgroundColor: 'transparent',
  },
  absentToggle: {
    borderColor: Colors.danger,
    backgroundColor: 'transparent',
  },
  presentActive: {
    backgroundColor: Colors.success,
  },
  absentActive: {
    backgroundColor: Colors.danger,
  },
  attendanceBtnText: {
    fontWeight: '700',
    fontSize: 16,
    color: Colors.text.secondary,
  },
  activeBtnText: {
    color: Colors.white,
  },
  submitWrapper: {
    marginTop: Spacing.xxl,
  },
  submitBtn: {
    width: '100%',
  },
});

export default AttendanceUploadScreen;
