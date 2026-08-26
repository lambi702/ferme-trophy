#!/bin/sh
set -e

echo "[entrypoint] applying pending Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint] starting mock timing daemon in background..."
npx tsx scripts/timing-daemon.ts &

echo "[entrypoint] starting Next.js..."
exec npm run start
