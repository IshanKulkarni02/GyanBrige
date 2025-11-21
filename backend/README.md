# Smart LMS Backend

Backend server for Smart LMS with video processing, AI notes generation, and real-time sync.

## Features

- HLS video streaming with multiple quality options
- FFmpeg video processing with 10-second segments
- AI notes generation using Ollama & Llama 3
- MongoDB with real-time change streams
- Socket.IO for real-time updates
- JWT authentication
- LAN network access
- **Docker support** for easy deployment

## Quick Start with Docker (Recommended)

### Prerequisites
- Docker Desktop installed ([Download here](https://www.docker.com/get-started))

### Run with Docker

1. Navigate to backend directory:
```bash
cd backend
```

2. Run the setup script:
```bash
./docker-setup.sh
```

That's it! The script will:
- Start MongoDB with replica set (for change streams)
- Start Ollama and pull Llama 3 model
- Build and start the backend application
- Display LAN IP addresses

### Docker Commands

```bash
# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f mongodb
docker compose logs -f ollama

# Stop all services
docker compose down

# Restart services
docker compose restart

# Remove everything (including volumes)
docker compose down -v

# Rebuild and restart
docker compose up -d --build
```

### Access Points
- **Backend API**: http://localhost:5000
- **MongoDB**: mongodb://localhost:27017
- **Ollama**: http://localhost:11434

## Manual Setup (Without Docker)

1. Install dependencies:
```bash
npm install
```

2. Install system requirements:
```bash
# FFmpeg
brew install ffmpeg  # macOS
sudo apt install ffmpeg  # Ubuntu

# Ollama with Llama 3
# Download from https://ollama.ai
ollama pull llama3
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Start MongoDB:
```bash
brew services start mongodb-community  # macOS
sudo systemctl start mongod  # Linux
```

5. Run server:
```bash
npm run dev
```

## Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart_lms
OLLAMA_API_URL=http://localhost:11434
JWT_SECRET=your_secret_key
HOST=0.0.0.0
VIDEO_UPLOAD_PATH=./uploads/videos
VIDEO_OUTPUT_PATH=./public/videos
HLS_SEGMENT_DURATION=10
```

## API Documentation

See main README.md for full API documentation.
