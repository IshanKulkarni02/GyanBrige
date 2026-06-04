import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'GyanBrige',
  slug: 'gyanbrige',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'gyanbrige',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.gyanbrige.app',
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription: 'Used for QR scanning and proctored tests.',
      NSMicrophoneUsageDescription: 'Used for voice notes and live lectures.',
      NSLocationWhenInUseUsageDescription:
        'Used to verify campus Wi-Fi presence for attendance.',
      NFCReaderUsageDescription: 'Used to mark attendance via classroom NFC tags.',
    },
  },
  android: {
    package: 'com.gyanbrige.app',
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'NFC',
      'ACCESS_WIFI_STATE',
      'ACCESS_NETWORK_STATE',
      'ACCESS_FINE_LOCATION',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
  },
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
    realtimeUrl: process.env.EXPO_PUBLIC_REALTIME_URL ?? 'ws://localhost:4002',
    transcriptionUrl:
      process.env.EXPO_PUBLIC_TRANSCRIPTION_URL ?? 'http://localhost:4001',
    livekitUrl: process.env.EXPO_PUBLIC_LIVEKIT_URL ?? 'ws://localhost:7880',
  },
};

export default config;
