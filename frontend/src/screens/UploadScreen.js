import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { Text, Button, TextInput, ProgressBar, Card, Menu } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function UploadScreen({ navigation }) {
  const { user, isAdmin } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [lesson, setLesson] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [subjectMenuVisible, setSubjectMenuVisible] = useState(false);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      const response = await fetch(`${api.api.defaults.baseURL}/admin/subjects`, {
        headers: { 'x-user-role': 'admin' }
      });
      const data = await response.json();
      let availableSubjects = data.subjects || [];
      
      // Filter subjects for teachers - only show subjects they're assigned to
      if (!isAdmin && user) {
        availableSubjects = availableSubjects.filter(subject => 
          subject.teachers?.some(teacher => teacher._id === user.id || teacher._id === user._id)
        );
      }
      
      setSubjects(availableSubjects);
      
      // Auto-select first subject for teachers
      if (!isAdmin && availableSubjects.length > 0) {
        setSelectedSubject(availableSubjects[0]._id);
      }
    } catch (error) {
      console.error('Error loading subjects:', error);
    }
  };

  const pickVideo = async () => {
    try {
      if (Platform.OS === 'web') {
        // Web-specific file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            setSelectedFile({
              name: file.name,
              size: file.size,
              type: file.type,
              uri: URL.createObjectURL(file),
              file: file, // Store the actual File object
            });
            if (!title) {
              setTitle(file.name.replace(/\.[^/.]+$/, ''));
            }
          }
        };
        input.click();
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: 'video/*',
          copyToCacheDirectory: true,
        });

        if (result.type === 'success') {
          setSelectedFile(result);
          if (!title) {
            setTitle(result.name.replace(/\.[^/.]+$/, ''));
          }
        }
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to select video');
    }
  };

  const uploadVideo = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a video first');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      
      if (Platform.OS === 'web' && selectedFile.file) {
        // On web, append the actual File object
        formData.append('video', selectedFile.file);
      } else {
        // On mobile, use the standard approach
        formData.append('video', {
          uri: selectedFile.uri,
          type: selectedFile.mimeType || selectedFile.type || 'video/mp4',
          name: selectedFile.name,
        });
      }
      
      formData.append('title', title);
      formData.append('description', description);
      if (selectedSubject) {
        formData.append('subject', selectedSubject);
      }
      if (lesson) {
        formData.append('lesson', lesson);
      }

      const response = await api.uploadVideo(formData, (progressEvent) => {
        const progress = progressEvent.loaded / progressEvent.total;
        setUploadProgress(progress);
      });

      Alert.alert(
        'Success',
        'Video uploaded successfully! It will be processed shortly.',
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedFile(null);
              setTitle('');
              setDescription('');
              setUploadProgress(0);
              navigation.navigate('Home');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload video: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.heading}>Upload Video</Text>

          <Button
            mode="contained"
            onPress={pickVideo}
            icon="file-video"
            style={styles.button}
            disabled={uploading}
          >
            {selectedFile ? 'Change Video' : 'Select Video'}
          </Button>

          {selectedFile && (
            <View style={styles.fileInfo}>
              <Text style={styles.fileName}>{selectedFile.name}</Text>
              <Text style={styles.fileSize}>
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </Text>
            </View>
          )}

          <TextInput
            label="Title"
            value={title}
            onChangeText={setTitle}
            mode="outlined"
            style={styles.input}
            disabled={uploading}
          />

          <TextInput
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            multiline
            numberOfLines={3}
            style={styles.input}
            disabled={uploading}
          />

          {subjects.length > 0 ? (
            <Menu
              visible={subjectMenuVisible}
              onDismiss={() => setSubjectMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  onPress={() => setSubjectMenuVisible(true)}
                  style={styles.input}
                  disabled={uploading}
                >
                  {selectedSubject ? subjects.find(s => s._id === selectedSubject)?.name : 'Select Subject'}
                </Button>
              }
            >
              {isAdmin && (
                <Menu.Item onPress={() => { setSelectedSubject(''); setSubjectMenuVisible(false); }} title="None" />
              )}
              {subjects.map(subject => (
                <Menu.Item
                  key={subject._id}
                  onPress={() => { setSelectedSubject(subject._id); setSubjectMenuVisible(false); }}
                  title={subject.name}
                />
              ))}
            </Menu>
          ) : (
            <Text style={styles.noSubjectsText}>
              {isAdmin ? 'No subjects created yet. Create subjects in Admin panel.' : 'You are not assigned to any subjects. Contact admin.'}
            </Text>
          )}

          <TextInput
            label="Lesson/Topic (Optional)"
            value={lesson}
            onChangeText={setLesson}
            mode="outlined"
            style={styles.input}
            disabled={uploading}
            placeholder="e.g. Chapter 1: Introduction"
          />

          {uploading && (
            <View style={styles.progressContainer}>
              <Text style={styles.progressText}>
                Uploading... {(uploadProgress * 100).toFixed(0)}%
              </Text>
              <ProgressBar progress={uploadProgress} style={styles.progressBar} />
            </View>
          )}

          <Button
            mode="contained"
            onPress={uploadVideo}
            icon="upload"
            style={styles.uploadButton}
            disabled={!selectedFile || uploading || !title.trim()}
            loading={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Video'}
          </Button>
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  card: {
    elevation: 3,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    marginBottom: 16,
  },
  fileInfo: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  fileName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  input: {
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  uploadButton: {
    marginTop: 8,
  },
  noSubjectsText: {
    fontSize: 14,
    color: '#e53935',
    padding: 12,
    textAlign: 'center',
    backgroundColor: '#ffebee',
    borderRadius: 8,
    marginBottom: 16,
  },
});
