# syntax=docker/dockerfile:1
#
# Multi-stage build. The runtime image carries only production dependencies, the compiled
# output and the generated Prisma client - no source, no dev tooling, no test files.

# ---------------------------------------------------------------------------
# Stage 1: install every dependency (dev included) for the build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Prisma's engines need OpenSSL on Alpine.
RUN apk add --no-cache openssl

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000

# ---------------------------------------------------------------------------
# Stage 2: generate the Prisma client and compile TypeScript
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY package.json yarn.lock tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

RUN yarn prisma generate
RUN yarn build

# Strip dev dependencies in place, keeping the generated Prisma client that lives inside
# node_modules/.prisma and node_modules/@prisma/client.
RUN yarn install --frozen-lockfile --production --network-timeout 600000 \
  && yarn cache clean

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl curl \
  && addgroup -g 1001 -S nodejs \
  && adduser -S -u 1001 -G nodejs nestjs

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
# The schema and migrations ship with the image so `prisma migrate deploy` can be run as a
# release command on the host platform. prisma/data is included so the seed can be run
# deliberately against a fresh database.
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Never run as root.
USER nestjs

EXPOSE 3000

# The platform's own health check should hit this too - it includes a database round-trip.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/v1/health" || exit 1

# Direct node, not yarn: yarn would sit between the platform's SIGTERM and the process,
# and Nest's shutdown hooks need that signal to close the database pool cleanly.
CMD ["node", "dist/main.js"]
