/**
 * Lecture Player Screen - Split View
 * Top: Video Player | Bottom: Scrollable AI Generated Notes
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard, VideoPlayer } from '../../components';
import {
  Colors,
  Gradients,
  TextStyles,
  Spacing,
  BorderRadius,
} from '../../theme';
import NetworkConfig from '../../config/network';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const VIDEO_HEIGHT = SCREEN_HEIGHT * 0.35;

// AI Generated Notes mock data
const AI_NOTES = [
  {
    id: '1',
    timestamp: '00:00',
    type: 'intro',
    title: 'Introduction',
    content: 'This lecture introduces the fundamental concepts that form the foundation of the subject. Understanding these basics is crucial for advanced topics.',
    keyPoints: ['Core definitions', 'Historical context', 'Why this matters'],
  },
  {
    id: '2',
    timestamp: '05:30',
    type: 'concept',
    title: 'Key Concept: Fundamentals',
    content: 'The fundamental theorem establishes a relationship between differentiation and integration. This is one of the most important results in mathematics.',
    keyPoints: ['Theorem statement', 'Proof outline', 'Applications'],
    formula: 'F(b) - F(a) = ∫[a,b] f(x)dx',
  },
  {
    id: '3',
    timestamp: '12:45',
    type: 'example',
    title: 'Worked Example',
    content: 'Let\'s work through a practical example to solidify our understanding. We\'ll calculate the area under a curve using the techniques discussed.',
    keyPoints: ['Step 1: Set up integral', 'Step 2: Find antiderivative', 'Step 3: Evaluate'],
  },
  {
    id: '4',
    timestamp: '20:00',
    type: 'important',
    title: '⚠️ Important Note',
    content: 'Pay special attention to the boundary conditions. Many students make mistakes here by forgetting to check the limits of integration.',
    keyPoints: ['Common mistakes to avoid', 'Verification techniques'],
  },
  {
    id: '5',
    timestamp: '28:15',
    type: 'concept',
    title: 'Advanced Application',
    content: 'This concept extends to multiple dimensions. The generalization allows us to compute volumes and surface areas of complex shapes.',
    keyPoints: ['Double integrals', 'Triple integrals', 'Change of variables'],
  },
  {
    id: '6',
    timestamp: '35:00',
    type: 'practice',
    title: 'Practice Problems',
    content: 'Try these problems to test your understanding. Solutions will be discussed in the next lecture.',
    keyPoints: ['Problem 1: Basic application', 'Problem 2: Intermediate', 'Problem 3: Challenge'],
  },
  {
    id: '7',
    timestamp: '42:00',
    type: 'summary',
    title: 'Summary & Key Takeaways',
    content: 'In this lecture, we covered the fundamental theorem and its applications. Make sure to review the worked examples before proceeding.',
    keyPoints: ['Review theorem', 'Practice examples', 'Prepare for quiz'],
  },
];

const LecturePlayerScreen = ({ route }) => {
  const { lecture, subject } = route.params;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeNoteId, setActiveNoteId] = useState('1');
  const [showTranscript, setShowTranscript] = useState(false);
  const scrollViewRef = useRef(null);
  const playerRef = useRef(null);

  // Get subject accent color
  const accentColor = subject.color?.[0] || Colors.emeraldLight;

  // Handle video progress updates
  const handleProgress = useCallback((data) => {
    setCurrentTime(data.position || 0);
    setDuration(data.duration || 0);
    
    // Auto-highlight note based on current time
    const currentSeconds = (data.position || 0) / 1000;
    const activeNote = AI_NOTES.reduce((prev, note) => {
      const [mins, secs] = note.timestamp.split(':').map(Number);
      const noteTime = mins * 60 + secs;
      if (noteTime <= currentSeconds) return note;
      return prev;
    }, AI_NOTES[0]);
    
    if (activeNote && activeNote.id !== activeNoteId) {
      setActiveNoteId(activeNote.id);
    }
  }, [activeNoteId]);

  const getNoteTypeIcon = (type) => {
    switch (type) {
      case 'intro': return '🎬';
      case 'concept': return '💡';
      case 'example': return '📝';
      case 'important': return '⚠️';
      case 'practice': return '🎯';
      case 'summary': return '📋';
      default: return '📖';
    }
  };

  const getNoteTypeColor = (type) => {
    switch (type) {
      case 'intro': return Colors.info;
      case 'concept': return Colors.emeraldLight;
      case 'example': return Colors.gold;
      case 'important': return Colors.coral;
      case 'practice': return '#8b5cf6';
      case 'summary': return Colors.success;
      default: return Colors.text.muted;
    }
  };

  // Seek to timestamp when note is tapped
  const seekToTimestamp = useCallback(async (timestamp, noteId) => {
    const [mins, secs] = timestamp.split(':').map(Number);
    const timeInMs = (mins * 60 + secs) * 1000;
    
    // Seek the video player
    if (playerRef.current) {
      await playerRef.current.seekTo(timeInMs);
    }
    
    // Update active note
    setActiveNoteId(noteId);
  }, []);

  // Handle video completion
  const handleComplete = useCallback(() => {
    console.log('Lecture completed!');
    // Could mark as complete in backend
  }, []);

  // Build video source - supports HLS (.m3u8) or direct URLs
  const getVideoSource = () => {
    // Check if lecture has a streaming URL
    if (lecture.streamUrl) {
      return { uri: lecture.streamUrl };
    }
    // Fallback to HLS endpoint (local media server via network config)
    if (lecture.videoId) {
      return { uri: `${NetworkConfig.getMediaUrl()}/media/${lecture.videoId}/playlist.m3u8` };
    }
    // Demo: Big Buck Bunny HLS stream for testing
    return { uri: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' };
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Gradients.background.colors}
        start={Gradients.background.start}
        end={Gradients.background.end}
        style={StyleSheet.absoluteFill}
      />

      {/* ===== TOP HALF: Video Player ===== */}
      <View style={styles.videoSection}>
        <VideoPlayer
          ref={playerRef}
          source={getVideoSource()}
          title={lecture.title}
          subtitle={subject.name}
          accentColor={accentColor}
          onProgress={handleProgress}
          onComplete={handleComplete}
          onError={(error) => console.error('Video error:', error)}
          style={styles.videoPlayer}
        />
      </View>

      {/* ===== BOTTOM HALF: AI Generated Notes ===== */}
      <View style={styles.notesSection}>
        {/* Notes Header */}
        <View style={styles.notesHeader}>
          <View style={styles.notesHeaderLeft}>
            <Text style={styles.notesHeaderIcon}>🧠</Text>
            <View>
              <Text style={TextStyles.h3}>AI Generated Notes</Text>
              <Text style={styles.notesSubtitle}>Auto-generated from lecture content</Text>
            </View>
          </View>
          <View style={styles.notesToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, !showTranscript && styles.toggleBtnActive]}
              onPress={() => setShowTranscript(false)}
            >
              <Text style={[styles.toggleText, !showTranscript && styles.toggleTextActive]}>Notes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, showTranscript && styles.toggleBtnActive]}
              onPress={() => setShowTranscript(true)}
            >
              <Text style={[styles.toggleText, showTranscript && styles.toggleTextActive]}>Transcript</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notes Content */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.notesScrollView}
          contentContainerStyle={styles.notesContent}
          showsVerticalScrollIndicator={false}
        >
          {!showTranscript ? (
            // AI Notes View
            AI_NOTES.map((note, index) => (
              <TouchableOpacity
                key={note.id}
                onPress={() => seekToTimestamp(note.timestamp, note.id)}
                activeOpacity={0.8}
              >
                <GlassCard style={[
                  styles.noteCard,
                  activeNoteId === note.id && styles.noteCardActive
                ]}>
                  {/* Note Header */}
                  <View style={styles.noteHeader}>
                    <TouchableOpacity 
                      style={[styles.timestampBtn, { backgroundColor: getNoteTypeColor(note.type) + '20' }]}
                      onPress={() => seekToTimestamp(note.timestamp, note.id)}
                    >
                      <Text style={[styles.timestampText, { color: getNoteTypeColor(note.type) }]}>
                        {note.timestamp}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.noteTypeContainer}>
                      <Text style={styles.noteTypeIcon}>{getNoteTypeIcon(note.type)}</Text>
                      <Text style={[styles.noteType, { color: getNoteTypeColor(note.type) }]}>
                        {note.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Note Title */}
                  <Text style={styles.noteTitle}>{note.title}</Text>

                  {/* Note Content */}
                  <Text style={styles.noteContent}>{note.content}</Text>

                  {/* Formula (if present) */}
                  {note.formula && (
                    <View style={styles.formulaBox}>
                      <Text style={styles.formulaText}>{note.formula}</Text>
                    </View>
                  )}

                  {/* Key Points */}
                  <View style={styles.keyPointsContainer}>
                    <Text style={styles.keyPointsTitle}>📌 Key Points</Text>
                    {note.keyPoints.map((point, idx) => (
                      <View key={idx} style={styles.keyPoint}>
                        <View style={[styles.keyPointDot, { backgroundColor: getNoteTypeColor(note.type) }]} />
                        <Text style={styles.keyPointText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))
          ) : (
            // Transcript View
            <GlassCard style={styles.transcriptCard}>
              <Text style={styles.transcriptText}>
                Welcome to today's lecture on {subject.name}. We'll be covering {lecture.title.toLowerCase()}.{"\n\n"}
                Let's begin with the fundamental concepts that you'll need to understand before we dive deeper...{"\n\n"}
                The key theorem we'll explore states that for any continuous function f on a closed interval [a,b], 
                there exists an antiderivative F such that the integral from a to b equals F(b) minus F(a).{"\n\n"}
                This is incredibly powerful because it connects two seemingly different operations: finding slopes and finding areas.{"\n\n"}
                Now let's look at a practical example to see how this works in practice...
              </Text>
            </GlassCard>
          )}

          {/* Complete Button */}
          {!lecture.completed && (
            <TouchableOpacity style={styles.completeBtn}>
              <LinearGradient
                colors={Gradients.primary.colors}
                style={styles.completeBtnGradient}
              >
                <Text style={styles.completeBtnText}>✓ Mark as Complete</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.dark,
  },

  // ===== VIDEO SECTION =====
  videoSection: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  videoPlayer: {
    borderRadius: 0,
  },

  // ===== NOTES SECTION =====
  notesSection: {
    flex: 1,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
    backgroundColor: Colors.glass.background,
  },
  notesHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notesHeaderIcon: {
    fontSize: 24,
  },
  notesSubtitle: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  notesToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.glass.background,
    borderRadius: BorderRadius.sm,
    padding: 2,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  toggleBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  toggleBtnActive: {
    backgroundColor: Colors.emerald,
  },
  toggleText: {
    fontSize: 12,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: Colors.white,
  },
  notesScrollView: {
    flex: 1,
  },
  notesContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  noteCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  noteCardActive: {
    borderColor: Colors.emeraldLight,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  timestampBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  timestampText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noteTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteTypeIcon: {
    fontSize: 12,
  },
  noteType: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  noteContent: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  formulaBox: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.emeraldLight,
  },
  formulaText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: Colors.emeraldLight,
    textAlign: 'center',
  },
  keyPointsContainer: {
    backgroundColor: Colors.glass.background,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
  },
  keyPointsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  keyPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  keyPointDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    marginRight: Spacing.sm,
  },
  keyPointText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
  },
  transcriptCard: {
    padding: Spacing.lg,
  },
  transcriptText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  completeBtn: {
    marginTop: Spacing.lg,
  },
  completeBtnGradient: {
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  completeBtnText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default LecturePlayerScreen;
