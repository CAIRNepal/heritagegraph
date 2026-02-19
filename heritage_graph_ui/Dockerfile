# ================================================================
# Multi-stage build for Next.js Frontend (heritage_graph_ui)
# ================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install production dependencies
RUN npm ci --only=production 2>/dev/null || npm install --only=production

# ================================================================
# Stage 2: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all deps (including dev)
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm ci 2>/dev/null || npm install

# Copy source code
COPY . .

# Build-time arguments (for Next.js to pick up env variables during build)
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET
ARG GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_SECRET
ARG NEXT_PUBLIC_API_URL

# Set build-time environment variables (placeholders so build doesn't fail;
# real values are injected at runtime via docker-compose environment)
ENV NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-build-placeholder}
ENV GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-build-placeholder}
ENV GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-build-placeholder}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000}

# Build Next.js app
RUN npm run build

# ================================================================
# Stage 3: Runtime
FROM node:20-alpine AS runner

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

WORKDIR /app

# Set environment
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Runtime environment variables (overridable at container start)
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
ENV GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET

# Copy package.json
COPY package.json ./

# Copy production dependencies from standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start the standalone server
CMD ["node", "server.js"]