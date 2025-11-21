#!/bin/bash

echo "🐳 Setting up Smart LMS Backend with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://www.docker.com/get-started"
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please update Docker."
    exit 1
fi

echo "✅ Docker is installed"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p uploads/videos
mkdir -p public/videos

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker compose down

# Build and start services
echo "🚀 Building and starting services..."
docker compose up -d --build

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service status
echo ""
echo "📊 Service Status:"
docker compose ps

# Get container logs
echo ""
echo "📝 Checking logs..."
docker compose logs --tail=20

# Display network information
echo ""
echo "🌐 Network Information:"
echo "Backend API: http://localhost:5000"
echo "MongoDB: mongodb://localhost:27017"
echo "Ollama: http://localhost:11434"
echo ""

# Get local IP addresses
if command -v ipconfig &> /dev/null; then
    # Windows
    echo "LAN IP addresses:"
    ipconfig | grep "IPv4" | grep -v "127.0.0.1"
elif command -v ifconfig &> /dev/null; then
    # macOS/Linux
    echo "LAN IP addresses:"
    ifconfig | grep "inet " | grep -v "127.0.0.1" | awk '{print "  http://"$2":5000"}'
else
    echo "Your IP: $(hostname -I | awk '{print $1}')"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Commands:"
echo "  View logs:        docker compose logs -f"
echo "  Stop services:    docker compose down"
echo "  Restart services: docker compose restart"
echo "  Remove all:       docker compose down -v"
echo ""
