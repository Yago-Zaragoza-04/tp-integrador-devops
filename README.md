# TP Integrador DevOps — Ciclo de vida y despliegue continuo de una API

[![CI](https://github.com/Yago-Zaragoza-04/tp-integrador-devops/actions/workflows/ci.yml/badge.svg)](https://github.com/Yago-Zaragoza-04/tp-integrador-devops/actions/workflows/ci.yml)
[![Release](https://github.com/Yago-Zaragoza-04/tp-integrador-devops/actions/workflows/release.yml/badge.svg)](https://github.com/Yago-Zaragoza-04/tp-integrador-devops/actions/workflows/release.yml)
[![Versión](https://img.shields.io/github/v/release/Yago-Zaragoza-04/tp-integrador-devops)](https://github.com/Yago-Zaragoza-04/tp-integrador-devops/releases)

Trabajo Práctico Integrador de DevOps (Universidad de Palermo). Una API REST de tareas en
**NestJS + TypeScript** con todo su ciclo de vida automatizado: tests, Conventional Commits y SemVer,
imagen Docker multi-stage, CI/CD en GitHub Actions, publicación en Docker Hub, deploy en Render y
observabilidad con logs JSON, Prometheus y Grafana.

- 📄 **Informe técnico:** [`docs/informe-tecnico.md`](docs/informe-tecnico.md)
- 🧭 **Guía paso a paso:** [`docs/step-by-step-guide.md`](docs/step-by-step-guide.md)

## Arquitectura

```
  developer ── rama + Conventional Commits ──► Pull Request
                                                   │
                     ┌─────────────── ci.yml (GitHub Actions) ───────────────┐
                     │ commitlint · lint (ESLint, hadolint, actionlint)       │
                     │ test (Jest ≥ 80%) · security (npm audit, gitleaks)     │
                     │ docker: build → Trivy → smoke test (no-root)           │
                     └───────────────────────────┬───────────────────────────┘
                                                 │ checks en verde + squash merge
                                                 ▼
                     ┌───────────── release.yml (push a main) ───────────────┐
                     │ semantic-release → tag vX.Y.Z + GitHub Release         │
                     │ build & push → Docker Hub  <user>/tp-integrador-devops │
                     │                 tags X.Y.Z · X.Y · sha-<commit>        │
                     │ deploy hook → Render (imagen X.Y.Z exacta)             │
                     └───────────────────────────┬───────────────────────────┘
                                                 ▼
                                    ┌─────────────────────────┐
     usuarios ── HTTPS ───────────► │  Render: API NestJS     │──► logs JSON (stdout)
                                    │  /api/v1/tasks · /docs  │
                                    │  /health · /metrics     │◄── scrape ── Grafana Cloud
                                    └─────────────────────────┘             (golden signals)

  Local: docker compose → api :3000 · Prometheus :9090 (alertas) · Grafana :3001 (dashboard)
```

## Estructura del proyecto

```
src/
  main.ts                         bootstrap: config validada, logger JSON, graceful shutdown
  app.module.ts                   módulo raíz (controllers, providers, throttler, terminus)
  app.setup.ts                    helmet, límite de body, ValidationPipe, filtro global y Swagger
  config.ts                       variables de entorno validadas (fail-fast)
  tasks.controller.ts             CRUD /api/v1/tasks
  tasks.service.ts                repositorio en memoria
  task.dto.ts                     DTOs con class-validator y @nestjs/swagger
  health.controller.ts            /health (terminus), /ready, /version
  metrics.controller.ts           /metrics (Prometheus) + guard Bearer opcional
  metrics.service.ts              métricas RED con prom-client
  chaos.controller.ts             fallas controladas (solo con CHAOS_ENABLED)
  exception.filter.ts             errores genéricos con error_id
  logger.ts                       logs JSON con pino
  request-logging.middleware.ts   log + métricas por request
  *.spec.ts                       tests unitarios (Jest)
test/                             tests e2e (Jest + supertest) y jest-e2e.json
scripts/                          smoke test y generador de tráfico
observability/                    Prometheus (scrape + alertas) y Grafana (provisioning + dashboard)
.github/workflows/                ci.yml, release.yml y workflows reutilizables
Dockerfile                        multi-stage: base → deps → build → test → runtime
docker-compose.yml                api + Prometheus + Grafana (+ perfiles load y test)
makefile                          atajos de desarrollo
render.yaml                       blueprint de Render (IaC del hosting)
docs/                             informe técnico, guía paso a paso y capturas
```

## Prerrequisitos

- [Docker](https://docs.docker.com/get-docker/) con Docker Compose v2.
- Node.js 22 (versión exacta en [`.nvmrc`](.nvmrc)) y npm, solo para correr sin Docker.
- Para el pipeline completo: cuentas de GitHub, [Docker Hub](https://hub.docker.com) y [Render](https://render.com).

## Inicio rápido

```bash
git clone https://github.com/Yago-Zaragoza-04/tp-integrador-devops.git
cd tp-integrador-devops
docker compose up --build -d
```

| Servicio | URL |
|---|---|
| Documentación interactiva (Swagger UI) | http://localhost:3000/docs |
| Especificación OpenAPI | http://localhost:3000/openapi.json |
| Prometheus | http://localhost:9090 |
| Grafana — dashboard "TP DevOps — Golden Signals" | http://localhost:3001 |

```bash
docker compose --profile load up loadgen        # tráfico para el dashboard (incluye 4xx/5xx)
docker compose --profile test run --rm test     # lint + tests dentro de la imagen
docker compose down -v
```

Sin Docker:

```bash
npm ci
npm run start:dev            # http://localhost:3000/docs (recarga en caliente)
npm run lint                 # ESLint + Prettier
npm test                     # tests unitarios (src/*.spec.ts) y e2e (test/*.e2e-spec.ts)
npm run test:cov             # con cobertura (umbral: 80% de líneas)
npm run build                # compila a dist/
```

El `makefile` tiene los mismos atajos: `make up`, `make test`, `make load`, `make smoke`, `make down`.

## API

| Método y ruta | Descripción |
|---|---|
| `GET /api/v1/tasks` | Lista de tareas |
| `POST /api/v1/tasks` | Crea una tarea (`title`, `description?`, `done?`) |
| `GET /api/v1/tasks/{id}` | Obtiene una tarea |
| `PUT /api/v1/tasks/{id}` | Reemplaza una tarea |
| `DELETE /api/v1/tasks/{id}` | Borra una tarea |
| `GET /health` · `GET /ready` · `GET /version` | Liveness, readiness y versión desplegada |
| `GET /metrics` | Métricas Prometheus |
| `GET /api/v1/chaos/error` · `GET /api/v1/chaos/latency` | Fallas controladas (solo con `CHAOS_ENABLED=true`) |

## Variables de entorno

Se validan al arrancar: si alguna es inválida, la app escribe un log `fatal` y termina con código 1.

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP (1–65535) |
| `HOST` | `0.0.0.0` | Interfaz donde escucha |
| `NODE_ENV` | `production` | Entorno de ejecución |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` |
| `APP_VERSION` / `GIT_SHA` | `0.0.0-dev` / `unknown` | Versión y commit; el pipeline los graba en la imagen |
| `METRICS_TOKEN` | — | Si está definido (≥ 16 caracteres), `/metrics` exige `Authorization: Bearer <token>` |
| `CHAOS_ENABLED` | `false` | Habilita los endpoints de fallas controladas |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `300` / `60000` | Requests por IP y ventana |
| `TRUST_PROXY` | `0` | Saltos de proxy confiables (en Render: `1`) |

## Cómo se trabaja

- **Nada va directo a `main`**: rama → commits en [Conventional Commits](https://www.conventionalcommits.org) →
  Pull Request con evidencia → checks en verde → squash merge.
- El **título del PR** es el commit que queda en `main` y define la versión: `feat` → MINOR,
  `fix`/`perf` → PATCH, `!`/`BREAKING CHANGE` → MAJOR; `docs`, `ci`, `build`, `test` no generan release.
- Cada merge a `main` corre `release.yml`: tag `vX.Y.Z`, imagen `X.Y.Z` en Docker Hub y deploy en Render.

## Configuración del pipeline (una sola vez)

En *Settings → Secrets and variables → Actions* del repositorio:

| Nombre | Tipo | Valor |
|---|---|---|
| `DOCKERHUB_USERNAME` | variable | usuario de Docker Hub |
| `DOCKERHUB_TOKEN` | secreto | Access Token de Docker Hub (Read & Write) |
| `RENDER_DEPLOY_HOOK_URL` | secreto | Render → servicio → Settings → Deploy Hook |
| `RENDER_SERVICE_URL` | variable | `https://<servicio>.onrender.com` |

Mientras falten, el pipeline publica un warning y omite publish/deploy en lugar de fallar. El paso a
paso completo (Docker Hub, Render, Grafana Cloud y protección de `main`) está en la
[guía](docs/step-by-step-guide.md).
