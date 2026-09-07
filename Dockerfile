# Multi-stage modern Dockerfile for ztncui (ZeroTier Network Controller UI)

# Stage 1: Build Frontend SPA
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Native Node Addons
FROM node:20-alpine AS backend-builder
WORKDIR /app/src
RUN apk add --no-cache python3 make g++ gcc
COPY src/package*.json ./
RUN npm install --omit=dev

# Stage 3: Production Runtime
FROM node:20-alpine
WORKDIR /app

# Install minimal runtime utilities
RUN apk add --no-cache curl ca-certificates

# Copy node_modules, application code, and compiled frontend SPA
COPY --from=backend-builder /app/src/node_modules ./node_modules
COPY src/ ./
COPY --from=frontend-builder /app/src/dist ./dist

# Ensure default password and storage directories exist
RUN mkdir -p etc/storage etc/tls \
    && cp etc/default.passwd etc/passwd 2>/dev/null || true

# Default environment configuration
ENV NODE_ENV=production \
    HTTP_PORT=3000 \
    HTTP_ALL_INTERFACES=yes \
    ZT_ADDR=localhost:9993

# Expose Web port
EXPOSE 3000

# Persistent storage for users, passwords, and member nicknames
VOLUME ["/app/etc"]

CMD ["npm", "start"]
