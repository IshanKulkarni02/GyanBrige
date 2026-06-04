/**
 * Subject Management Screen - Teacher
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../components';
import {
  Colors,
  Gradients,
  TextStyles,
  GlassStyles,
  ButtonStyles,
  Spacing,
  BorderRadius,
  LayoutStyles,
} from '../../theme';

// Mock lectures data
const MOCK_LECTURES = [
  { id: '1', title: 'Introduction to Calculus', duration: '45 min', views: 128, uploaded: '2 days ago' },
  { id: '2', title: 'Derivatives Explained', duration: '52 min', views: 95, uploaded: '5 days ago' },
  { id: '3', title: 'Integration Basics', duration: '48 min', views: 76, uploaded: '1 week ago' },
  { id: '4', title: 'Applications of Calculus', duration: '55 min', views: 64, uploaded: '2 weeks ago' },
];

const SubjectManagementScreen = ({ route, navigation }) => {
  const subject = route.params?.subject || { name: 'Mathematics', students: 45 };
  const [lectures, setLectures] = useState(MOCK_LECTURES);
  const [showUpload, setShowUpload] = useState(false);
  const [newLecture, setNewLecture] = useState({ title: '', description: '' });

  const handleUpload = () => {
    if (!newLecture.title.trim()) {
      Alert.alert('Error', 'Please enter a lecture title');
      return;
    }

    const lecture = {
      id: String(lectures.length + 1),
      title: newLecture.title,
      duration: 'Processing...',
      views: 0,
      uploaded: 'Just now',
    };

    setLectures([lecture, ...lectures]);
    setNewLecture({ title: '', description: '' });
    setShowUpload(false);
    Alert.alert('Success', 'Lecture uploaded successfully!');
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
        {/* Subject Header */}
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={TextStyles.h2}>{subject.name}</Text>
              <Text style={TextStyles.body}>{subject.students} Students Enrolled</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('AttendanceUpload', { subject })}
            >
              <LinearGradient
                colors={Gradients.gold.colors}
                style={styles.attendanceBtn}
              >
                <Text style={styles.attendanceBtnText}>📋 Attendance</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Subject Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={TextStyles.statValue}>{lectures.length}</Text>
              <Text style={TextStyles.bodySmall}>Lectures</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={TextStyles.statValue}>363</Text>
              <Text style={TextStyles.bodySmall}>Total Views</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[TextStyles.statValue, { color: Colors.emeraldLight }]}>92%</Text>
              <Text style={TextStyles.bodySmall}>Completion</Text>
            </View>
          </View>
        </GlassCard>

        {/* Upload Section */}
        {showUpload ? (
          <GlassCard style={styles.uploadCard}>
            <Text style={[TextStyles.h3, styles.uploadTitle]}>Upload New Lecture</Text>
            
            <View style={styles.inputGroup}>
              <Text style={TextStyles.label}>Lecture Title</Text>
              <TextInput
                style={[GlassStyles.input, styles.input]}
                placeholder="Enter lecture title"
                placeholderTextColor={Colors.text.muted}
                value={newLecture.title}
                onChangeText={(text) => setNewLecture({ ...newLecture, title: text })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={TextStyles.label}>Description</Text>
              <TextInput
                style={[GlassStyles.input, styles.input, styles.textArea]}
                placeholder="Enter lecture description"
                placeholderTextColor={Colors.text.muted}
                value={newLecture.description}
                onChangeText={(text) => setNewLecture({ ...newLecture, description: text })}
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity style={styles.filePickerBtn}>
              <GlassCard style={styles.filePicker}>
                <Text style={styles.filePickerIcon}>📁</Text>
                <Text style={TextStyles.body}>Tap to select video file</Text>
                <Text style={TextStyles.bodySmall}>MP4, MOV up to 2GB</Text>
              </GlassCard>
            </TouchableOpacity>

            <View style={styles.uploadActions}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => setShowUpload(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleUpload}>
                <LinearGradient
                  colors={Gradients.primary.colors}
                  style={ButtonStyles.primary}
                >
                  <Text style={ButtonStyles.primaryText}>Upload Lecture</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ) : (
          <TouchableOpacity onPress={() => setShowUpload(true)}>
            <LinearGradient
              colors={Gradients.primary.colors}
              style={[ButtonStyles.primary, styles.uploadTrigger]}
            >
              <Text style={ButtonStyles.primaryText}>+ Upload New Lecture</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Lectures List */}
        <Text style={[TextStyles.h3, styles.sectionTitle]}>Uploaded Lectures</Text>
        
        {lectures.map((lecture) => (
          <GlassCard key={lecture.id} style={styles.lectureCard}>
            <View style={styles.lectureHeader}>
              <View style={styles.lectureIcon}>
                <Text style={styles.lectureIconText}>🎬</Text>
              </View>
              <View style={styles.lectureInfo}>
                <Text style={TextStyles.label}>{lecture.title}</Text>
                <Text style={TextStyles.bodySmall}>
                  {lecture.duration} • {lecture.views} views • {lecture.uploaded}
                </Text>
              </View>
            </View>

            <View style={styles.lectureActions}>
              <TouchableOpacity style={styles.lectureActionBtn}>
                <Text style={styles.lectureActionIcon}>✏️</Text>
                <Text style={TextStyles.bodySmall}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.lectureActionBtn}>
                <Text style={styles.lectureActionIcon}>📊</Text>
                <Text style={TextStyles.bodySmall}>Analytics</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.lectureActionBtn}>
                <Text style={[styles.lectureActionIcon, { color: Colors.danger }]}>🗑️</Text>
                <Text style={[TextStyles.bodySmall, { color: Colors.danger }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        ))}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xxl,
  },
  attendanceBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  attendanceBtnText: {
    color: Colors.white,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  uploadCard: {
    marginBottom: Spacing.xxl,
  },
  uploadTitle: {
    marginBottom: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  input: {
    marginTop: Spacing.sm,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  filePickerBtn: {
    marginBottom: Spacing.lg,
  },
  filePicker: {
    alignItems: 'center',
    padding: Spacing.xxl,
    borderStyle: 'dashed',
  },
  filePickerIcon: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  uploadActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  cancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  cancelBtnText: {
    color: Colors.text.secondary,
    fontSize: 15,
    fontWeight: '500',
  },
  uploadTrigger: {
    marginBottom: Spacing.xxl,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  lectureCard: {
    marginBottom: Spacing.md,
  },
  lectureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  lectureIcon: {
    width: 50,
    height: 50,
    backgroundColor: Colors.glass.background,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lectureIconText: {
    fontSize: 24,
  },
  lectureInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  lectureActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
    paddingTop: Spacing.md,
  },
  lectureActionBtn: {
    alignItems: 'center',
  },
  lectureActionIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
});

export default SubjectManagementScreen;
