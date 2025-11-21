# Docker Deployment Guide

Complete guide for running Smart LMS backend with Docker.

## What's Included

The Docker setup includes:
- **MongoDB 7.0** with replica set (required for change streams)
- **Ollama** with Llama 3 model for AI notes
- **FFmpeg** for video processing
- **Node.js backend** application
- **Persistent volumes** for data storage

## Quick Start

```bash
cd backend
./docker-setup.sh
```

## Architecture

```
┌─────────────────────────────────────────────┐
│           Docker Compose Stack              │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐    ┌──────────────┐      │
│  │   Backend    │───▶│   MongoDB    │      │
│  │  (Node.js)   │    │  (Replica)   │      │
│  └──────┬───────┘    └──────────────┘      │
│         │                                   │
│         │            ┌──────────────┐      │
│         └───────────▶│    Ollama    │      │
│                      │   (Llama 3)  │      │
│                      └──────────────┘      │
│                                             │
└─────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
    Port 5000            Port 27017
    Port 11434
```

## Services

### 1. MongoDB (mongodb)
- **Image**: mongo:7.0
- **Port**: 27017
- **Features**: 
  - Replica set enabled (rs0)
  - Change streams for real-time sync
  - Persistent data storage

### 2. MongoDB Init (mongodb-init)
- **Purpose**: Initializes replica set on first run
- **Runs once**: Exits after setup

### 3. Ollama (ollama)
- **Image**: ollama/ollama:latest
- **Port**: 11434
- **Model**: Llama 3 (~4.7GB)
- **Features**: AI notes generation

### 4. Ollama Setup (ollama-setup)
- **Purpose**: Downloads Llama 3 model on first run
- **Runs once**: Exits after download

### 5. Backend (backend)
- **Built from**: Dockerfile
- **Port**: 5000
- **Includes**: Node.js, FFmpeg, application code
- **Features**: 
  - Hot reload for development
  - Video processing
  - API endpoints

## Docker Commands

### Basic Operations

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f mongodb
docker compose logs -f ollama

# Restart a service
docker compose restart backend

# Rebuild and restart
docker compose up -d --build
```

### Service Management

```bash
# Check service status
docker compose ps

# Stop a specific service
docker compose stop backend

# Start a specific service
docker compose start backend

# Remove stopped containers
docker compose rm
```

### Data Management

```bash
# Remove everything including volumes (⚠️ DELETES DATA)
docker compose down -v

# Backup MongoDB data
docker exec smart-lms-mongodb mongodump --out /tmp/backup
docker cp smart-lms-mongodb:/tmp/backup ./mongodb-backup

# Restore MongoDB data
docker cp ./mongodb-backup smart-lms-mongodb:/tmp/backup
docker exec smart-lms-mongodb mongorestore /tmp/backup
```

### Debugging

```bash
# Enter backend container shell
docker exec -it smart-lms-backend bash

# Enter MongoDB shell
docker exec -it smart-lms-mongodb mongosh

# Check Ollama models
docker exec -it smart-lms-ollama ollama list

# View resource usage
docker stats

# Inspect a container
docker inspect smart-lms-backend
```

## Volumes

Persistent data is stored in Docker volumes:

```bash
# List volumes
docker volume ls

# Inspect a volume
docker volume inspect backend_mongodb_data

# Remove unused volumes
docker volume prune
```

**Volumes used:**
- `mongodb_data` - MongoDB database files
- `mongodb_config` - MongoDB configuration
- `ollama_data` - Ollama models (~4.7GB)

**Bind mounts:**
- `./src` - Backend source code (hot reload)
- `./uploads` - Video uploads
- `./public` - Processed videos

## Environment Variables

Configured in `docker-compose.yml`:

```yaml
- NODE_ENV=development
- PORT=5000
- HOST=0.0.0.0
- MONGODB_URI=mongodb://mongodb:27017/smart_lms?replicaSet=rs0
- OLLAMA_API_URL=http://ollama:11434
- JWT_SECRET=your_secret_key_change_this_in_production
- VIDEO_UPLOAD_PATH=/app/uploads/videos
- VIDEO_OUTPUT_PATH=/app/public/videos
- HLS_SEGMENT_DURATION=10
```

To override, create `.env` file or modify `docker-compose.yml`.

## Network Access

### Localhost
- Backend: http://localhost:5000
- MongoDB: mongodb://localhost:27017
- Ollama: http://localhost:11434

### LAN Access
The backend binds to `0.0.0.0`, making it accessible on your local network.

Find your LAN IP:
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr IPv4
```

