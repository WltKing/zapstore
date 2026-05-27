# Dockerfile multi-purpose pro EasyPanel.
# A mesma imagem builda web + api + worker; o container escolhe qual rodar via APP_TYPE.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate
WORKDIR /app

# --- deps: instala deps pro monorepo inteiro ---
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/
COPY packages/llm/package.json ./packages/llm/
COPY packages/whatsapp/package.json ./packages/whatsapp/
COPY packages/payment/package.json ./packages/payment/
COPY packages/prompts/package.json ./packages/prompts/
COPY packages/engine/package.json ./packages/engine/
RUN pnpm install --frozen-lockfile

# --- builder: copia tudo e builda os 3 apps + prisma client ---
FROM deps AS builder
COPY packages ./packages
COPY apps ./apps
RUN pnpm --filter @zapstore/db prisma generate
RUN pnpm -r --filter "./packages/*" build
RUN pnpm --filter @zapstore/web build
RUN pnpm --filter @zapstore/api build
RUN pnpm --filter @zapstore/worker build

# --- runner: imagem final ---
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate && apk add --no-cache bash
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Usuario nao-root
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodeapp

# Workspace meta + node_modules (linkados pelo pnpm)
COPY --from=builder --chown=nodeapp:nodejs /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json /app/turbo.json ./
COPY --from=builder --chown=nodeapp:nodejs /app/node_modules ./node_modules

# Packages com dist (e prisma schema/migrations no @zapstore/db)
COPY --from=builder --chown=nodeapp:nodejs /app/packages ./packages

# Apps
# - web: Next standalone (.next/standalone tem o server.js + node_modules minimo)
COPY --from=builder --chown=nodeapp:nodejs /app/apps/web/package.json ./apps/web/
COPY --from=builder --chown=nodeapp:nodejs /app/apps/web/.next/standalone ./apps/web-standalone
COPY --from=builder --chown=nodeapp:nodejs /app/apps/web/.next/static ./apps/web-standalone/apps/web/.next/static
COPY --from=builder --chown=nodeapp:nodejs /app/apps/web/public ./apps/web-standalone/apps/web/public
# - api: dist + package.json + node_modules (pnpm symlinks pra .pnpm/)
COPY --from=builder --chown=nodeapp:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=nodeapp:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nodeapp:nodejs /app/apps/api/node_modules ./apps/api/node_modules
# - worker: dist + package.json + node_modules
COPY --from=builder --chown=nodeapp:nodejs /app/apps/worker/package.json ./apps/worker/
COPY --from=builder --chown=nodeapp:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=nodeapp:nodejs /app/apps/worker/node_modules ./apps/worker/node_modules

# Entrypoint que escolhe qual app rodar
COPY --chown=nodeapp:nodejs scripts/start.sh /start.sh
RUN chmod +x /start.sh

USER nodeapp
EXPOSE 3000 4000

CMD ["/start.sh"]
