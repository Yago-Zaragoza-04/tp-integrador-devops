# Guía paso a paso

Cómo reproducir el proyecto desde cero: correrlo localmente, configurar el pipeline y llevarlo a
producción con monitoreo. Cada paso indica cómo verificar que quedó bien.

## 1. Correr la API localmente

```bash
git clone https://github.com/Yago-Zaragoza-04/tp-integrador-devops.git
cd tp-integrador-devops
docker compose up --build -d
docker compose ps                      # api "healthy", prometheus y grafana "running"
```

Verificación:

```bash
curl -s localhost:3000/health          # {"status":"ok",...}
curl -s localhost:3000/version         # versión y commit de la imagen
make smoke                             # health, ready, /docs, OpenAPI, CRUD y 404 (o: node scripts/smoke-test.mjs http://localhost:3000)
```

Abrir http://localhost:3000/docs: la documentación interactiva permite probar cada endpoint con
*Try it out*.

## 2. Generar tráfico y ver las golden signals

```bash
docker compose --profile load up loadgen
```

El generador mezcla altas, lecturas, ids inexistentes (404), bodies inválidos (400) y llamadas a los
endpoints de chaos (500 y latencia). Mientras corre:

- Grafana (http://localhost:3001) → dashboard **TP DevOps — Golden Signals**: tráfico, latencia
  p50/p95/p99, tasa de errores y saturación (CPU, memoria, event loop).
- Prometheus (http://localhost:9090/alerts): `HighErrorRate` pasa a *pending* y después a *firing*.
- Logs JSON: `docker compose logs -f api`.

## 3. Correr lint y tests

```bash
npm ci
npm run lint                           # ESLint + Prettier
npm run test:cov                       # unitarios + e2e, falla si la cobertura baja de 80% de líneas
docker compose --profile test run --rm test   # lo mismo, dentro de la etapa "test" del Dockerfile
```

## 4. Proteger `main` en GitHub

*Settings → Branches → Add branch ruleset* (o *branch protection rule*) para `main`:

1. **Require a pull request before merging.**
2. **Require status checks to pass**, marcando los checks de `ci.yml`: `commitlint / Conventional Commits`,
   `lint / ESLint`, `lint / Hadolint (Dockerfile)`, `lint / actionlint (workflows)`,
   `test / Unit tests + cobertura`, `security / npm audit (dependencias)`,
   `security / Gitleaks (secretos)` y `docker / Build, scan y smoke test`.
3. **Require linear history** y **Do not allow bypassing** (incluye administradores).
4. En *Settings → General → Pull Requests*: permitir solo **squash merging**, con el título del PR
   como mensaje del commit.

Verificación: `git push origin main` desde un clon es rechazado con
`protected branch hook declined`.

## 5. Docker Hub

1. Crear el repositorio `tp-integrador-devops` en Docker Hub (público).
2. *Account settings → Personal access tokens → Generate*, con permiso **Read & Write**.
3. En GitHub, *Settings → Secrets and variables → Actions*:
   - variable `DOCKERHUB_USERNAME` = usuario de Docker Hub;
   - secreto `DOCKERHUB_TOKEN` = el token generado.

Verificación: el próximo release publica las etiquetas `X.Y.Z`, `X.Y` y `sha-<commit>`.

## 6. Render

1. *New → Blueprint* apuntando a este repositorio: Render lee [`render.yaml`](../render.yaml).
   Reemplazar el placeholder `DOCKERHUB_USERNAME` de la imagen por el usuario real.
2. En las variables de entorno del servicio, definir `METRICS_TOKEN` (32+ caracteres aleatorios).
3. *Settings → Deploy Hook*: copiar la URL.
4. En GitHub: secreto `RENDER_DEPLOY_HOOK_URL` = esa URL y variable `RENDER_SERVICE_URL` =
   `https://<servicio>.onrender.com`.

Verificación: después de un merge `feat`/`fix`, el job `deploy` de `release.yml` termina en verde
cuando `GET /version` del servicio responde la versión recién liberada.

**Rollback:** *Actions → Release → Run workflow* con `rollback_version` = una versión anterior
(por ejemplo `1.0.0`); Render vuelve a esa imagen sin reconstruir.

## 7. Monitoreo en producción (Grafana Cloud)

1. Crear un stack gratuito en Grafana Cloud.
2. *Connections → Metrics Endpoint*: URL `https://<servicio>.onrender.com/metrics`, autenticación
   **Bearer** con el valor de `METRICS_TOKEN`, intervalo 60 s.
3. *Dashboards → Import*: subir [`observability/grafana/dashboards/golden-signals.json`](../observability/grafana/dashboards/golden-signals.json)
   y elegir el datasource `grafanacloud-*-prom`.
4. *Alerting → Alert rules*: recrear `HighErrorRate` y `HighLatencyP95` con las expresiones de
   [`observability/prometheus/alerts.yml`](../observability/prometheus/alerts.yml).

## 8. Ciclo de un cambio

```bash
git switch -c feat/filtro-por-estado
# ... cambios + tests ...
git commit -m "feat(api): filter tasks by done status"
git push -u origin feat/filtro-por-estado
gh pr create --title "feat(api): filter tasks by done status" --body "..."
```

1. `ci.yml` corre sobre el PR; si algo falla el merge queda bloqueado (Andon Cord).
2. Con todo en verde: *Squash and merge*.
3. `release.yml` calcula la versión (acá MINOR), crea el tag y el GitHub Release, publica la imagen
   y despliega en Render esa versión exacta.
