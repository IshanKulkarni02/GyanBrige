/**
 * VideoPlayer Component
 * HLS streaming player with custom controls, progress bar, and quality selector
 * Supports Android, iOS, and Web via expo-av
 */

import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode, Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  Colors,
  Gradients,
  Spacing,
  BorderRadius,
} from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Quality presets for HLS streams
const QUALITY_OPTIONS = [
  { label: 'Auto', value: 'auto', bitrate: null },
  { label: '1080p', value: '1080', bitrate: 5000000 },
  { label: '720p', value: '720', bitrate: 2800000 },
  { label: '480p', value: '480', bitrate: 1400000 },
  { label: '360p', value: '360', bitrate: 800000 },
];

const VideoPlayer = forwardRef(({
  source,
  poster,
  title,
  subtitle,
  onProgress,
  onComplete,
  onError,
  initialPosition = 0,
  style,
  accentColor = Colors.emeraldLight,
}, ref) => {
  // Refs
  const videoRef = useRef(null);
  const controlsTimeout = useRef(null);
  const progressBarRef = useRef(null);

  // Playback state
  const [status, setStatus] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [buffered, setBuffered] = useState(0);

  // UI state
  const [showControls, setShowControls] = useState(true);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('auto');
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);

  // Animations
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    play: async () => {
      if (videoRef.current) await videoRef.current.playAsync();
    },
    pause: async () => {
      if (videoRef.current) await videoRef.current.pauseAsync();
    },
    seekTo: async (positionMs) => {
      if (videoRef.current) await videoRef.current.setPositionAsync(positionMs);
    },
    getStatus: () => status,
  }));

  // Configure audio for background playback
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  // Auto-hide controls
  useEffect(() => {
    if (showControls && isPlaying && !showQualityMenu) {
      controlsTimeout.current = setTimeout(() => {
        hideControls();
      }, 3000);
    }

    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, [showControls, isPlaying, showQualityMenu]);

  const hideControls = () => {
    Animated.timing(controlsOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setShowControls(false));
  };

  const revealControls = () => {
    setShowControls(true);
    Animated.timing(controlsOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Handle playback status updates
  const handlePlaybackStatusUpdate = useCallback((playbackStatus) => {
    if (!playbackStatus.isLoaded) {
      if (playbackStatus.error) {
        console.error('Playback error:', playbackStatus.error);
        onError?.(playbackStatus.error);
      }
      return;
    }

    setStatus(playbackStatus);
    setIsPlaying(playbackStatus.isPlaying);
    setIsBuffering(playbackStatus.isBuffering);
    setDuration(playbackStatus.durationMillis || 0);
    setPosition(playbackStatus.positionMillis || 0);

    if (playbackStatus.playableDurationMillis) {
      setBuffered(playbackStatus.playableDurationMillis);
    }

    if (!isSeeking) {
      const progress = playbackStatus.durationMillis
        ? playbackStatus.positionMillis / playbackStatus.durationMillis
        : 0;
      progressAnim.setValue(progress);
    }

    onProgress?.({
      position: playbackStatus.positionMillis,
      duration: playbackStatus.durationMillis,
      buffered: playbackStatus.playableDurationMillis,
    });

    if (playbackStatus.didJustFinish) {
      onComplete?.();
    }
  }, [isSeeking, onProgress, onComplete, onError]);

  // Playback controls
  const togglePlayPause = async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  const seekTo = async (positionMs) => {
    if (!videoRef.current) return;
    await videoRef.current.setPositionAsync(positionMs);
  };

  const skip = async (seconds) => {
    const newPosition = Math.max(0, Math.min(duration, position + seconds * 1000));
    await seekTo(newPosition);
  };

  const changePlaybackSpeed = async (speed) => {
    if (!videoRef.current) return;
    setPlaybackSpeed(speed);
    await videoRef.current.setRateAsync(speed, true);
  };

  const toggleMute = async () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await videoRef.current.setIsMutedAsync(newMuted);
  };

  // Progress bar pan responder
  const progressPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        setIsSeeking(true);
        revealControls();
        const { locationX } = evt.nativeEvent;
        updateSeekPosition(locationX);
      },
      onPanResponderMove: (evt) => {
        const { locationX } = evt.nativeEvent;
        updateSeekPosition(locationX);
      },
      onPanResponderRelease: async (evt) => {
        const { locationX } = evt.nativeEvent;
        const seekMs = calculateSeekPosition(locationX);
        await seekTo(seekMs);
        setIsSeeking(false);
      },
    })
  ).current;

  const updateSeekPosition = (locationX) => {
    const progressBarWidth = SCREEN_WIDTH - Spacing.lg * 2 - 100; // Account for time labels
    const clampedX = Math.max(0, Math.min(locationX, progressBarWidth));
    const percentage = clampedX / progressBarWidth;
    setSeekPosition(percentage * duration);
    progressAnim.setValue(percentage);
  };

  const calculateSeekPosition = (locationX) => {
    const progressBarWidth = SCREEN_WIDTH - Spacing.lg * 2 - 100;
    const clampedX = Math.max(0, Math.min(locationX, progressBarWidth));
    const percentage = clampedX / progressBarWidth;
    return percentage * duration;
  };

  // Format time
  const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Quality selection
  const handleQualityChange = (quality) => {
    setSelectedQuality(quality.value);
    setShowQualityMenu(false);
    // Note: expo-av doesn't support direct quality selection for HLS
    // The quality would need to be handled at the server level or by switching streams
  };

  const renderGlassBackground = (children, additionalStyle) => {
    if (Platform.OS === 'ios') {
      return (
        <BlurView intensity={30} tint="dark" style={[styles.glassContainer, additionalStyle]}>
          {children}
        </BlurView>
      );
    }
    return (
      <View style={[styles.glassContainer, styles.glassFallback, additionalStyle]}>
        {children}
      </View>
    );
  };

  // Seek to initial position when loaded
  useEffect(() => {
    if (initialPosition > 0 && videoRef.current && status.isLoaded) {
      videoRef.current.setPositionAsync(initialPosition);
    }
  }, [initialPosition, status.isLoaded]);

  return (
    <View style={[styles.container, style]}>
      {/* Video */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={revealControls}
        style={styles.videoContainer}
      >
        <Video
          ref={videoRef}
          source={source}
          posterSource={poster}
          usePoster={!!poster}
          posterStyle={styles.poster}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={false}
          isLooping={false}
          isMuted={isMuted}
          volume={volume}
          rate={playbackSpeed}
          progressUpdateIntervalMillis={250}
          onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          useNativeControls={false}
        />

        {/* Buffering Indicator */}
        {isBuffering && (
          <View style={styles.bufferingContainer}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        )}

        {/* Controls Overlay */}
        {showControls && (
          <Animated.View style={[styles.controlsOverlay, { opacity: controlsOpacity }]}>
            {/* Top Gradient */}
            <LinearGradient
              colors={['rgba(0,0,0,0.7)', 'transparent']}
              style={styles.topGradient}
            >
              {/* Title */}
              {(title || subtitle) && (
                <View style={styles.titleContainer}>
                  {title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
                  {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                </View>
              )}

              {/* Top Right Controls */}
              <View style={styles.topRightControls}>
                <TouchableOpacity style={styles.iconButton} onPress={toggleMute}>
                  <Text style={styles.iconText}>{isMuted ? '🔇' : '🔊'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => setShowQualityMenu(!showQualityMenu)}
                >
                  <Text style={styles.iconText}>⚙️</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Center Controls */}
            <View style={styles.centerControls}>
              <TouchableOpacity style={styles.skipButton} onPress={() => skip(-10)}>
                <Text style={styles.skipText}>-10</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
                <LinearGradient
                  colors={[accentColor, Colors.emerald]}
                  style={styles.playButtonGradient}
                >
                  <Text style={styles.playButtonText}>{isPlaying ? '⏸' : '▶'}</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipButton} onPress={() => skip(10)}>
                <Text style={styles.skipText}>+10</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Controls */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.bottomGradient}
            >
              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <Text style={styles.timeText}>
                  {formatTime(isSeeking ? seekPosition : position)}
                </Text>

                <View
                  style={styles.progressBarContainer}
                  {...progressPanResponder.panHandlers}
                >
                  {/* Buffered Progress */}
                  <View
                    style={[
                      styles.bufferedBar,
                      { width: `${duration ? (buffered / duration) * 100 : 0}%` },
                    ]}
                  />

                  {/* Played Progress */}
                  <Animated.View
                    style={[
                      styles.progressBar,
                      {
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                        backgroundColor: accentColor,
                      },
                    ]}
                  />

                  {/* Thumb */}
                  <Animated.View
                    style={[
                      styles.progressThumb,
                      {
                        left: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                        backgroundColor: accentColor,
                        transform: [{ scale: isSeeking ? 1.5 : 1 }],
                      },
                    ]}
                  />

                  {/* Seek Preview */}
                  {isSeeking && (
                    <Animated.View
                      style={[
                        styles.seekPreview,
                        {
                          left: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          }),
                        },
                      ]}
                    >
                      {renderGlassBackground(
                        <Text style={styles.seekPreviewText}>
                          {formatTime(seekPosition)}
                        </Text>,
                        styles.seekPreviewGlass
                      )}
                    </Animated.View>
                  )}
                </View>

                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>

              {/* Bottom Button Row */}
              <View style={styles.bottomButtonRow}>
                {/* Playback Speed */}
                <TouchableOpacity
                  style={styles.bottomButton}
                  onPress={() => {
                    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
                    const currentIndex = speeds.indexOf(playbackSpeed);
                    const nextIndex = (currentIndex + 1) % speeds.length;
                    changePlaybackSpeed(speeds[nextIndex]);
                  }}
                >
                  {renderGlassBackground(
                    <Text style={styles.bottomButtonText}>{playbackSpeed}x</Text>,
                    styles.speedButton
                  )}
                </TouchableOpacity>

                {/* Quality Indicator */}
                <TouchableOpacity
                  style={styles.bottomButton}
                  onPress={() => setShowQualityMenu(!showQualityMenu)}
                >
                  {renderGlassBackground(
                    <Text style={styles.bottomButtonText}>
                      {QUALITY_OPTIONS.find(q => q.value === selectedQuality)?.label || 'Auto'}
                    </Text>,
                    styles.qualityButton
                  )}
                </TouchableOpacity>

                {/* Fullscreen (placeholder) */}
                <TouchableOpacity style={styles.bottomButton}>
                  {renderGlassBackground(
                    <Text style={styles.bottomButtonText}>⛶</Text>,
                    styles.fullscreenButton
                  )}
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Quality Menu */}
            {showQualityMenu && (
              <View style={styles.qualityMenuContainer}>
                {renderGlassBackground(
                  <View style={styles.qualityMenu}>
                    <Text style={styles.qualityMenuTitle}>Quality</Text>
                    {QUALITY_OPTIONS.map((quality) => (
                      <TouchableOpacity
                        key={quality.value}
                        style={[
                          styles.qualityOption,
                          selectedQuality === quality.value && styles.qualityOptionSelected,
                        ]}
                        onPress={() => handleQualityChange(quality)}
                      >
                        <Text
                          style={[
                            styles.qualityOptionText,
                            selectedQuality === quality.value && { color: accentColor },
                          ]}
                        >
                          {quality.label}
                        </Text>
                        {selectedQuality === quality.value && (
                          <Text style={[styles.checkmark, { color: accentColor }]}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}

                    <View style={styles.qualityDivider} />
                    <Text style={styles.qualityMenuTitle}>Playback Speed</Text>
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((speed) => (
                      <TouchableOpacity
                        key={speed}
                        style={[
                          styles.qualityOption,
                          playbackSpeed === speed && styles.qualityOptionSelected,
                        ]}
                        onPress={() => {
                          changePlaybackSpeed(speed);
                          setShowQualityMenu(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.qualityOptionText,
                            playbackSpeed === speed && { color: accentColor },
                          ]}
                        >
                          {speed === 1.0 ? 'Normal' : `${speed}x`}
                        </Text>
                        {playbackSpeed === speed && (
                          <Text style={[styles.checkmark, { color: accentColor }]}>✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>,
                  styles.qualityMenuGlass
                )}
              </View>
            )}
          </Animated.View>
        )}
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  poster: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  bufferingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Glass styling
  glassContainer: {
    overflow: 'hidden',
  },
  glassFallback: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Top gradient & controls
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    marginRight: Spacing.lg,
  },
  title: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  topRightControls: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 16,
  },

  // Center controls
  centerControls: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateY: -30 }],
    gap: Spacing.xxl,
  },
  skipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
  },
  playButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    color: Colors.white,
    fontSize: 28,
  },

  // Bottom gradient & controls
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },

  // Progress bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  timeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '500',
    width: 50,
    textAlign: 'center',
  },
  progressBarContainer: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
    marginHorizontal: Spacing.sm,
  },
  bufferedBar: {
    position: 'absolute',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressBar: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    top: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  seekPreview: {
    position: 'absolute',
    bottom: 25,
    marginLeft: -30,
  },
  seekPreviewGlass: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  seekPreviewText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },

  // Bottom button row
  bottomButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bottomButton: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  speedButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  qualityButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  fullscreenButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  bottomButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },

  // Quality menu
  qualityMenuContainer: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 80,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  qualityMenuGlass: {
    borderRadius: BorderRadius.lg,
  },
  qualityMenu: {
    padding: Spacing.md,
    minWidth: 150,
  },
  qualityMenuTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  qualityOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  qualityOptionSelected: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  qualityOptionText: {
    color: Colors.white,
    fontSize: 14,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
  },
  qualityDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: Spacing.sm,
  },
});

export default VideoPlayer;
