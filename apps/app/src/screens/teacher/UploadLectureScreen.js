/**
 * Upload Lecture Screen
 * Form for teachers to upload video/audio lectures
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { GlassCard } from '../../components';
import {
  Colors,
  Gradients,
  TextStyles,
  GlassStyles,
  Spacing,
  BorderRadius,
} from '../../theme';

// Mock subjects data
const SUBJECTS = [
  { id: '1', name: 'Mathematics', icon: '📐', color: ['#059669', '#34d399'] },
  { id: '2', name: 'Physics', icon: '⚡', color: ['#8b5cf6', '#a78bfa'] },
  { id: '3', name: 'Chemistry', icon: '🧪', color: ['#f59e0b', '#fbbf24'] },
  { id: '4', name: 'Biology', icon: '🧬', color: ['#10b981', '#6ee7b7'] },
  { id: '5', name: 'English', icon: '📚', color: ['#3b82f6', '#60a5fa'] },
  { id: '6', name: 'History', icon: '🏛️', color: ['#d4a574', '#e5c9a8'] },
];

const UploadLectureScreen = ({ navigation }) => {
  // Form state
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [lectureTitle, setLectureTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [lectureType, setLectureType] = useState('video'); // video, audio
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Pick video file
  const pickVideo = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant media library access to upload videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName || `video_${Date.now()}.mp4`,
          type: 'video/mp4',
          size: asset.fileSize,
          duration: asset.duration,
        });
        setLectureType('video');
      }
    } catch (error) {
      console.error('Video picker error:', error);
      Alert.alert('Error', 'Failed to pick video file');
    }
  };

  // Pick audio file
  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'audio/mpeg',
          size: asset.size,
        });
        setLectureType('audio');
      }
    } catch (error) {
      console.error('Audio picker error:', error);
      Alert.alert('Error', 'Failed to pick audio file');
    }
  };

  // Record new lecture
  const recordLecture = () => {
    navigation.navigate('RecordLecture', { subject: selectedSubject });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  // Format duration
  const formatDuration = (ms) => {
    if (!ms) return '';
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Upload lecture
  const handleUpload = async () => {
    // Validation
    if (!selectedSubject) {
      Alert.alert('Error', 'Please select a subject');
      return;
    }
    if (!lectureTitle.trim()) {
      Alert.alert('Error', 'Please enter a lecture title');
      return;
    }
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a video or audio file');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      // In production, upload to server here
      await new Promise((resolve) => setTimeout(resolve, 3000));

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Success
      Alert.alert(
        'Upload Successful! 🎉',
        `"${lectureTitle}" has been uploaded to ${selectedSubject.name}`,
        [
          {
            text: 'Upload Another',
            onPress: resetForm,
          },
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Upload Failed', error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setSelectedSubject(null);
    setLectureTitle('');
    setDescription('');
    setSelectedFile(null);
    setUploadProgress(0);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Gradients.background.colors}
        start={Gradients.background.start}
        end={Gradients.background.end}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerIcon}>📤</Text>
          <View>
            <Text style={TextStyles.h2}>Upload Lecture</Text>
            <Text style={TextStyles.body}>Share knowledge with your students</Text>
          </View>
        </View>

        {/* Subject Selection */}
        <Text style={styles.sectionTitle}>Select Subject</Text>
        <View style={styles.subjectGrid}>
          {SUBJECTS.map((subject) => (
            <TouchableOpacity
              key={subject.id}
              style={styles.subjectItem}
              onPress={() => setSelectedSubject(subject)}
              activeOpacity={0.8}
            >
              <GlassCard
                style={[
                  styles.subjectCard,
                  selectedSubject?.id === subject.id && styles.subjectCardSelected,
                ]}
              >
                <LinearGradient
                  colors={subject.color}
                  style={styles.subjectIconBg}
                >
                  <Text style={styles.subjectIcon}>{subject.icon}</Text>
                </LinearGradient>
                <Text style={styles.subjectName} numberOfLines={1}>
                  {subject.name}
                </Text>
                {selectedSubject?.id === subject.id && (
                  <View style={styles.checkmark}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                )}
              </GlassCard>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lecture Details */}
        <Text style={styles.sectionTitle}>Lecture Details</Text>
        <GlassCard style={styles.formCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={[GlassStyles.input, styles.input]}
              placeholder="e.g., Introduction to Calculus"
              placeholderTextColor={Colors.text.muted}
              value={lectureTitle}
              onChangeText={setLectureTitle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <TextInput
              style={[GlassStyles.input, styles.input, styles.textArea]}
              placeholder="Brief description of the lecture content..."
              placeholderTextColor={Colors.text.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </GlassCard>

        {/* File Upload */}
        <Text style={styles.sectionTitle}>Upload Media</Text>
        <GlassCard style={styles.uploadCard}>
          {!selectedFile ? (
            <>
              <View style={styles.uploadOptions}>
                <TouchableOpacity style={styles.uploadOption} onPress={pickVideo}>
                  <LinearGradient
                    colors={['#8b5cf6', '#6366f1']}
                    style={styles.uploadOptionIcon}
                  >
                    <Text style={styles.uploadOptionEmoji}>🎬</Text>
                  </LinearGradient>
                  <Text style={styles.uploadOptionTitle}>Video</Text>
                  <Text style={styles.uploadOptionDesc}>MP4, MOV, AVI</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.uploadOption} onPress={pickAudio}>
                  <LinearGradient
                    colors={['#f59e0b', '#fbbf24']}
                    style={styles.uploadOptionIcon}
                  >
                    <Text style={styles.uploadOptionEmoji}>🎵</Text>
                  </LinearGradient>
                  <Text style={styles.uploadOptionTitle}>Audio</Text>
                  <Text style={styles.uploadOptionDesc}>MP3, WAV, M4A</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.uploadOption} onPress={recordLecture}>
                  <LinearGradient
                    colors={[Colors.coral, '#c0392b']}
                    style={styles.uploadOptionIcon}
                  >
                    <Text style={styles.uploadOptionEmoji}>🎙️</Text>
                  </LinearGradient>
                  <Text style={styles.uploadOptionTitle}>Record</Text>
                  <Text style={styles.uploadOptionDesc}>New Audio</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.uploadHint}>
                Max file size: 500MB • Supported formats: MP4, MOV, MP3, WAV
              </Text>
            </>
          ) : (
            <View style={styles.selectedFile}>
              <View style={styles.filePreview}>
                <LinearGradient
                  colors={lectureType === 'video' ? ['#8b5cf6', '#6366f1'] : ['#f59e0b', '#fbbf24']}
                  style={styles.fileIcon}
                >
                  <Text style={styles.fileEmoji}>
                    {lectureType === 'video' ? '🎬' : '🎵'}
                  </Text>
                </LinearGradient>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {formatFileSize(selectedFile.size)}
                    {selectedFile.duration && ` • ${formatDuration(selectedFile.duration)}`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeFile}
                  onPress={() => setSelectedFile(null)}
                >
                  <Text style={styles.removeFileText}>✕</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.changeFileBtn}
                onPress={() => setSelectedFile(null)}
              >
                <Text style={styles.changeFileBtnText}>Change File</Text>
              </TouchableOpacity>
            </View>
          )}
        </GlassCard>

        {/* Upload Progress */}
        {isUploading && (
          <GlassCard style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <ActivityIndicator color={Colors.emeraldLight} />
              <Text style={styles.progressTitle}>Uploading...</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{uploadProgress}% complete</Text>
          </GlassCard>
        )}

        {/* Upload Button */}
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={handleUpload}
          disabled={isUploading}
        >
          <LinearGradient
            colors={isUploading ? [Colors.text.muted, Colors.text.muted] : Gradients.primary.colors}
            style={styles.uploadBtnGradient}
          >
            {isUploading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Text style={styles.uploadBtnIcon}>☁️</Text>
                <Text style={styles.uploadBtnText}>Upload Lecture</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.dark,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  headerIcon: {
    fontSize: 36,
    marginRight: Spacing.md,
  },

  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },

  // Subject grid
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  subjectItem: {
    width: '33.33%',
    padding: Spacing.xs,
  },
  subjectCard: {
    alignItems: 'center',
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  subjectCardSelected: {
    borderColor: Colors.emeraldLight,
  },
  subjectIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  subjectIcon: {
    fontSize: 22,
  },
  subjectName: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.emerald,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },

  // Form
  formCard: {
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  input: {
    fontSize: 15,
  },
  textArea: {
    height: 80,
    paddingTop: Spacing.md,
  },

  // Upload card
  uploadCard: {
    marginBottom: Spacing.lg,
  },
  uploadOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.md,
  },
  uploadOption: {
    alignItems: 'center',
    flex: 1,
  },
  uploadOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  uploadOptionEmoji: {
    fontSize: 26,
  },
  uploadOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  uploadOptionDesc: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  uploadHint: {
    fontSize: 12,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  // Selected file
  selectedFile: {
    alignItems: 'center',
  },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.md,
  },
  fileIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileEmoji: {
    fontSize: 24,
  },
  fileInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  fileMeta: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  removeFile: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeFileText: {
    color: Colors.error,
    fontSize: 14,
    fontWeight: '600',
  },
  changeFileBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  changeFileBtnText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },

  // Progress
  progressCard: {
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressTitle: {
    fontSize: 14,
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.emeraldLight,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: Spacing.sm,
  },

  // Upload button
  uploadBtn: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  uploadBtnGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: Spacing.sm,
  },
  uploadBtnIcon: {
    fontSize: 20,
  },
  uploadBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default UploadLectureScreen;
