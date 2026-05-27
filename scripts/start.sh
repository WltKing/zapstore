#!/bin/bash
# Entrypoint do container: escolhe qual app rodar baseado em APP_TYPE.
# Use no EasyPanel: setar APP_TYPE=web | api | worker no env do serviço.

set -e

APP_TYPE="${APP_TYPE:-web}"
echo "[start.sh] APP_TYPE=${APP_TYPE}"

# Roda migrations Prisma uma vez (idempotente). Apenas no web — web sobe primeiro
# pra garantir que migrations roda antes do worker conectar.
if [ "$APP_TYPE" = "web" ] && [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[start.sh] Running Prisma migrations..."
  cd /app/packages/db
  pnpm exec prisma migrate deploy || {
    echo "[start.sh] WARN: migrate deploy failed, continuing anyway"
  }
  cd /app
fi

case "$APP_TYPE" in
  web)
    cd /app/apps/web-standalone
    exec node apps/web/server.js
    ;;
  api)
    exec node /app/apps/api/dist/server.js
    ;;
  worker)
    exec node /app/apps/worker/dist/index.js
    ;;
  *)
    echo "[start.sh] ERROR: APP_TYPE must be web | api | worker (got: $APP_TYPE)"
    exit 1
    ;;
esac
