import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Platform, TouchableOpacity } from 'react-native';
import { Text, Button, ActivityIndicator, Card, IconButton, Menu, Divider, Chip } from 'react-native-paper';
import { Video } from 'expo-av';
import api from '../services/api';

// For web HLS playback
let Hls;
if (Platform.OS === 'web') {
  Hls = require('hls.js').default;
}

export default function VideoPlayerScreen({ route, navigation }) {
  const { videoId } = route.params;
  const [video, setVideo] = useState(null);
  const [notes, setNotes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const [videoRef, setVideoRef] = useState(null);
  const [qualityMenuVisible, setQualityMenuVisible] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('auto');
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const videoElement = useRef(null);
  const hlsInstance = useRef(null);

  useEffect(() => {
    loadVideo();
  }, [videoId]);

  useEffect(() => {
    // Initialize HLS.js for web
    if (Platform.OS === 'web' && video && videoElement.current) {
      const videoUrl = api.getVideoUrl(video.masterPlaylist);
      console.log('Loading video URL:', videoUrl);
      
      if (Hls && Hls.isSupported()) {
        console.log('HLS.js is supported, initializing...');
        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: false,
        });
        hlsInstance.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(videoElement.current);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('✅ HLS manifest loaded, qualities:', hls.levels);
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('❌ HLS error:', data);
          if (data.fatal) {
            console.error('Fatal error, destroying HLS');
          }
        });
        
        return () => {
          console.log('Cleaning up HLS');
          hls.destroy();
        };
      } else if (videoElement.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        console.log('Using native HLS support');
        videoElement.current.src = videoUrl;
      } else {
        console.error('HLS is not supported');
      }
    }
  }, [video]);

  const changeQuality = (quality) => {
    if (hlsInstance.current && Platform.OS === 'web') {
      if (quality === 'auto') {
        hlsInstance.current.currentLevel = -1; // Auto
      } else {
        const qualityMap = { '360p': 0, '480p': 1, '720p': 2, '1080p': 3 };
        hlsInstance.current.currentLevel = qualityMap[quality] || -1;
      }
    }
    setSelectedQuality(quality);
    setQualityMenuVisible(false);
  };

  const loadVideo = async () => {
    try {
      const response = await api.getVideo(videoId);
      setVideo(response.video);
      // Load notes
      loadNotes(response.video._id);
    } catch (error) {
      console.error('Error loading video:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async (id) => {
    try {
      const response = await api.getNotes(id);
      setNotes(response.notes);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const generateNotes = async () => {
    setGeneratingNotes(true);
    try {
      const response = await fetch(`${api.api.defaults.baseURL}/videos/${video.videoId}/generate-notes`, {
        method: 'POST',
      });
      
      if (response.ok) {
        // Wait a moment then reload notes
        setTimeout(() => {
          loadNotes(video._id);
          setGeneratingNotes(false);
        }, 5000); // Wait 5 seconds for generation
      }
    } catch (error) {
      console.error('Error generating notes:', error);
      setGeneratingNotes(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!video || video.status !== 'ready') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {video?.status === 'processing'
            ? 'Video is still processing. Please check back later.'
            : 'Video not available'}
        </Text>
      </View>
    );
  }

  const videoUrl = api.getVideoUrl(video.masterPlaylist);

  return (
    <View style={styles.container}>
      {/* Video Player */}
      <View style={styles.playerWrapper}>
        {Platform.OS === 'web' ? (
          <video
            ref={videoElement}
            controls
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#000',
            }}
          />
        ) : (
          <Video
            ref={ref => setVideoRef(ref)}
            source={{ uri: videoUrl }}
            style={styles.video}
            useNativeControls
            resizeMode="contain"
            shouldPlay={false}
          />
        )}
      </View>

      <ScrollView style={styles.content}>
        {/* Video Info */}
        <View style={styles.videoInfo}>
          <Text style={styles.title}>{video.title}</Text>
          
          <View style={styles.metadataRow}>
            <Text style={styles.views}>{video.views} views</Text>
            <View style={styles.actions}>
              <Menu
                visible={qualityMenuVisible}
                onDismiss={() => setQualityMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    icon="quality-high"
                    onPress={() => setQualityMenuVisible(true)}
                    compact
                  >
                    {selectedQuality.toUpperCase()}
                  </Button>
                }
              >
                <Menu.Item onPress={() => changeQuality('auto')} title="Auto" />
                <Divider />
                {video.qualities?.map(q => (
                  <Menu.Item key={q} onPress={() => changeQuality(q)} title={q.toUpperCase()} />
                ))}
              </Menu>
            </View>
          </View>
        </View>

        <Divider style={styles.divider} />

        {/* Description */}
        {video.description && (
          <View style={styles.descriptionSection}>
            <Text style={styles.descriptionTitle}>Description</Text>
            <Text style={styles.description}>{video.description}</Text>
          </View>
        )}

        <Divider style={styles.divider} />

        {/* AI-Generated Notes */}
        <View style={styles.notesSection}>
          <View style={styles.notesSectionHeader}>
            <View style={styles.notesTitleRow}>
              <IconButton icon="robot" size={20} />
              <Text style={styles.notesTitle}>AI-Generated Notes</Text>
              {notes && <Chip style={styles.aiChip} textStyle={styles.aiChipText}>Llama 3</Chip>}
            </View>
          </View>

          <View style={styles.notesContent}>
            {generatingNotes ? (
              <View style={styles.generatingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.generatingText}>Generating notes with AI...</Text>
                <Text style={styles.generatingSubtext}>This may take 10-30 seconds</Text>
              </View>
            ) : loadingNotes ? (
              <View style={styles.generatingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.generatingText}>Loading notes...</Text>
              </View>
            ) : notes ? (
              <View>
                {notes.summary && (
                  <View style={styles.noteSection}>
                    <Text style={styles.noteSectionTitle}>Summary</Text>
                    <Text style={styles.noteText}>{notes.summary}</Text>
                  </View>
                )}

                {notes.keyPoints && notes.keyPoints.length > 0 && (
                  <View style={styles.noteSection}>
                    <Text style={styles.noteSectionTitle}>Key Points</Text>
                    {notes.keyPoints.map((point, index) => (
                      <View key={index} style={styles.bulletPoint}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.noteText}>{point}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {notes.content && !notes.keyPoints?.length && (
                  <View style={styles.noteSection}>
                    <Text style={styles.noteText}>{notes.content}</Text>
                  </View>
                )}

                <Text style={styles.notesTimestamp}>
                  Generated {new Date(notes.createdAt || notes.timestamp).toLocaleDateString()}
                </Text>
              </View>
            ) : (
              <View style={styles.noNotesContainer}>
                <IconButton icon="robot-outline" size={48} iconColor="#ccc" />
                <Text style={styles.notesError}>No notes available for this video.</Text>
                <Button
                  mode="contained"
                  icon="robot"
                  onPress={generateNotes}
                  disabled={generatingNotes}
                  style={styles.generateButton}
                >
                  Generate AI Notes
                </Button>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  playerWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  videoInfo: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#030303',
    marginBottom: 8,
    lineHeight: 24,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  views: {
    fontSize: 14,
    color: '#606060',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e5e5',
  },
  descriptionSection: {
    padding: 16,
  },
  descriptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#030303',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#606060',
    lineHeight: 20,
  },
  notesSection: {
    backgroundColor: '#f9f9f9',
  },
  notesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  notesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#030303',
  },
  aiChip: {
    marginLeft: 8,
    backgroundColor: '#2196F3',
    height: 24,
  },
  aiChipText: {
    fontSize: 11,
    color: '#fff',
  },
  notesContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  notesLoader: {
    marginVertical: 20,
  },
  noteSection: {
    marginBottom: 16,
  },
  noteSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#030303',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    color: '#606060',
    lineHeight: 20,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 14,
    color: '#2196F3',
    marginRight: 8,
    fontWeight: 'bold',
  },
  notesTimestamp: {
    fontSize: 12,
    color: '#909090',
    marginTop: 12,
    fontStyle: 'italic',
  },
  notesError: {
    fontSize: 14,
    color: '#909090',
    textAlign: 'center',
    marginBottom: 12,
  },
  noNotesContainer: {
    padding: 20,
    alignItems: 'center',
  },
  generatingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  generatingText: {
    fontSize: 16,
    color: '#2196F3',
    marginTop: 12,
    fontWeight: '600',
  },
  generatingSubtext: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  generateButton: {
    marginTop: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
});
