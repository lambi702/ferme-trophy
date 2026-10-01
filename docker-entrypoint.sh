#!/bin/sh
set -e

echo "[entrypoint] applying pending Prisma migrations..."
npx prisma migrate deploy

echo "[entrypoint] starting timing daemon in background (mode piloté depuis /admin/chrono)..."
npx tsx scripts/timing-daemon.ts &

echo "[entrypoint] starting Next.js..."
exec npm run start
