# syntax=docker/dockerfile:1.7

FROM node:24-slim AS base
WORKDIR /app

# ---------------------------------------------------------------------------
# dependencies
# ---------------------------------------------------------------------------
FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# dev: Vite dev server used by docker-compose in local development
# ---------------------------------------------------------------------------
FROM dependencies AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ---------------------------------------------------------------------------
# build: production bundle
# ---------------------------------------------------------------------------
FROM dependencies AS build
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# production: static files served by Nginx (usado a partir da Fase 15)
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
