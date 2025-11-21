FROM node:18-bullseye

# Install FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Create directories for uploads and videos
RUN mkdir -p uploads/videos public/videos

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "run", "dev"]
