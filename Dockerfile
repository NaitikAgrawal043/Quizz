FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npx tsc src/server.ts src/lib/redis.ts \
    --outDir dist-server \
    --rootDir src \
    --module commonjs \
    --target ES2020 \
    --moduleResolution node \
    --esModuleInterop \
    --skipLibCheck

FROM node:20-alpine AS runtime-deps
WORKDIR /runtime
RUN npm init -y && \
    npm install socket.io@4.8.3 ioredis@5.8.2 --omit=dev --ignore-scripts --no-audit --no-fund

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/dist-server ./dist-server
COPY --from=runtime-deps --chown=nextjs:nodejs /runtime/node_modules ./node_modules
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
CMD ["node", "dist-server/server.js"]
