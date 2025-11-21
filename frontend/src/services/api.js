import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your local network IP when testing on LAN
// Find your IP by running backend and checking the console output
const API_BASE_URL = 'http://localhost:5001/api'; // localhost for same machine

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token to requests
    this.api.interceptors.request.use(async (config) => {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Auth
  async login(email, password) {
    const response = await this.api.post('/auth/login', { email, password });
    if (response.data.token) {
      await AsyncStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  }

  async register(name, email, password, role = 'student') {
    const response = await this.api.post('/auth/register', { name, email, password, role });
    if (response.data.token) {
      await AsyncStorage.setItem('authToken', response.data.token);
    }
    return response.data;
  }

  // Videos
  async getVideos() {
    const response = await this.api.get('/videos');
    return response.data;
  }

  async getVideo(videoId) {
    const response = await this.api.get(`/videos/${videoId}`);
    return response.data;
  }

  async uploadVideo(formData, onUploadProgress) {
    const response = await this.api.post('/videos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    return response.data;
  }

  async deleteVideo(videoId) {
    const response = await this.api.delete(`/videos/${videoId}`);
    return response.data;
  }

  // Notes
  async getNotes(videoId) {
    const response = await this.api.get(`/notes/video/${videoId}`);
    return response.data;
  }

  async regenerateNotes(videoId, content) {
    const response = await this.api.post(`/notes/regenerate/${videoId}`, { content });
    return response.data;
  }

  // Health check
  async checkHealth() {
    const response = await this.api.get('/health');
    return response.data;
  }

  // Get video stream URL
  getVideoUrl(masterPlaylist) {
    return `${API_BASE_URL.replace('/api', '')}/videos/${masterPlaylist}`;
  }

  // Get thumbnail URL
  getThumbnailUrl(thumbnail) {
    return `${API_BASE_URL.replace('/api', '')}/videos/${thumbnail}`;
  }
}

export default new ApiService();
