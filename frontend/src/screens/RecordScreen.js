import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, TextInput, Card } from 'react-native-paper';
import { Camera } from 'expo-camera';
import api from '../services/api';

export default function RecordScreen({ navigation }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      const audioStatus = await Camera.requestMicrophonePermissionsAsync();
      setHasPermission(status === 'granted' && audioStatus.status === 'granted');
    })();
  }, []);

  const startRecording = async () => {
    if (!cameraRef.current) return;

    try {
      setIsRecording(true);
      const video = await cameraRef.current.recordAsync({
        quality: Camera.Constants.VideoQuality['720p'],
        maxDuration: 600, // 10 minutes max
      });
      
      // After recording stops, upload the video
      uploadRecordedVideo(video.uri);
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Error', 'Failed to record video');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
      setIsRecording(false);
    }
  };

  const uploadRecordedVideo = async (uri) => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title before recording');
      return;
    }

    try {
      const formData = new FormData();
      const filename = `recording_${Date.now()}.mp4`;
      
      formData.append('video', {
        uri,
        type: 'video/mp4',
        name: filename,
      });
      formData.append('title', title);
      formData.append('description', description);

      await api.uploadVideo(formData);

      Alert.alert(
        'Success',
        'Recording uploaded successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              setTitle('');
              setDescription('');
              navigation.navigate('Home');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload recording');
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centered}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>No access to camera and microphone</Text>
        <Text style={styles.subtleText}>
          Please enable camera and microphone permissions in settings
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isRecording && (
        <Card style={styles.inputCard}>
          <Card.Content>
            <Text style={styles.heading}>Record Video</Text>
            <TextInput
              label="Title"
              value={title}
              onChangeText={setTitle}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Description (Optional)"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={styles.input}
            />
          </Card.Content>
        </Card>
      )}

      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={Camera.Constants.Type.back}
        ratio="16:9"
      >
        <View style={styles.cameraControls}>
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording...</Text>
            </View>
          )}
        </View>
      </Camera>

      <View style={styles.controls}>
        {!isRecording ? (
          <Button
            mode="contained"
            onPress={startRecording}
            icon="record-circle"
            style={styles.button}
            disabled={!title.trim()}
            contentStyle={styles.buttonContent}
          >
            Start Recording
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={stopRecording}
            icon="stop"
            style={[styles.button, styles.stopButton]}
            contentStyle={styles.buttonContent}
          >
            Stop Recording
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  inputCard: {
    margin: 16,
    elevation: 3,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    marginBottom: 12,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-start',
    padding: 20,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  controls: {
    padding: 20,
    backgroundColor: '#000',
  },
  button: {
    paddingVertical: 8,
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  buttonContent: {
    height: 56,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subtleText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});
