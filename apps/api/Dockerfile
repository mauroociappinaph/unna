# Production image for the API. Build from the repo root:
#   docker build -f apps/api/Dockerfile -t unna-api .
# Local development uses Dockerfile.dev (see docker-compose.yml).
# Never declare secrets as ARG here: they would end up in the image.

FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /repo

# Workspace manifests only, so dependency layers are cached across source changes.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/shared/package.json packages/shared/

# Compiles domain, shared and the API, and generates the Prisma client.
FROM manifests AS build
RUN npm ci -w api -w @unna/domain -w @unna/shared
COPY packages/domain packages/domain
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @unna/domain \
  && npm run build -w @unna/shared \
  && cd apps/api && npx prisma generate && npm run build

# Production dependencies only.
FROM manifests AS deps
RUN npm ci --omit=dev -w api -w @unna/domain -w @unna/shared && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /repo ./
# Prisma CLI (needed by `migrate deploy` at start), its engines and the generated client.
COPY --from=build /repo/node_modules/prisma node_modules/prisma
COPY --from=build /repo/node_modules/@prisma node_modules/@prisma
COPY --from=build /repo/node_modules/.prisma node_modules/.prisma
COPY --from=build /repo/packages/domain/dist packages/domain/dist
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY apps/api/prisma apps/api/prisma
COPY apps/api/scripts apps/api/scripts
# Product images are written to ./uploads at runtime.
RUN mkdir -p apps/api/uploads && chown node:node apps/api/uploads

USER node
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["sh", "scripts/start-prod.sh"]