Then access from other devices:
- http://YOUR_IP:5000

## Troubleshooting

### Port Already in Use

```bash
# Find what's using port 5000
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill the process or change port in docker-compose.yml
```

### MongoDB Replica Set Issues

```bash
# Check replica set status
docker exec -it smart-lms-mongodb mongosh --eval "rs.status()"

# Reinitialize replica set
docker compose down
docker volume rm backend_mongodb_data
docker compose up -d
```

### Ollama Model Not Loading

```bash
# Check if model is downloaded
docker exec -it smart-lms-ollama ollama list

# Manually pull model
docker exec -it smart-lms-ollama ollama pull llama3

# Check Ollama logs
docker compose logs ollama
```

### Backend Not Starting

```bash
# Check logs
docker compose logs backend

# Rebuild container
docker compose up -d --build backend

# Check if MongoDB is ready
docker compose ps
```

### Out of Disk Space

Ollama model is large (~4.7GB). Check available space:

```bash
docker system df

# Clean up unused resources
docker system prune -a
docker volume prune
```

## Production Deployment

### Security Considerations

1. **Change JWT Secret**:
   ```yaml
   - JWT_SECRET=use_a_strong_random_secret_here
   ```

2. **Use Environment Variables**:
   Create `.env` file instead of hardcoding secrets

3. **Enable Authentication on MongoDB**:
   Add username/password to MongoDB

4. **Use HTTPS**:
   Set up reverse proxy (nginx/traefik) with SSL

5. **Limit Network Exposure**:
   Remove port mappings and use internal Docker network

### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  mongodb:
    # ... same config ...
    # Remove ports: mapping for security
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}

  backend:
    # ... same config ...
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - MONGODB_URI=mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/smart_lms?authSource=admin&replicaSet=rs0
    # Remove port mapping, use nginx proxy
    expose:
      - "5000"
```

Run with:
```bash
docker compose -f docker-compose.prod.yml up -d
```

## Health Checks

Services include health checks:

```bash
# Check health status
docker compose ps

# Manual health check
curl http://localhost:5000/api/health
curl http://localhost:11434/api/tags
```

## Logs

Logs are stored in containers and can be viewed with:

```bash
# View last 100 lines
docker compose logs --tail=100

# Follow logs
docker compose logs -f

# Since specific time
docker compose logs --since 30m

# Export logs
docker compose logs > logs.txt
```

## Backup Strategy

### Automated Backup Script

Create `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Backup MongoDB
docker exec smart-lms-mongodb mongodump --out /tmp/backup
docker cp smart-lms-mongodb:/tmp/backup "$BACKUP_DIR/mongodb"

# Backup videos
cp -r ./uploads "$BACKUP_DIR/"
cp -r ./public "$BACKUP_DIR/"

echo "Backup completed: $BACKUP_DIR"
```

### Scheduled Backups

Add to crontab:
```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/backend && ./backup.sh
```

## Monitoring

### Resource Usage

```bash
# Real-time stats
docker stats

# Container resource limits
docker compose config
```

### Set Resource Limits

In `docker-compose.yml`:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 1G
```

## Updates

### Update Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build backend
```

### Update Docker Images

```bash
# Pull latest images
docker compose pull

# Restart with new images
docker compose up -d
```

### Update Ollama Model

```bash
docker exec -it smart-lms-ollama ollama pull llama3
docker compose restart backend
```

## Clean Up

```bash
# Remove everything
docker compose down -v

# Remove orphaned containers
docker compose down --remove-orphans

# Full system cleanup
docker system prune -a --volumes
```

## Support

If you encounter issues:

1. Check logs: `docker compose logs -f`
2. Verify services are healthy: `docker compose ps`
3. Check network connectivity: `docker network inspect backend_smart-lms-network`
4. Restart services: `docker compose restart`
5. Rebuild if needed: `docker compose up -d --build`

For more help, see main README.md or open an issue.
