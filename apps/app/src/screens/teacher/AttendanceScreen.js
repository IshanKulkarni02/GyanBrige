/**
 * Attendance Screen
 * Teacher interface for marking student attendance
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Switch,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../components';
import {
  Colors,
  Gradients,
  TextStyles,
  Spacing,
  BorderRadius,
} from '../../theme';
import {
  initializeDatabase,
  getClassStudents,
  getAttendanceForDate,
  markAttendance,
  markBulkAttendance,
  getRecentAttendanceDates,
} from '../../services/attendance';

// Days of week
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const AttendanceScreen = ({ navigation }) => {
  // State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [weekDates, setWeekDates] = useState([]);
  const [recentDates, setRecentDates] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Mock class ID (in production, get from context/params)
  const classId = 'class_10a';
  const className = 'Class 10-A';

  // Initialize database and load data
  useEffect(() => {
    initData();
  }, []);

  // Reload attendance when date changes
  useEffect(() => {
    if (!isLoading) {
      loadAttendance();
    }
  }, [selectedDate]);

  // Generate week dates
  useEffect(() => {
    generateWeekDates();
  }, [selectedDate]);

  const initData = async () => {
    try {
      setIsLoading(true);
      await initializeDatabase();
      await loadStudents();
      await loadAttendance();
      await loadRecentDates();
    } catch (error) {
      console.error('Init error:', error);
      Alert.alert('Error', 'Failed to initialize attendance data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStudents = async () => {
    const studentList = await getClassStudents(classId);
    setStudents(studentList);
  };

  const loadAttendance = async () => {
    try {
      const attendanceData = await getAttendanceForDate(classId, selectedDate);
      setAttendance(attendanceData);
      setHasChanges(false);
    } catch (error) {
      console.error('Load attendance error:', error);
    }
  };

  const loadRecentDates = async () => {
    try {
      const dates = await getRecentAttendanceDates(classId, 5);
      setRecentDates(dates);
    } catch (error) {
      console.error('Load recent dates error:', error);
    }
  };

  const generateWeekDates = () => {
    const dates = [];
    const today = new Date();
    
    // Generate 7 days around selected date
    for (let i = -3; i <= 3; i++) {
      const date = new Date(selectedDate);
      date.setDate(selectedDate.getDate() + i);
      dates.push(date);
    }
    
    setWeekDates(dates);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAttendance();
    await loadRecentDates();
    setRefreshing(false);
  }, [selectedDate]);

  // Toggle attendance for a student
  const toggleAttendance = (studentId) => {
    const currentStatus = attendance[studentId];
    const newStatus = currentStatus === 'present' ? 'absent' : 'present';
    
    setAttendance(prev => ({
      ...prev,
      [studentId]: newStatus,
    }));
    setHasChanges(true);
  };

  // Mark all present
  const markAllPresent = () => {
    const newAttendance = {};
    students.forEach(student => {
      newAttendance[student.id] = 'present';
    });
    setAttendance(newAttendance);
    setHasChanges(true);
  };

  // Mark all absent
  const markAllAbsent = () => {
    const newAttendance = {};
    students.forEach(student => {
      newAttendance[student.id] = 'absent';
    });
    setAttendance(newAttendance);
    setHasChanges(true);
  };

  // Save attendance
  const saveAttendance = async () => {
    try {
      setIsSaving(true);
      
      // Mark all students - default to absent if not marked
      const fullAttendance = {};
      students.forEach(student => {
        fullAttendance[student.id] = attendance[student.id] || 'absent';
      });
      
      await markBulkAttendance(classId, selectedDate, fullAttendance);
      await loadRecentDates();
      
      setHasChanges(false);
      Alert.alert('Success', 'Attendance saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save attendance');
    } finally {
      setIsSaving(false);
    }
  };

  // Format date
  const formatDate = (date) => {
    return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  };

  const formatFullDate = (date) => {
    return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  };

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // Check if date is selected
  const isSelected = (date) => {
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  };

  // Navigate to previous/next week
  const navigateWeek = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + (direction * 7));
    setSelectedDate(newDate);
  };

  // Count present/absent
  const presentCount = Object.values(attendance).filter(s => s === 'present').length;
  const absentCount = students.length - presentCount;

  // Render student item
  const renderStudentItem = ({ item: student, index }) => {
    const status = attendance[student.id] || 'absent';
    const isPresent = status === 'present';

    return (
      <TouchableOpacity
        style={styles.studentItem}
        onPress={() => toggleAttendance(student.id)}
        activeOpacity={0.7}
      >
        <GlassCard style={[styles.studentCard, isPresent && styles.studentCardPresent]}>
          <View style={styles.studentInfo}>
            <View style={[styles.avatar, isPresent && styles.avatarPresent]}>
              <Text style={styles.avatarText}>
                {student.name.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
            <View style={styles.studentDetails}>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentRoll}>Roll No: {student.roll_number}</Text>
            </View>
          </View>
          
          <View style={styles.attendanceToggle}>
            <Text style={[styles.statusText, isPresent ? styles.presentText : styles.absentText]}>
              {isPresent ? 'Present' : 'Absent'}
            </Text>
            <Switch
              value={isPresent}
              onValueChange={() => toggleAttendance(student.id)}
              trackColor={{ false: 'rgba(239, 68, 68, 0.3)', true: 'rgba(52, 211, 153, 0.3)' }}
              thumbColor={isPresent ? Colors.emeraldLight : Colors.error}
              ios_backgroundColor="rgba(239, 68, 68, 0.3)"
            />
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient
          colors={Gradients.background.colors}
          start={Gradients.background.start}
          end={Gradients.background.end}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={Colors.emeraldLight} />
        <Text style={styles.loadingText}>Loading attendance...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Gradients.background.colors}
        start={Gradients.background.start}
        end={Gradients.background.end}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={TextStyles.h2}>Attendance</Text>
          <Text style={TextStyles.body}>{className}</Text>
        </View>
        <View style={styles.headerStats}>
          <View style={[styles.statBadge, styles.presentBadge]}>
            <Text style={styles.statBadgeText}>{presentCount} ✓</Text>
          </View>
          <View style={[styles.statBadge, styles.absentBadge]}>
            <Text style={styles.statBadgeText}>{absentCount} ✗</Text>
          </View>
        </View>
      </View>

      {/* Date Selector */}
      <GlassCard style={styles.dateCard}>
        <View style={styles.dateHeader}>
          <TouchableOpacity onPress={() => navigateWeek(-1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </Text>
          <TouchableOpacity onPress={() => navigateWeek(1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>▶</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.datesContainer}
        >
          {weekDates.map((date, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dateItem,
                isSelected(date) && styles.dateItemSelected,
                isToday(date) && styles.dateItemToday,
              ]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={[
                styles.dateWeekday,
                isSelected(date) && styles.dateTextSelected,
              ]}>
                {WEEKDAYS[date.getDay()]}
              </Text>
              <Text style={[
                styles.dateDay,
                isSelected(date) && styles.dateTextSelected,
              ]}>
                {date.getDate()}
              </Text>
              {isToday(date) && (
                <View style={styles.todayDot} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.selectedDateText}>
          📅 {formatFullDate(selectedDate)}
        </Text>
      </GlassCard>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickBtn} onPress={markAllPresent}>
          <LinearGradient colors={['#059669', '#34d399']} style={styles.quickBtnGradient}>
            <Text style={styles.quickBtnText}>Mark All Present</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={markAllAbsent}>
          <View style={styles.quickBtnOutline}>
            <Text style={styles.quickBtnOutlineText}>Mark All Absent</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Student List */}
      <FlatList
        data={students}
        renderItem={renderStudentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.studentList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.emeraldLight}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No students in this class</Text>
          </View>
        }
      />

      {/* Save Button */}
      {hasChanges && (
        <View style={styles.saveContainer}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={saveAttendance}
            disabled={isSaving}
          >
            <LinearGradient
              colors={Gradients.primary.colors}
              style={styles.saveBtnGradient}
            >
              {isSaving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>💾 Save Attendance</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Recent Attendance Summary */}
      {recentDates.length > 0 && !hasChanges && (
        <GlassCard style={styles.recentCard}>
          <Text style={styles.recentTitle}>Recent Records</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {recentDates.map((record, index) => (
              <View key={index} style={styles.recentItem}>
                <Text style={styles.recentDate}>{record.date.slice(5)}</Text>
                <View style={styles.recentStats}>
                  <Text style={styles.recentPresent}>{record.present}✓</Text>
                  <Text style={styles.recentAbsent}>{record.absent}✗</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </GlassCard>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.dark,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.text.secondary,
    marginTop: Spacing.md,
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  presentBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
  },
  absentBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },

  // Date card
  dateCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  navBtn: {
    padding: Spacing.sm,
  },
  navBtnText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  datesContainer: {
    paddingVertical: Spacing.sm,
  },
  dateItem: {
    width: 50,
    height: 65,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  dateItemSelected: {
    backgroundColor: Colors.emerald,
  },
  dateItemToday: {
    borderWidth: 1,
    borderColor: Colors.emeraldLight,
  },
  dateWeekday: {
    fontSize: 11,
    color: Colors.text.muted,
    marginBottom: 2,
  },
  dateDay: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  dateTextSelected: {
    color: Colors.white,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.emeraldLight,
    marginTop: 4,
  },
  selectedDateText: {
    textAlign: 'center',
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  quickBtn: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  quickBtnGradient: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  quickBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  quickBtnOutline: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.md,
  },
  quickBtnOutlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },

  // Student list
  studentList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
  },
  studentItem: {
    marginBottom: Spacing.sm,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  studentCardPresent: {
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarPresent: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  studentRoll: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  attendanceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  presentText: {
    color: Colors.emeraldLight,
  },
  absentText: {
    color: Colors.error,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.muted,
  },

  // Save button
  saveContainer: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  saveBtn: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: Colors.emerald,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  saveBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },

  // Recent card
  recentCard: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  recentItem: {
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  recentDate: {
    fontSize: 12,
    color: Colors.text.muted,
    marginBottom: 4,
  },
  recentStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  recentPresent: {
    fontSize: 12,
    color: Colors.emeraldLight,
    fontWeight: '600',
  },
  recentAbsent: {
    fontSize: 12,
    color: Colors.error,
    fontWeight: '600',
  },
});

export default AttendanceScreen;
