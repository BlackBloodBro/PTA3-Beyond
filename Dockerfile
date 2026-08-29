# Multi-stage build for the Next.js app. The backend (Postgres/Auth/RLS) is Supabase Cloud, not
# self-hosted -- this image only ever needs to run the Next.js server and reach out to Supabase's
# API over the network, using the two NEXT_PUBLIC_* values baked in at build time below.

FROM node:20-alpine AS base
RUN corepack enable

# --- deps: install dependencies from the committed pnpm-lock.yaml only (no lockfile drift) ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- builder: build the app. NEXT_PUBLIC_* vars are inlined into the client bundle at this step,
# so they must be supplied as build args here -- setting them only at `docker run` time is too late. ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# --- runner: minimal final image, just the standalone server output ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
