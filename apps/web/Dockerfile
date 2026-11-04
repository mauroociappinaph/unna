# Production image for the web. Build from the repo root:
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
#     --build-arg NEXT_PUBLIC_UNNA_ENV=staging -t unna-web .
# NEXT_PUBLIC_* values are inlined into the bundle at build time.
# Local development uses Dockerfile.dev (see docker-compose.yml).

FROM node:20-alpine AS base
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

# Workspace manifests only, so dependency layers are cached across source changes.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/shared/package.json packages/shared/

# Compiles domain, shared and the web.
FROM manifests AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_UNNA_ENV
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_UNNA_ENV=$NEXT_PUBLIC_UNNA_ENV
RUN npm ci -w web -w @unna/domain -w @unna/shared
COPY .eslintrc.json ./
COPY packages/domain packages/domain
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @unna/domain \
  && npm run build -w @unna/shared \
  && npm run build -w web \
  && rm -rf apps/web/.next/cache

# Production dependencies only.
FROM manifests AS deps
RUN npm ci --omit=dev -w web -w @unna/domain -w @unna/shared && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /repo ./
COPY --from=build /repo/packages/domain/dist packages/domain/dist
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/web/next.config.js apps/web/
COPY --from=build /repo/apps/web/public apps/web/public
COPY --from=build --chown=node:node /repo/apps/web/.next apps/web/.next

USER node
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["sh", "-c", "exec node /repo/node_modules/next/dist/bin/next start -p ${PORT:-3000}"]
