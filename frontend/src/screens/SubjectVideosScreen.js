import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text, ActivityIndicator, Chip, Divider } from 'react-native-paper';
import api from '../services/api';

export default function SubjectVideosScreen({ route, navigation }) {
  const { subject } = route.params;
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const response = await api.getVideos();
      // Filter videos for this subject
      const subjectVideos = response.videos.filter(
        v => v.subject?._id === subject._id
      );
      setVideos(subjectVideos);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderVideo = ({ item, index }) => (
    <>
      <TouchableOpacity
        onPress={() => navigation.navigate('VideoPlayer', { videoId: item.videoId })}
        style={styles.videoItem}
      >
        <View style={styles.videoNumber}>
          <Text style={styles.numberText}>{index + 1}</Text>
        </View>

        {item.thumbnail && (
          <Image
            source={{ uri: api.getThumbnailUrl(item.thumbnail) }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        )}

        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {item.lesson && (
            <Text style={styles.lesson} numberOfLines={1}>
              {item.lesson}
            </Text>
          )}
          <View style={styles.metadata}>
            <Text style={styles.views}>{item.views} views</Text>
            {item.status !== 'ready' && (
              <Chip style={styles.processingChip} textStyle={styles.chipText}>
                Processing
              </Chip>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <Divider />
    </>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { borderLeftColor: subject.color || '#2196F3' }]}>
        <Text style={styles.headerTitle}>{subject.name}</Text>
        <Text style={styles.headerCode}>{subject.code}</Text>
        {subject.description && (
          <Text style={styles.headerDescription}>{subject.description}</Text>
        )}
        <Text style={styles.videoCount}>{videos.length} lessons</Text>
      </View>

      <FlatList
        data={videos}
        renderItem={renderVideo}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No videos yet</Text>
            <Text style={styles.emptySubtext}>Check back later for new lessons</Text>
          </View>
        }
      />
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#f9f9f9',
    padding: 20,
    borderLeftWidth: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#030303',
  },
  headerCode: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  headerDescription: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    lineHeight: 20,
  },
  videoCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginTop: 12,
  },
  listContent: {
    flexGrow: 1,
  },
  videoItem: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
  },
  videoNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  numberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  thumbnail: {
    width: 120,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    marginRight: 12,
  },
  videoInfo: {
    flex: 1,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#030303',
    marginBottom: 4,
  },
  lesson: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  views: {
    fontSize: 12,
    color: '#888',
  },
  processingChip: {
    backgroundColor: '#FF9800',
    height: 20,
  },
  chipText: {
    fontSize: 10,
    color: '#fff',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
});
