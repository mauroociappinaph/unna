#!/bin/sh
# Production start: applies pending Prisma migrations, then runs the compiled API.
# Migrations run here because the hosting free plan has no pre-deploy step.
set -e

cd "$(dirname "$0")/.."

PRISMA_CLI="$(node -p "require.resolve('prisma/build/index.js')")"
node "$PRISMA_CLI" migrate deploy

exec node dist/main
