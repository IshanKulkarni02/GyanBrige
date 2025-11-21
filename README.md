# GyanBrige - Your Personal Bridge to Learning

A full-stack Learning Management System with AI-powered notes generation, HLS video streaming, and cross-platform support (Android, iOS, Web).

**GyanBrige** means "Knowledge Bridge" in Hindi - connecting learners with knowledge through smart technology.

## Features

1. **Video Recording & Streaming**
   - Record videos directly in the app
   - Upload pre-recorded videos
   - HLS streaming with multiple quality options (360p, 480p, 720p, 1080p)
   - 10-second segment loading for efficient streaming
   - FFmpeg-powered video processing

2. **AI-Generated Notes**
   - Automatic notes generation using Ollama and Llama 3
   - Comprehensive study notes with summaries and key points
   - Real-time generation updates

3. **Cross-Platform**
   - React Native for mobile (Android & iOS)
   - Web support via Expo Web
   - APK and IPA builds

4. **Real-Time Sync**
   - MongoDB with instant sync across devices
   - Socket.IO for real-time updates
   - Database change streams

5. **LAN Access**
   - Run on local network
   - Access from multiple devices on same network

## Tech Stack

### Backend
- Node.js & Express
- MongoDB with Change Streams
- FFmpeg for video processing
- Ollama & Llama 3 for AI notes
- Socket.IO for real-time updates
- HLS video streaming

### Frontend
- React Native with Expo
- React Navigation
- React Native Paper (Material Design)
- Expo AV for video playback
- Expo Camera for recording
- Socket.IO client

## Setup Instructions

### Option 1: Docker Setup (Recommended) 🐳

The easiest way to get started! Docker handles MongoDB, Ollama, FFmpeg, and the backend automatically.

#### Prerequisites
- Docker Desktop ([Download here](https://www.docker.com/get-started))
- Node.js for frontend only

#### Backend with Docker

1. Navigate to backend directory:
```bash
cd backend
```

2. Run the setup script:
```bash
./docker-setup.sh
```

That's it! The script will:
- ✅ Start MongoDB with replica set
- ✅ Start Ollama and download Llama 3 model (~4.7GB)
- ✅ Install FFmpeg in container
- ✅ Build and start the backend
- ✅ Display your LAN IP addresses

**Access Points:**
- Backend API: http://localhost:5000
- MongoDB: mongodb://localhost:27017
- Ollama: http://localhost:11434

**Useful Docker Commands:**
```bash
# View logs
docker compose logs -f

# Stop services
docker compose down

# Restart
docker compose restart
```

#### Frontend Setup (Same as Manual)

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Update API URLs in `src/services/api.js` and `src/services/socket.js`:
   - Use `http://localhost:5000` for local testing
   - Or use your LAN IP (displayed by docker-setup.sh) for network access

4. Start Expo:
```bash
npm start
```

---

### Option 2: Manual Setup (Without Docker)

#### Prerequisites
- Node.js (v18+)
- MongoDB (v5+)
- FFmpeg installed on system
- Ollama installed with Llama 3 model
- Expo CLI (for mobile development)

#### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Install FFmpeg (if not installed):
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

4. Install and setup Ollama with Llama 3:
```bash
# Install Ollama from https://ollama.ai
# Pull Llama 3 model
ollama pull llama3
```

5. Create `.env` file:
```bash
cp .env.example .env
```

6. Update `.env` with your settings:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart_lms
OLLAMA_API_URL=http://localhost:11434
JWT_SECRET=your_secret_key_here
HOST=0.0.0.0
```

7. Start MongoDB:
```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

8. Start backend server:
```bash
npm run dev
```

The server will display LAN IP addresses for network access.

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Update API URLs in `src/services/api.js` and `src/services/socket.js`:
   - Replace `192.168.1.100` with your actual LAN IP address
   - You can find it in the backend console output

4. Start Expo development server:
```bash
npm start
```

5. Run on specific platforms:
```bash
# Android
npm run android

# iOS
npm run ios

# Web
npm run web
```

## Building APK & IPA

### Install EAS CLI:
```bash
npm install -g eas-cli
```

### Login to Expo:
```bash
eas login
```

### Build Android APK:
```bash
cd frontend
eas build -p android --profile preview
```

### Build iOS IPA:
```bash
cd frontend
eas build -p ios --profile preview
```

The builds will be available in your Expo dashboard.

## LAN Access

### Finding Your Local IP:

**macOS/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```bash
ipconfig | findstr IPv4
```

### Accessing from Other Devices:

1. Ensure all devices are on the same network
2. Start backend server (it will show available IPs)
3. Update frontend API URLs with the shown IP
4. On mobile devices:
   - Scan QR code from Expo
   - Or enter the URL manually: `exp://YOUR_IP:8081`

## Usage

1. **Login**: Use any email/password (demo mode)

2. **Upload Video**:
   - Go to "Upload" tab
   - Select a video file
   - Add title and description
   - Upload and wait for processing

3. **Record Video**:
   - Go to "Record" tab
   - Enter title
   - Tap "Start Recording"
   - Record your video
   - Tap "Stop Recording" to upload

4. **Watch Videos**:
   - View all videos on Home screen
   - Tap a video to watch
   - Adaptive quality selection
   - View AI-generated notes

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Videos
- `GET /api/videos` - Get all videos
- `GET /api/videos/:videoId` - Get single video
- `POST /api/videos/upload` - Upload video
- `DELETE /api/videos/:videoId` - Delete video

### Notes
- `GET /api/notes/video/:videoId` - Get notes for video
- `POST /api/notes/regenerate/:videoId` - Regenerate notes

### Health
- `GET /api/health` - Check server health and network info

## Directory Structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Video.js
│   │   │   └── Notes.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── videoRoutes.js
│   │   │   └── notesRoutes.js
│   │   ├── services/
│   │   │   ├── videoService.js
│   │   │   └── ollamaService.js
│   │   ├── middleware/
│   │   └── server.js
│   ├── public/videos/
│   ├── uploads/videos/
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── screens/
    │   │   ├── HomeScreen.js
    │   │   ├── VideoPlayerScreen.js
    │   │   ├── UploadScreen.js
    │   │   ├── RecordScreen.js
    │   │   ├── NotesScreen.js
    │   │   └── LoginScreen.js
    │   ├── services/
    │   │   ├── api.js
    │   │   └── socket.js
    │   ├── components/
    │   ├── navigation/
    │   └── assets/
    ├── App.js
    ├── app.json
    ├── eas.json
    └── package.json
```

## Troubleshooting

### Video Processing Issues
- Ensure FFmpeg is installed: `ffmpeg -version`
- Check file permissions on upload/public directories
- Monitor backend logs for processing errors

### Ollama Connection Issues
- Verify Ollama is running: `ollama list`
- Check Ollama API URL in `.env`
- Ensure Llama 3 model is pulled: `ollama pull llama3`

### Network Issues
- Verify devices are on same network
- Check firewall settings
- Ensure ports 5000 and 8081 are not blocked

### MongoDB Issues
- Check MongoDB is running: `mongosh`
- Verify connection string in `.env`
- Check MongoDB logs for errors

## License

MIT

## Contributing

Pull requests are welcome. For major changes, please open an issue first.
