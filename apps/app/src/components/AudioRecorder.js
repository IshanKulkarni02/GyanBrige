/**
 * AudioRecorder Component
 * Records audio lectures for teachers with waveform visualization
 * Supports saving as WAV format for transcription
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import {
  Colors,
  Gradients,
  Spacing,
  BorderRadius,
  TextStyles,
} from '../theme';

// Recording states
const RecordingState = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused',
  STOPPED: 'stopped',
};

// Language options for transcription
const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', flag: '🇮🇳' },
  { code: 'mixed', label: 'Mixed', flag: '🌐' },
];

const AudioRecorder = ({
  onRecordingComplete,
  onTranscriptionStart,
  onTranscriptionComplete,
  onError,
  maxDuration = 3600, // 1 hour max
  style,
}) => {
  // Recording state
  const [recordingState, setRecordingState] = useState(RecordingState.IDLE);
  const [duration, setDuration] = useState(0);
  const [audioLevels, setAudioLevels] = useState(new Array(30).fill(0));
  const [selectedLanguage, setSelectedLanguage] = useState('mixed');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [recordingUri, setRecordingUri] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Refs
  const recordingRef = useRef(null);
  const timerRef = useRef(null);
  const levelIntervalRef = useRef(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
      if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);
    };
  }, []);

  // Pulse animation for recording indicator
  useEffect(() => {
    if (recordingState === RecordingState.RECORDING) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recordingState]);

  // Request permissions
  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant microphone permission to record lectures.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Permission error:', error);
      return false;
    }
  };

  // Configure audio mode
  const configureAudio = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  };

  // Start recording
  const startRecording = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      await configureAudio();

      // Recording options for high quality audio
      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000, // Optimal for speech recognition
          numberOfChannels: 1, // Mono for speech
          bitRate: 256000,
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(recordingOptions);
      
      // Set up metering for audio levels
      recording.setOnRecordingStatusUpdate(onRecordingStatusUpdate);
      recording.setProgressUpdateInterval(100);

      await recording.startAsync();
      recordingRef.current = recording;
      setRecordingState(RecordingState.RECORDING);
      setDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= maxDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);

      // Simulate audio levels (expo-av doesn't provide real metering on all platforms)
      levelIntervalRef.current = setInterval(() => {
        setAudioLevels((prev) => {
          const newLevels = [...prev.slice(1)];
          // Generate realistic-looking audio level
          const level = Math.random() * 0.6 + (recordingState === RecordingState.RECORDING ? 0.2 : 0);
          newLevels.push(level);
          return newLevels;
        });
      }, 100);

    } catch (error) {
      console.error('Failed to start recording:', error);
      onError?.(error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  // Recording status update handler
  const onRecordingStatusUpdate = (status) => {
    if (status.metering) {
      // Normalize metering value (-160 to 0 dB) to 0-1 range
      const normalizedLevel = (status.metering + 160) / 160;
      setAudioLevels((prev) => {
        const newLevels = [...prev.slice(1), Math.max(0, Math.min(1, normalizedLevel))];
        return newLevels;
      });
    }
  };

  // Pause recording
  const pauseRecording = async () => {
    if (!recordingRef.current) return;
    
    try {
      await recordingRef.current.pauseAsync();
      setRecordingState(RecordingState.PAUSED);
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (error) {
      console.error('Failed to pause recording:', error);
    }
  };

  // Resume recording
  const resumeRecording = async () => {
    if (!recordingRef.current) return;
    
    try {
      await recordingRef.current.startAsync();
      setRecordingState(RecordingState.RECORDING);
      
      // Resume timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to resume recording:', error);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      if (timerRef.current) clearInterval(timerRef.current);
      if (levelIntervalRef.current) clearInterval(levelIntervalRef.current);

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      setRecordingUri(uri);
      setRecordingState(RecordingState.STOPPED);
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      onRecordingComplete?.({
        uri,
        duration,
        fileSize: fileInfo.size,
        language: selectedLanguage,
      });

      recordingRef.current = null;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      onError?.(error);
    }
  };

  // Discard recording
  const discardRecording = async () => {
    Alert.alert(
      'Discard Recording?',
      'Are you sure you want to discard this recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            if (recordingUri) {
              try {
                await FileSystem.deleteAsync(recordingUri);
              } catch (error) {
                console.error('Failed to delete recording:', error);
              }
            }
            resetRecorder();
          },
        },
      ]
    );
  };

  // Reset recorder
  const resetRecorder = () => {
    setRecordingState(RecordingState.IDLE);
    setDuration(0);
    setRecordingUri(null);
    setAudioLevels(new Array(30).fill(0));
  };

  // Format duration
  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Render glass background
  const renderGlass = (children, additionalStyle) => {
    if (Platform.OS === 'ios') {
      return (
        <BlurView intensity={30} tint="dark" style={[styles.glass, additionalStyle]}>
          {children}
        </BlurView>
      );
    }
    return (
      <View style={[styles.glass, styles.glassFallback, additionalStyle]}>
        {children}
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🎙️ Record Lecture</Text>
        
        {/* Language Selector */}
        <TouchableOpacity
          style={styles.languageBtn}
          onPress={() => setShowLanguageMenu(!showLanguageMenu)}
        >
          {renderGlass(
            <View style={styles.languageBtnContent}>
              <Text style={styles.languageFlag}>
                {LANGUAGES.find(l => l.code === selectedLanguage)?.flag}
              </Text>
              <Text style={styles.languageLabel}>
                {LANGUAGES.find(l => l.code === selectedLanguage)?.label}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </View>,
            styles.languageBtnGlass
          )}
        </TouchableOpacity>
      </View>

      {/* Language Menu */}
      {showLanguageMenu && (
        <View style={styles.languageMenu}>
          {renderGlass(
            <View style={styles.languageMenuContent}>
              <Text style={styles.languageMenuTitle}>Transcription Language</Text>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.languageOption,
                    selectedLanguage === lang.code && styles.languageOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedLanguage(lang.code);
                    setShowLanguageMenu(false);
                  }}
                >
                  <Text style={styles.languageOptionFlag}>{lang.flag}</Text>
                  <Text style={[
                    styles.languageOptionLabel,
                    selectedLanguage === lang.code && styles.languageOptionLabelActive,
                  ]}>
                    {lang.label}
                  </Text>
                  {selectedLanguage === lang.code && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>,
            styles.languageMenuGlass
          )}
        </View>
      )}

      {/* Waveform Visualization */}
      <View style={styles.waveformContainer}>
        {renderGlass(
          <View style={styles.waveform}>
            {audioLevels.map((level, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.waveBar,
                  {
                    height: `${Math.max(10, level * 100)}%`,
                    backgroundColor: recordingState === RecordingState.RECORDING
                      ? Colors.coral
                      : Colors.emeraldLight,
                    opacity: 0.3 + (index / audioLevels.length) * 0.7,
                  },
                ]}
              />
            ))}
          </View>,
          styles.waveformGlass
        )}
      </View>

      {/* Duration Display */}
      <View style={styles.durationContainer}>
        {recordingState === RecordingState.RECORDING && (
          <Animated.View
            style={[
              styles.recordingDot,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
        )}
        <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        {recordingState !== RecordingState.IDLE && (
          <Text style={styles.stateText}>
            {recordingState === RecordingState.RECORDING && 'Recording...'}
            {recordingState === RecordingState.PAUSED && 'Paused'}
            {recordingState === RecordingState.STOPPED && 'Recording Complete'}
          </Text>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {recordingState === RecordingState.IDLE && (
          <TouchableOpacity style={styles.recordBtn} onPress={startRecording}>
            <LinearGradient
              colors={[Colors.coral, '#c0392b']}
              style={styles.recordBtnGradient}
            >
              <View style={styles.recordBtnInner} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {recordingState === RecordingState.RECORDING && (
          <View style={styles.recordingControls}>
            <TouchableOpacity style={styles.controlBtn} onPress={pauseRecording}>
              {renderGlass(
                <Text style={styles.controlIcon}>⏸️</Text>,
                styles.controlBtnGlass
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
              <LinearGradient
                colors={[Colors.coral, '#c0392b']}
                style={styles.stopBtnGradient}
              >
                <View style={styles.stopBtnInner} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlBtn} onPress={discardRecording}>
              {renderGlass(
                <Text style={styles.controlIcon}>🗑️</Text>,
                styles.controlBtnGlass
              )}
            </TouchableOpacity>
          </View>
        )}

        {recordingState === RecordingState.PAUSED && (
          <View style={styles.recordingControls}>
            <TouchableOpacity style={styles.controlBtn} onPress={discardRecording}>
              {renderGlass(
                <Text style={styles.controlIcon}>🗑️</Text>,
                styles.controlBtnGlass
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.recordBtn} onPress={resumeRecording}>
              <LinearGradient
                colors={[Colors.emeraldLight, Colors.emerald]}
                style={styles.recordBtnGradient}
              >
                <Text style={styles.resumeIcon}>▶</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlBtn} onPress={stopRecording}>
              {renderGlass(
                <Text style={styles.controlIcon}>⏹️</Text>,
                styles.controlBtnGlass
              )}
            </TouchableOpacity>
          </View>
        )}

        {recordingState === RecordingState.STOPPED && (
          <View style={styles.stoppedControls}>
            <TouchableOpacity style={styles.actionBtn} onPress={discardRecording}>
              {renderGlass(
                <View style={styles.actionBtnContent}>
                  <Text style={styles.actionIcon}>🗑️</Text>
                  <Text style={styles.actionLabel}>Discard</Text>
                </View>,
                styles.actionBtnGlass
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={resetRecorder}>
              {renderGlass(
                <View style={styles.actionBtnContent}>
                  <Text style={styles.actionIcon}>🔄</Text>
                  <Text style={styles.actionLabel}>Re-record</Text>
                </View>,
                styles.actionBtnGlass
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.transcribeBtn}
              onPress={() => {
                onTranscriptionStart?.({
                  uri: recordingUri,
                  language: selectedLanguage,
                  duration,
                });
              }}
              disabled={isTranscribing}
            >
              <LinearGradient
                colors={Gradients.primary.colors}
                style={styles.transcribeBtnGradient}
              >
                {isTranscribing ? (
                  <Text style={styles.transcribeBtnText}>Transcribing...</Text>
                ) : (
                  <>
                    <Text style={styles.transcribeIcon}>✨</Text>
                    <Text style={styles.transcribeBtnText}>Transcribe</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Recording Tips */}
      {recordingState === RecordingState.IDLE && (
        <View style={styles.tips}>
          {renderGlass(
            <View style={styles.tipsContent}>
              <Text style={styles.tipsTitle}>💡 Tips for best results</Text>
              <Text style={styles.tipText}>• Speak clearly at a moderate pace</Text>
              <Text style={styles.tipText}>• Minimize background noise</Text>
              <Text style={styles.tipText}>• Keep microphone 6-12 inches away</Text>
              <Text style={styles.tipText}>• Supports English, Hindi & Marathi</Text>
            </View>,
            styles.tipsGlass
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  
  // Language selector
  languageBtn: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  languageBtnGlass: {
    borderRadius: BorderRadius.md,
  },
  languageBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  languageFlag: {
    fontSize: 16,
  },
  languageLabel: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  dropdownIcon: {
    fontSize: 10,
    color: Colors.text.muted,
    marginLeft: Spacing.xs,
  },
  
  // Language menu
  languageMenu: {
    position: 'absolute',
    top: 60,
    right: Spacing.lg,
    zIndex: 100,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  languageMenuGlass: {
    borderRadius: BorderRadius.lg,
  },
  languageMenuContent: {
    padding: Spacing.md,
    minWidth: 180,
  },
  languageMenuTitle: {
    fontSize: 12,
    color: Colors.text.muted,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: 4,
  },
  languageOptionActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  languageOptionFlag: {
    fontSize: 18,
    marginRight: Spacing.sm,
  },
  languageOptionLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  languageOptionLabelActive: {
    color: Colors.emeraldLight,
    fontWeight: '600',
  },
  checkmark: {
    color: Colors.emeraldLight,
    fontSize: 14,
    fontWeight: '700',
  },

  // Waveform
  waveformContainer: {
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  waveformGlass: {
    borderRadius: BorderRadius.lg,
  },
  waveform: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    minHeight: 10,
  },

  // Duration
  durationContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.coral,
    marginBottom: Spacing.sm,
  },
  durationText: {
    fontSize: 48,
    fontWeight: '200',
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  stateText: {
    fontSize: 14,
    color: Colors.text.muted,
    marginTop: Spacing.xs,
  },

  // Controls
  controls: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  recordBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
  },
  recordBtnGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordBtnInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.white,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  controlBtn: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  controlBtnGlass: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlIcon: {
    fontSize: 24,
  },
  stopBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
  },
  stopBtnGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopBtnInner: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  resumeIcon: {
    fontSize: 24,
    color: Colors.white,
  },

  // Stopped controls
  stoppedControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  actionBtn: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  actionBtnGlass: {
    borderRadius: BorderRadius.lg,
  },
  actionBtnContent: {
    alignItems: 'center',
    padding: Spacing.md,
    minWidth: 80,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: Spacing.xs,
  },
  actionLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  transcribeBtn: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  transcribeBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  transcribeIcon: {
    fontSize: 20,
  },
  transcribeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },

  // Tips
  tips: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  tipsGlass: {
    borderRadius: BorderRadius.lg,
  },
  tipsContent: {
    padding: Spacing.lg,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  tipText: {
    fontSize: 13,
    color: Colors.text.muted,
    marginBottom: 4,
  },

  // Glass styling
  glass: {
    overflow: 'hidden',
  },
  glassFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
});

export default AudioRecorder;
