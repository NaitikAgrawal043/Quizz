# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars required by Next.js (public vars baked into client bundle)
# Add any NEXT_PUBLIC_* vars here if needed in the future
# ARG NEXT_PUBLIC_EXAMPLE
# ENV NEXT_PUBLIC_EXAMPLE=$NEXT_PUBLIC_EXAMPLE

RUN npm run build

# ---- Production ----
FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.ts ./next.config.ts

USER nextjs

EXPOSE 3000

# Use tsx to run the custom server (Socket.io + Next.js)
CMD ["npx", "tsx", "src/server.ts"]
