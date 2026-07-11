# ========================================
# Multi-stage Dockerfile for Mazaya
# Optimized for low-RAM servers (2GB)
# Uses Prisma for database access
# ========================================

# syntax=docker/dockerfile:1.7

# 1. Base
FROM node:20-alpine AS base
WORKDIR /app

# 2. Dependencies — separate layer for better caching
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
# Limit Node memory during install (1GB cap)
ENV NODE_OPTIONS="--max-old-space-size=1024"
# Install deps (skip postinstall - Prisma generate will run in builder)
RUN npm ci --ignore-scripts

# 3. Builder — compile the Next.js app (most RAM-intensive step)
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Cap memory at 1.3GB so the 2GB droplet + swap doesn't OOM
ENV NODE_OPTIONS="--max-old-space-size=1280"
RUN npx prisma generate && npm run build

# 4. Runner (production) — tiny final image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Lower cap in production (~110-150MB RAM)
ENV NODE_OPTIONS="--max-old-space-size=512"

# Install OpenSSL 3.x runtime libs (Prisma binary targets linux-musl-openssl-3.0.x)
# Alpine 3.19+ ships with openssl 3.x natively, just need the runtime
RUN apk add --no-cache openssl libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs ; adduser --system --uid 1001 nextjs

# Copy generated Prisma client so it's available at runtime
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
# Copy Prisma CLI and migrations for running migrate deploy on startup
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy built standalone app (smaller than full build)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --accept-data-loss 2>/dev/null; ./node_modules/.bin/prisma migrate deploy 2>/dev/null || echo 'Migrations skipped or already applied'; HOSTNAME=0.0.0.0 node server.js"]