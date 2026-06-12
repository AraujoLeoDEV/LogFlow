# syntax=docker/dockerfile:1.7

FROM node:24-slim AS base
WORKDIR /app

# ---------------------------------------------------------------------------
# dependencies: full node_modules (dev + prod), shared by dev and build stages
# ---------------------------------------------------------------------------
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# dev: hot-reload server used by docker-compose in local development
# ---------------------------------------------------------------------------
FROM dependencies AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
# generated/ is bind-mounted from the host (and gitignored), so the client
# must be (re)generated on container start rather than baked into the image
CMD ["sh", "-c", "npx prisma generate && npm run start:dev"]

# ---------------------------------------------------------------------------
# build: compiles TypeScript and generates the Prisma client
# ---------------------------------------------------------------------------
FROM dependencies AS build
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# production: minimal runtime image
# ---------------------------------------------------------------------------
FROM base AS production
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
