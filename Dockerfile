FROM node:22-bookworm-slim

WORKDIR /app

# Environment configuration
# Limit Node's memory if on Render Free tier, though it's much lighter now
ENV NODE_OPTIONS="--max-old-space-size=256"

# Copy dependency definitions and install all packages
COPY package*.json ./
RUN npm install
  
# Copy project source files
COPY . .

# Build the React frontend
RUN npm run build

# Set production environment
ENV NODE_ENV=production

EXPOSE 3000

# Container healthcheck using Node.js instead of curl to save space
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
