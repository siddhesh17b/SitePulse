# ==========================================
# SitePulse Unified Production Dockerfile
# ==========================================

# 1. Build Dashboard Stage
FROM node:20-alpine AS dashboard-builder
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ ./
RUN npm run build

# 2. Production Runner Stage
FROM node:20-alpine
WORKDIR /app

# Install dependencies for Prisma & Postgres client
RUN apk add --no-cache openssl

# Set Production Environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy and install backend dependencies
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

# Copy Prisma schema and generate client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Copy backend source code
COPY backend/src ./src

# Copy Embed Widget
COPY widget /app/widget

# Copy built dashboard from stage 1 into dashboard/dist
COPY --from=dashboard-builder /app/dashboard/dist /app/dashboard/dist

# Expose single unified port
EXPOSE 5000

# Entrypoint script with automatic database readiness retry loop and startup
CMD ["sh", "-c", "ATTEMPTS=0; until npx prisma db push --skip-generate || [ $ATTEMPTS -ge 5 ]; do ATTEMPTS=$((ATTEMPTS+1)); echo \"Waiting for database connection ($ATTEMPTS/5)...\"; sleep 3; done; node src/server.js"]
