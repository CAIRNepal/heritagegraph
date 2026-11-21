# HeritageGraph marketing landing (Next.js standalone)
FROM node:20-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY . .
ARG NEXT_PUBLIC_APP_URL=http://frontend.localhost
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_URL=http://backend.localhost
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:20-alpine AS runner
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone/ ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000 || exit 1
CMD ["node", "server.js"]
