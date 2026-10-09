# Multi-stage production Dockerfile for RefundGuard AI
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and service package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm run setup

# Copy application source code
COPY . .

# Generate data fixtures and build frontend bundle
RUN npm run data:generate
RUN npm run build --prefix frontend

# Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Copy built application and node_modules from builder
COPY --from=builder /app /app

EXPOSE 5000

CMD ["node", "backend/server.js"]
