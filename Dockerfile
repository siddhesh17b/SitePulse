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

# Copy Demo Site
COPY demo-site /app/demo-site

# Copy built dashboard from stage 1 into dashboard/dist
COPY --from=dashboard-builder /app/dashboard/dist /app/dashboard/dist

# Expose single unified port
EXPOSE 5000

# Entrypoint script to run migrations and start server
CMD ["sh", "-c", "npx prisma db push && node src/server.js"]
