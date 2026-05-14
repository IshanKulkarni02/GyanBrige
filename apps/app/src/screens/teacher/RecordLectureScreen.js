/**
 * Record Lecture Screen
 * Teacher interface for recording and transcribing lectures
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard, AudioRecorder } from '../../components';
import { transcribeAudio, generateNotesFromTranscription } from '../../services/transcription';
import {
  Colors,
  Gradients,
  TextStyles,
  Spacing,
  BorderRadius,
} from '../../theme';

const RecordLectureScreen = ({ navigation, route }) => {
  const { subject } = route.params || {};
  
  // State
  const [recording, setRecording] = useState(null);
  const [transcription, setTranscription] = useState(null);
  const [notes, setNotes] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionProgress, setTranscriptionProgress] = useState(null);
  const [showTranscription, setShowTranscription] = useState(false);

  // Handle recording complete
  const handleRecordingComplete = useCallback((recordingData) => {
    console.log('Recording complete:', recordingData);
    setRecording(recordingData);
  }, []);

  // Handle transcription start
  const handleTranscriptionStart = useCallback(async (data) => {
    setIsTranscribing(true);
    setTranscriptionProgress({ status: 'starting', progress: 0 });

    try {
      const result = await transcribeAudio(data.uri, {
        language: data.language,
        timestamps: true,
        onProgress: (progress) => {
          setTranscriptionProgress(progress);
        },
      });

      if (result.success) {
        setTranscription(result);
        setShowTranscription(true);
        
        // Auto-generate notes
        if (result.segments?.length > 0) {
          const notesResult = await generateNotesFromTranscription(null, {
            style: 'structured',
            includeTimestamps: true,
          });
          
          if (notesResult.success) {
            setNotes(notesResult.notes);
          }
        }
      } else {
        Alert.alert('Transcription Failed', result.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setIsTranscribing(false);
      setTranscriptionProgress(null);
    }
  }, []);

  // Handle error
  const handleError = useCallback((error) => {
    console.error('Recording error:', error);
    Alert.alert('Recording Error', error.message || 'Failed to record audio');
  }, []);

  // Save lecture
  const handleSaveLecture = useCallback(() => {
    Alert.alert(
      'Save Lecture',
      'Save this lecture with transcription and notes?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: () => {
            // In production, save to backend
            Alert.alert('Success', 'Lecture saved successfully!');
            navigation.goBack();
          },
        },
      ]
    );
  }, [navigation, recording, transcription, notes]);

  // Reset
  const handleReset = useCallback(() => {
    setRecording(null);
    setTranscription(null);
    setNotes(null);
    setShowTranscription(false);
  }, []);

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
        {/* Subject Info */}
        {subject && (
          <GlassCard style={styles.subjectCard}>
            <View style={styles.subjectHeader}>
              <Text style={styles.subjectIcon}>{subject.icon}</Text>
              <View style={styles.subjectInfo}>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <Text style={styles.subjectClass}>Recording new lecture</Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* Audio Recorder */}
        <GlassCard style={styles.recorderCard}>
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            onTranscriptionStart={handleTranscriptionStart}
            onError={handleError}
            maxDuration={7200} // 2 hours max
          />
        </GlassCard>

        {/* Transcription Progress */}
        {isTranscribing && (
          <GlassCard style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <ActivityIndicator color={Colors.emeraldLight} />
              <Text style={styles.progressTitle}>
                {transcriptionProgress?.status === 'uploading' && 'Uploading audio...'}
                {transcriptionProgress?.status === 'processing' && 'Transcribing...'}
                {transcriptionProgress?.status === 'preparing' && 'Preparing...'}
              </Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  { width: `${transcriptionProgress?.progress || 0}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {transcriptionProgress?.progress || 0}% complete
            </Text>
          </GlassCard>
        )}

        {/* Transcription Result */}
        {showTranscription && transcription && (
          <GlassCard style={styles.transcriptionCard}>
            <View style={styles.transcriptionHeader}>
              <Text style={styles.transcriptionTitle}>📝 Transcription</Text>
              <View style={styles.transcriptionMeta}>
                <View style={styles.metaBadge}>
                  <Text style={styles.metaBadgeText}>
                    {transcription.language?.toUpperCase() || 'AUTO'}
                  </Text>
                </View>
                <Text style={styles.metaText}>
                  {transcription.segments?.length || 0} segments
                </Text>
              </View>
            </View>

            <ScrollView 
              style={styles.transcriptionScroll}
              nestedScrollEnabled
            >
              <Text style={styles.transcriptionText}>
                {transcription.text}
              </Text>
            </ScrollView>

            {/* Segments */}
            {transcription.segments?.length > 0 && (
              <View style={styles.segmentsContainer}>
                <Text style={styles.segmentsTitle}>Timestamped Segments</Text>
                {transcription.segments.slice(0, 5).map((segment, index) => (
                  <View key={index} style={styles.segment}>
                    <Text style={styles.segmentTime}>
                      {formatTime(segment.start)}
                    </Text>
                    <Text style={styles.segmentText} numberOfLines={2}>
                      {segment.text}
                    </Text>
                  </View>
                ))}
                {transcription.segments.length > 5 && (
                  <Text style={styles.moreSegments}>
                    +{transcription.segments.length - 5} more segments
                  </Text>
                )}
              </View>
            )}
          </GlassCard>
        )}

        {/* Generated Notes */}
        {notes && (
          <GlassCard style={styles.notesCard}>
            <Text style={styles.notesTitle}>🧠 AI Generated Notes</Text>
            
            {notes.summary && (
              <View style={styles.noteSection}>
                <Text style={styles.noteSectionTitle}>Summary</Text>
                <Text style={styles.noteSectionText}>{notes.summary}</Text>
              </View>
            )}

            {notes.keyPoints?.length > 0 && (
              <View style={styles.noteSection}>
                <Text style={styles.noteSectionTitle}>Key Points</Text>
                {notes.keyPoints.map((point, index) => (
                  <View key={index} style={styles.keyPoint}>
                    <Text style={styles.keyPointBullet}>•</Text>
                    <Text style={styles.keyPointText}>{point}</Text>
                  </View>
                ))}
              </View>
            )}
          </GlassCard>
        )}

        {/* Actions */}
        {transcription && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleReset}>
              <Text style={styles.secondaryBtnText}>Record Again</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveLecture}>
              <LinearGradient
                colors={Gradients.primary.colors}
                style={styles.primaryBtnGradient}
              >
                <Text style={styles.primaryBtnText}>Save Lecture</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// Helper function
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  // Subject card
  subjectCard: {
    marginBottom: Spacing.lg,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectIcon: {
    fontSize: 32,
    marginRight: Spacing.md,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  subjectClass: {
    fontSize: 14,
    color: Colors.text.muted,
    marginTop: 2,
  },

  // Recorder card
  recorderCard: {
    marginBottom: Spacing.lg,
    padding: 0,
    overflow: 'hidden',
  },

  // Progress card
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
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: Spacing.md,
  },
  progressBarContainer: {
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

  // Transcription card
  transcriptionCard: {
    marginBottom: Spacing.lg,
  },
  transcriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  transcriptionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  transcriptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metaBadge: {
    backgroundColor: Colors.emerald,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  metaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  metaText: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  transcriptionScroll: {
    maxHeight: 200,
    marginBottom: Spacing.md,
  },
  transcriptionText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 22,
  },

  // Segments
  segmentsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.glass.border,
    paddingTop: Spacing.md,
  },
  segmentsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  segmentTime: {
    fontSize: 12,
    color: Colors.emeraldLight,
    fontWeight: '600',
    width: 50,
  },
  segmentText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.muted,
  },
  moreSegments: {
    fontSize: 12,
    color: Colors.text.muted,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  // Notes card
  notesCard: {
    marginBottom: Spacing.lg,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  noteSection: {
    marginBottom: Spacing.md,
  },
  noteSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.emeraldLight,
    marginBottom: Spacing.xs,
  },
  noteSectionText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  keyPoint: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  keyPointBullet: {
    color: Colors.emeraldLight,
    fontSize: 14,
    marginRight: Spacing.sm,
  },
  keyPointText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  primaryBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default RecordLectureScreen;
