# syntax=docker/dockerfile:1.7
# Imagen base fijada a versión exacta (nunca "latest"). Debe coincidir con .nvmrc:
# desarrollo, CI y runtime usan el mismo Node.
ARG NODE_IMAGE=node:22.20.0-alpine3.22

#
# 🧱 Base: configuración común a todas las etapas
#
FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

#
# 📦 Dependencias de producción. Se copian primero los manifiestos para que esta capa
# quede en caché mientras package*.json no cambie.
#
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts

#
# 🏗️ Build: dependencias completas (incluye la CLI de Nest y TypeScript) y compilación a dist/
#
FROM base AS build
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --include=dev --ignore-scripts
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

#
# 🧪 Test: lint y tests (unit + e2e) dentro de la misma base que producción
#   docker compose --profile test run --rm test
#
FROM build AS test
ENV NODE_ENV=test
COPY eslint.config.mjs .prettierrc ./
COPY test ./test
COPY scripts ./scripts
USER node
CMD ["sh", "-c", "npm run lint && npm run test:cov"]

#
# 🚀 Runtime: imagen final mínima, sin npm ni herramientas de build, usuario no root
#
FROM base AS runtime
ARG APP_VERSION=0.0.0-dev
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="tp-integrador-devops" \
      org.opencontainers.image.description="API REST de tareas en NestJS — TP Integrador DevOps" \
      org.opencontainers.image.source="https://github.com/Yago-Zaragoza-04/tp-integrador-devops" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}"

# El runtime no necesita gestores de paquetes: se eliminan para reducir superficie de ataque y CVEs.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

ENV APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA} \
    HOST=0.0.0.0 \
    PORT=3000

# Archivos propiedad de root y solo lectura para el proceso: la app no puede modificarse a sí misma.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "dist/main.js"]
