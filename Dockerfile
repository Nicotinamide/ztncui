# Multi-stage modern Dockerfile for ztncui (ZeroTier Network Controller UI)
FROM node:20-alpine AS builder

WORKDIR /app/src

# Install build dependencies for argon2 native addon
RUN apk add --no-cache python3 make g++ gcc

# Install dependencies
COPY src/package.json ./
RUN npm install --omit=dev

# Final runtime image
FROM node:20-alpine

WORKDIR /app

# Install minimal runtime utilities
RUN apk add --no-cache curl ca-certificates

# Copy node_modules and application code
COPY --from=builder /app/src/node_modules ./node_modules
COPY src/ ./

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
