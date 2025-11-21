# Smart LMS Frontend

Cross-platform mobile and web app for Smart LMS built with React Native and Expo.

## Features

- Video recording with camera
- Video upload from device
- HLS video playback with adaptive quality
- AI-generated notes viewer
- Real-time updates via Socket.IO
- Material Design UI
- Android, iOS, and Web support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update API URLs:
   - Edit `src/services/api.js`
   - Edit `src/services/socket.js`
   - Replace `192.168.1.100` with your LAN IP

3. Start development server:
```bash
npm start
```

4. Run on platforms:
```bash
npm run android  # Android
npm run ios      # iOS
npm run web      # Web
```

## Building

### Android APK:
```bash
eas build -p android --profile preview
```

### iOS IPA:
```bash
eas build -p ios --profile preview
```

### Production builds:
```bash
eas build -p android --profile production
eas build -p ios --profile production
```

## Configuration

### Update Backend URL
In `src/services/api.js` and `src/services/socket.js`, update:
```javascript
const API_BASE_URL = 'http://YOUR_IP:5000/api';
const SOCKET_URL = 'http://YOUR_IP:5000';
```

Find your IP from backend console output or using:
- macOS/Linux: `ifconfig | grep "inet "`
- Windows: `ipconfig`

## Screens

- **LoginScreen**: User authentication
- **HomeScreen**: Video list with real-time updates
- **UploadScreen**: Upload pre-recorded videos
- **RecordScreen**: Record videos with camera
- **VideoPlayerScreen**: HLS video playback
- **NotesScreen**: View AI-generated notes
