# Multi-stage build for HRV Analysis App
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Build the frontend
FROM base AS frontend-builder
WORKDIR /app

# Copy frontend files
COPY frontend/ ./frontend/
COPY --from=deps /app/node_modules ./node_modules

# Install frontend dependencies and build
WORKDIR /app/frontend
RUN npm ci
RUN npm run build

# Build the backend
FROM base AS backend-builder
WORKDIR /app

# Copy backend files
COPY backend/ ./backend/
COPY --from=deps /app/node_modules ./node_modules

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built applications
COPY --from=frontend-builder --chown=nextjs:nodejs /app/frontend/dist ./frontend/dist
COPY --from=backend-builder --chown=nextjs:nodejs /app/backend ./backend
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy environment files
COPY frontend/env.production ./frontend/.env.production
COPY backend/env.production ./backend/.env.production

# Switch to non-root user
USER nextjs

# Expose ports
EXPOSE 3001 5000

# Start both frontend and backend
CMD ["sh", "-c", "cd backend && npm start & cd frontend && npm run preview"] 