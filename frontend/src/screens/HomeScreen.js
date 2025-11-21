import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Card, ActivityIndicator, Chip, IconButton, Portal, Dialog, Menu, Button } from 'react-native-paper';
import api from '../services/api';
import socket from '../services/socket';
import { useAuth } from '../context/AuthContext';

export default function HomeScreen({ navigation }) {
  const { isAdmin } = useAuth();
  const [videos, setVideos] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [editDialog, setEditDialog] = useState({ visible: false, video: null });
  const [editSubject, setEditSubject] = useState('');
  const [subjectMenuVisible, setSubjectMenuVisible] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ visible: false, video: null });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadVideos();
    loadSubjects();
    
    // Connect to socket for real-time updates
    socket.connect();
    socket.onVideoProcessed(handleVideoProcessed);
    socket.onDbChange(handleDbChange);

    return () => {
      socket.off('videoProcessed', handleVideoProcessed);
      socket.off('dbChange', handleDbChange);
    };
  }, []);

  const loadVideos = async () => {
    try {
      const response = await api.getVideos();
      setVideos(response.videos || []);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadSubjects = async () => {
    try {
      const response = await fetch(`${api.api.defaults.baseURL}/admin/subjects`, {
        headers: { 'x-user-role': 'admin' }
      });
      const data = await response.json();
      setSubjects(data.subjects || []);
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const handleVideoProcessed = (data) => {
    console.log('Video processed:', data);
    loadVideos(); // Reload videos
  };

  const handleDbChange = (change) => {
    console.log('Database change:', change.operationType);
    loadVideos(); // Reload on any DB change
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadVideos();
  };

  const updateVideoSubject = async () => {
    try {
      const response = await fetch(`${api.api.defaults.baseURL}/videos/${editDialog.video._id}/subject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subject: editSubject || null })
      });
      
      if (response.ok) {
        setEditDialog({ visible: false, video: null });
        loadVideos();
      }
    } catch (error) {
      console.error('Error updating video subject:', error);
    }
  };

  const deleteVideo = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`${api.api.defaults.baseURL}/videos/${deleteDialog.video.videoId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setDeleteDialog({ visible: false, video: null });
        loadVideos();
      } else {
        alert('Failed to delete video');
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Error deleting video');
    } finally {
      setDeleting(false);
    }
  };

  const filteredVideos = selectedSubject === 'all' 
    ? videos 
    : videos.filter(v => v.subject?._id === selectedSubject);

  const renderVideo = ({ item }) => (
    <View style={styles.videoCard}>
      <TouchableOpacity
        onPress={() => navigation.navigate('VideoPlayer', { videoId: item.videoId })}
        style={styles.videoTouchable}
      >
        {item.thumbnail && (
          <Image
            source={{ uri: api.getThumbnailUrl(item.thumbnail) }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        )}
        <View style={styles.videoInfo}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <View style={styles.metadataContainer}>
            {item.subject && (
              <Chip
                icon="book-outline"
                style={styles.subjectChip}
                textStyle={styles.subjectChipText}
              >
                {item.subject.name}
              </Chip>
            )}
            {item.lesson && (
              <Text style={styles.lesson} numberOfLines={1}>{item.lesson}</Text>
            )}
          </View>
          <Text style={styles.views}>{item.views} views</Text>
          {item.status !== 'ready' && (
            <Chip
              icon="clock"
              style={styles.processingChip}
              textStyle={styles.chipText}
            >
              Processing
            </Chip>
          )}
        </View>
      </TouchableOpacity>
      {isAdmin && (
        <View style={styles.adminActions}>
          <IconButton
            icon="pencil"
            size={20}
            onPress={() => {
              setEditDialog({ visible: true, video: item });
              setEditSubject(item.subject?._id || '');
            }}
          />
          <IconButton
            icon="delete"
            size={20}
            iconColor="#e53935"
            onPress={() => setDeleteDialog({ visible: true, video: item })}
          />
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Subject Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterTabs}
        contentContainerStyle={styles.filterTabsContent}
      >
        <Chip
          selected={selectedSubject === 'all'}
          onPress={() => setSelectedSubject('all')}
          style={[styles.filterChip, selectedSubject === 'all' && styles.filterChipSelected]}
          textStyle={selectedSubject === 'all' ? styles.filterChipTextSelected : styles.filterChipText}
        >
          All
        </Chip>
        {subjects.map(subject => (
          <Chip
            key={subject._id}
            selected={selectedSubject === subject._id}
            onPress={() => setSelectedSubject(subject._id)}
            style={[styles.filterChip, selectedSubject === subject._id && styles.filterChipSelected]}
            textStyle={selectedSubject === subject._id ? styles.filterChipTextSelected : styles.filterChipText}
          >
            {subject.name}
          </Chip>
        ))}
      </ScrollView>

      <FlatList
        data={filteredVideos}
        renderItem={renderVideo}
        keyExtractor={(item) => item._id}
        numColumns={1}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No videos yet</Text>
            <Text style={styles.emptySubtext}>Upload or record your first video!</Text>
          </View>
        }
        contentContainerStyle={filteredVideos.length === 0 ? styles.emptyContainer : styles.listContent}
      />

      {/* Edit Video Subject Dialog */}
      <Portal>
        <Dialog visible={editDialog.visible} onDismiss={() => setEditDialog({ visible: false, video: null })}>
          <Dialog.Title>Edit Video Subject</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogVideoTitle}>{editDialog.video?.title}</Text>
            
            <Menu
              visible={subjectMenuVisible}
              onDismiss={() => setSubjectMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setSubjectMenuVisible(true)}
                  style={styles.subjectPicker}
                >
                  {editSubject ? subjects.find(s => s._id === editSubject)?.name : 'No Subject'}
                </Button>
              }
            >
              <Menu.Item onPress={() => { setEditSubject(''); setSubjectMenuVisible(false); }} title="None" />
              {subjects.map(subject => (
                <Menu.Item
                  key={subject._id}
                  onPress={() => { setEditSubject(subject._id); setSubjectMenuVisible(false); }}
                  title={subject.name}
                />
              ))}
            </Menu>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialog({ visible: false, video: null })}>Cancel</Button>
            <Button onPress={updateVideoSubject}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog visible={deleteDialog.visible} onDismiss={() => !deleting && setDeleteDialog({ visible: false, video: null })}>
          <Dialog.Title>Delete Video</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogVideoTitle}>{deleteDialog.video?.title}</Text>
            <Text style={styles.deleteWarning}>Are you sure you want to delete this video? This action cannot be undone.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialog({ visible: false, video: null })} disabled={deleting}>Cancel</Button>
            <Button onPress={deleteVideo} disabled={deleting} loading={deleting} textColor="#e53935">Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  filterTabs: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  filterTabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#f2f2f2',
    marginRight: 8,
  },
  filterChipSelected: {
    backgroundColor: '#030303',
  },
  filterChipText: {
    color: '#030303',
    fontSize: 14,
  },
  filterChipTextSelected: {
    color: '#fff',
    fontSize: 14,
  },
  listContent: {
    paddingVertical: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#606060',
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
  },
  videoTouchable: {
    flex: 1,
  },
  editButton: {
    margin: 0,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  videoInfo: {
    marginTop: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#030303',
    lineHeight: 22,
    marginBottom: 4,
  },
  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  subjectChip: {
    backgroundColor: '#2196F3',
    height: 24,
    marginRight: 8,
  },
  subjectChipText: {
    fontSize: 11,
    color: '#fff',
  },
  lesson: {
    fontSize: 12,
    color: '#606060',
    flex: 1,
  },
  views: {
    fontSize: 14,
    color: '#606060',
    marginTop: 2,
  },
  processingChip: {
    backgroundColor: '#FF9800',
    height: 24,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 11,
    color: '#fff',
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#030303',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#606060',
    marginTop: 8,
  },
  dialogVideoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#030303',
    marginBottom: 16,
  },
  subjectPicker: {
    marginTop: 8,
  },
});
