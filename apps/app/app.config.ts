import type { ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_ENV === 'development' || process.env.NODE_ENV !== 'production';

const config: ExpoConfig = {
  name: IS_DEV ? 'GyanBrige (Dev)' : 'GyanBrige',
  slug: 'gyanbrige',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'gyanbrige',
  userInterfaceStyle: 'automatic',

  ios: {
    bundleIdentifier: IS_DEV ? 'com.gyanbrige.app.dev' : 'com.gyanbrige.app',
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
    package: IS_DEV ? 'com.gyanbrige.app.dev' : 'com.gyanbrige.app',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    permissions: [
      'CAMERA',
      'RECORD_AUDIO',
      'NFC',
      'ACCESS_WIFI_STATE',
      'ACCESS_NETWORK_STATE',
      'ACCESS_FINE_LOCATION',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
    ],
  },

  web: {
    bundler: 'metro',
    output: 'single',
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission: 'Used for QR scanning and proctored tests.',
        microphonePermission: 'Used for voice notes and live lectures.',
      },
    ],
    [
      'expo-document-picker',
      { iCloudContainerEnvironment: 'Production' },
    ],
  ],

  experiments: { typedRoutes: true },

  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
    realtimeUrl: process.env.EXPO_PUBLIC_REALTIME_URL ?? 'ws://localhost:4002',
    transcriptionUrl:
      process.env.EXPO_PUBLIC_TRANSCRIPTION_URL ?? 'http://localhost:4001',
    livekitUrl: process.env.EXPO_PUBLIC_LIVEKIT_URL ?? 'ws://localhost:7880',
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? '',
    },
  },
};

export default config;
