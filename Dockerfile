FROM node:22-bookworm-slim

# Install system dependencies (curl, ffmpeg, python3, deno runtime for yt-dlp JS execution)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl unzip python3 python3-pip ffmpeg ca-certificates && \
    curl -fsSL https://deno.land/install.sh | sh && \
    pip3 install --break-system-packages --no-cache-dir --upgrade "yt-dlp[default]" && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Environment configuration
ENV PATH="/root/.deno/bin:/usr/local/bin:${PATH}"
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV YTDLP_JS_RUNTIME=deno
ENV AUDIO_CACHE_LIMIT=50

# Copy dependency definitions and install all packages
COPY package*.json ./
RUN npm install
  
# Copy project source files
COPY . .

# Build the React frontend
RUN npm run build

# Set production environment
ENV NODE_ENV=production

# Ensure audio cache directory exists
RUN mkdir -p /app/audio-cache

EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/api/health || exit 1

CMD ["node", "server.js"]
