FROM node:22-bookworm-slim

WORKDIR /app

# Copy dependency definitions and install all packages
COPY package*.json ./
RUN npm install
  
# Copy project source files
COPY . .

# Build the React frontend
RUN npm run build

# Remove development dependencies to keep the image lightweight
RUN npm prune --omit=dev

# Set production environment and runtime memory limit
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=256"

EXPOSE 3000

# Container healthcheck using Node.js instead of curl to save space
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
