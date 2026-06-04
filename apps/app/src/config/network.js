/**
 * Network Configuration
 * Centralized configuration for API endpoints and network settings
 * 
 * SETUP INSTRUCTIONS:
 * ===================
 * 
 * 1. Find your computer's local IP address:
 * 
 *    macOS:
 *      - Open Terminal and run: ipconfig getifaddr en0
 *      - Or: System Preferences → Network → Wi-Fi → IP Address
 * 
 *    Windows:
 *      - Open Command Prompt and run: ipconfig
 *      - Look for "IPv4 Address" under your Wi-Fi adapter
 * 
 *    Linux:
 *      - Open Terminal and run: hostname -I | awk '{print $1}'
 *      - Or: ip addr show | grep "inet " | grep -v 127.0.0.1
 * 
 * 2. Update the SERVER_IP below with your IP (e.g., '192.168.1.100')
 * 
 * 3. Make sure your phone/tablet is on the SAME Wi-Fi network as your computer
 * 
 * 4. Start the backend server:
 *      cd server && node transcriptionServer.js
 * 
 * 5. Start Expo:
 *      npx expo start
 * 
 * 6. Scan the QR code with Expo Go app on your device
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ============================================
// ⚠️  UPDATE THIS WITH YOUR LOCAL IP ADDRESS
// ============================================
const SERVER_IP = '192.168.31.105';  // <-- Change this to your computer's IP

// Server port (matches transcriptionServer.js)
const SERVER_PORT = 3001;

// Video streaming port (matches videoProcessor.js serve command)
const MEDIA_PORT = 8080;

// ============================================
// Configuration object
// ============================================

const NetworkConfig = {
  // Auto-detect if running in Expo Go with tunnel
  get isExpoGo() {
    return Constants.appOwnership === 'expo';
  },

  // Check if running on simulator/emulator
  get isSimulator() {
    // iOS Simulator or Android Emulator
    return !Constants.isDevice;
  },

  // Get the appropriate host for API calls
  get apiHost() {
    // For simulators, localhost works
    if (this.isSimulator) {
      // Android emulator uses 10.0.2.2 to reach host machine
      if (Platform.OS === 'android') {
        return '10.0.2.2';
      }
      return 'localhost';
    }
    
    // For physical devices, use the server IP
    return SERVER_IP;
  },

  // API Base URL
  get API_BASE_URL() {
    return `http://${this.apiHost}:${SERVER_PORT}/api`;
  },

  // Media/Video streaming URL  
  get MEDIA_BASE_URL() {
    return `http://${this.apiHost}:${MEDIA_PORT}`;
  },

  // WebSocket URL (for real-time features)
  get WS_URL() {
    return `ws://${this.apiHost}:${SERVER_PORT}`;
  },

  // Ollama URL (for local AI)
  get OLLAMA_URL() {
    return `http://${this.apiHost}:11434`;
  },

  // Production URLs (when deploying)
  production: {
    API_BASE_URL: 'https://api.gyanbrige.com/api',
    MEDIA_BASE_URL: 'https://media.gyanbrige.com',
    WS_URL: 'wss://api.gyanbrige.com',
  },

  // Helper to get the right URL based on environment
  getApiUrl() {
    return __DEV__ ? this.API_BASE_URL : this.production.API_BASE_URL;
  },

  getMediaUrl() {
    return __DEV__ ? this.MEDIA_BASE_URL : this.production.MEDIA_BASE_URL;
  },

  getWsUrl() {
    return __DEV__ ? this.WS_URL : this.production.WS_URL;
  },

  // Current server IP (for display in settings)
  getServerIP() {
    return SERVER_IP;
  },

  getServerPort() {
    return SERVER_PORT;
  },

  // Check connectivity to the server
  async checkConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.getApiUrl()}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.log('[Network] Connection check failed:', error.message);
      return false;
    }
  },

  // Get full URL for a video/media file
  getMediaFileUrl(path) {
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${this.getMediaUrl()}/${cleanPath}`;
  },

  // Get HLS stream URL
  getHlsStreamUrl(videoId) {
    return `${this.getMediaUrl()}/videos/${videoId}/master.m3u8`;
  },

  // Debug info
  getDebugInfo() {
    return {
      serverIP: SERVER_IP,
      serverPort: SERVER_PORT,
      mediaPort: MEDIA_PORT,
      isSimulator: this.isSimulator,
      isExpoGo: this.isExpoGo,
      platform: Platform.OS,
      apiUrl: this.getApiUrl(),
      mediaUrl: this.getMediaUrl(),
      isDev: __DEV__,
    };
  },
};

export default NetworkConfig;

// Named exports for convenience
export const API_BASE_URL = NetworkConfig.getApiUrl();
export const MEDIA_BASE_URL = NetworkConfig.getMediaUrl();
export const WS_URL = NetworkConfig.getWsUrl();
export const OLLAMA_URL = NetworkConfig.OLLAMA_URL;
