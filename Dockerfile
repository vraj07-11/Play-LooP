FROM node:22-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl unzip python3 python3-pip ffmpeg ca-certificates && \
    curl -fsSL https://deno.land/install.sh | sh && \
    pip3 install --break-system-packages "yt-dlp[default]" && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV YTDLP_PATH=/usr/local/bin/yt-dlp
ENV YTDLP_JS_RUNTIME=deno
ENV YTDLP_REMOTE_COMPONENTS=ejs:github
ENV PATH="/root/.deno/bin:${PATH}"

EXPOSE 3000

CMD ["npm", "start"]
