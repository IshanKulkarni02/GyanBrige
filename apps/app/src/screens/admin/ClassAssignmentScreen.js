/**
 * Class Assignment Screen - Admin
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

// Mock data
const MOCK_CLASSES = [
  { id: '1', name: 'Class 10-A', students: 35, teacher: 'Dr. Priya Sharma', subjects: ['Mathematics', 'Physics'] },
  { id: '2', name: 'Class 10-B', students: 32, teacher: 'Prof. Amit Verma', subjects: ['Chemistry', 'Biology'] },
  { id: '3', name: 'Class 11-A', students: 28, teacher: null, subjects: ['Mathematics'] },
  { id: '4', name: 'Class 11-B', students: 30, teacher: 'Dr. Priya Sharma', subjects: ['Physics', 'Computer Science'] },
];

const AVAILABLE_TEACHERS = [
  { id: '1', name: 'Dr. Priya Sharma', subjects: ['Mathematics', 'Physics'] },
  { id: '2', name: 'Prof. Amit Verma', subjects: ['Chemistry', 'Biology'] },
  { id: '3', name: 'Dr. Rajesh Kumar', subjects: ['Computer Science'] },
  { id: '4', name: 'Ms. Anita Singh', subjects: ['English', 'History'] },
];

const ClassAssignmentScreen = ({ navigation }) => {
  const [classes, setClasses] = useState(MOCK_CLASSES);
  const [selectedClass, setSelectedClass] = useState(null);
  const [showTeacherPicker, setShowTeacherPicker] = useState(false);

  const assignTeacher = (teacherName) => {
    if (selectedClass) {
      setClasses(classes.map(c => 
        c.id === selectedClass.id ? { ...c, teacher: teacherName } : c
      ));
      setShowTeacherPicker(false);
      setSelectedClass(null);
      Alert.alert('Success', `${teacherName} assigned to ${selectedClass.name}`);
    }
  };

  const openTeacherPicker = (classItem) => {
    setSelectedClass(classItem);
    setShowTeacherPicker(true);
  };

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
          <Text style={TextStyles.h2}>Class Assignment</Text>
          <Text style={TextStyles.body}>Manage classes and assign teachers</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={TextStyles.statValue}>{classes.length}</Text>
              <Text style={TextStyles.bodySmall}>Classes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={TextStyles.statValue}>
                {classes.reduce((acc, c) => acc + c.students, 0)}
              </Text>
              <Text style={TextStyles.bodySmall}>Total Students</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[TextStyles.statValue, { color: Colors.warning }]}>
                {classes.filter(c => !c.teacher).length}
              </Text>
              <Text style={TextStyles.bodySmall}>Unassigned</Text>
            </View>
          </View>
        </GlassCard>

        {/* Teacher Picker Modal */}
        {showTeacherPicker && (
          <GlassCard style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={TextStyles.h3}>Assign Teacher</Text>
              <TouchableOpacity onPress={() => setShowTeacherPicker(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={TextStyles.bodySmall}>
              Select a teacher for {selectedClass?.name}
            </Text>

            {AVAILABLE_TEACHERS.map((teacher) => (
              <TouchableOpacity
                key={teacher.id}
                style={styles.teacherOption}
                onPress={() => assignTeacher(teacher.name)}
              >
                <LinearGradient
                  colors={Gradients.gold.colors}
                  style={styles.teacherAvatar}
                >
                  <Text style={styles.avatarText}>
                    {teacher.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                </LinearGradient>
                <View style={styles.teacherInfo}>
                  <Text style={TextStyles.label}>{teacher.name}</Text>
                  <Text style={TextStyles.bodySmall}>
                    {teacher.subjects.join(', ')}
                  </Text>
                </View>
                <Text style={styles.selectIcon}>→</Text>
              </TouchableOpacity>
            ))}
          </GlassCard>
        )}

        {/* Classes List */}
        <Text style={[TextStyles.h3, styles.sectionTitle]}>All Classes</Text>

        {classes.map((classItem) => (
          <GlassCard key={classItem.id} style={styles.classCard}>
            <View style={styles.classHeader}>
              <View>
                <Text style={TextStyles.h3}>{classItem.name}</Text>
                <Text style={TextStyles.bodySmall}>
                  {classItem.students} Students
                </Text>
              </View>
              {!classItem.teacher && (
                <View style={styles.warningBadge}>
                  <Text style={styles.warningText}>No Teacher</Text>
                </View>
              )}
            </View>

            {/* Subjects */}
            <View style={styles.subjectsRow}>
              <Text style={TextStyles.bodySmall}>Subjects: </Text>
              {classItem.subjects.map((subject, index) => (
                <View key={index} style={styles.subjectTag}>
                  <Text style={styles.subjectTagText}>{subject}</Text>
                </View>
              ))}
            </View>

            {/* Teacher Assignment */}
            <View style={styles.teacherRow}>
              {classItem.teacher ? (
                <View style={styles.assignedTeacher}>
                  <LinearGradient
                    colors={Gradients.gold.colors}
                    style={styles.miniAvatar}
                  >
                    <Text style={styles.miniAvatarText}>
                      {classItem.teacher.split(' ').map(n => n[0]).join('')}
                    </Text>
                  </LinearGradient>
                  <Text style={TextStyles.body}>{classItem.teacher}</Text>
                </View>
              ) : (
                <Text style={[TextStyles.body, { color: Colors.text.muted }]}>
                  No teacher assigned
                </Text>
              )}

              <TouchableOpacity
                onPress={() => openTeacherPicker(classItem)}
              >
                <LinearGradient
                  colors={classItem.teacher ? Gradients.gold.colors : Gradients.primary.colors}
                  style={styles.assignBtn}
                >
                  <Text style={styles.assignBtnText}>
                    {classItem.teacher ? 'Change' : 'Assign'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ))}

        {/* Add Class Button */}
        <TouchableOpacity style={styles.addClassBtn}>
          <GlassCard style={styles.addClassCard}>
            <Text style={styles.addIcon}>+</Text>
            <Text style={TextStyles.label}>Add New Class</Text>
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
  },
  headerCard: {
    marginBottom: Spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.xxl,
  },
  statItem: {
    alignItems: 'center',
  },
  pickerCard: {
    marginBottom: Spacing.xxl,
    borderWidth: 2,
    borderColor: Colors.emeraldLight,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  closeBtn: {
    color: Colors.text.muted,
    fontSize: 20,
    padding: Spacing.sm,
  },
  teacherOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
  },
  teacherAvatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontWeight: '600',
  },
  teacherInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  selectIcon: {
    color: Colors.emeraldLight,
    fontSize: 18,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  classCard: {
    marginBottom: Spacing.lg,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  warningBadge: {
    backgroundColor: Colors.warning + '30',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  warningText: {
    color: Colors.warning,
    fontSize: 11,
    fontWeight: '600',
  },
  subjectsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  subjectTag: {
    backgroundColor: Colors.glass.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  subjectTagText: {
    color: Colors.emeraldLight,
    fontSize: 11,
  },
  teacherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
  },
  assignedTeacher: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  assignBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  assignBtnText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 13,
  },
  addClassBtn: {
    marginTop: Spacing.md,
  },
  addClassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderStyle: 'dashed',
  },
  addIcon: {
    color: Colors.emeraldLight,
    fontSize: 24,
    fontWeight: '300',
  },
});

export default ClassAssignmentScreen;
