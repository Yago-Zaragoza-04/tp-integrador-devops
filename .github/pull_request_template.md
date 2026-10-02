<!-- El título del PR tiene que ser un Conventional Commit: es el commit que queda en main
     tras el squash merge y semantic-release lo usa para calcular la versión.
     Ejemplos: "feat(tasks): add pagination", "fix(metrics): bound route label cardinality" -->

## Qué cambia y por qué

<!-- Una o dos líneas de contexto + la lista de cambios. Un PR = una sola preocupación. -->

## Tipo de cambio

- [ ] `feat` — funcionalidad nueva (MINOR)
- [ ] `fix` / `perf` — corrección o mejora de rendimiento (PATCH)
- [ ] `feat!` / `BREAKING CHANGE` — cambio incompatible (MAJOR)
- [ ] `docs` / `test` / `build` / `ci` / `refactor` / `chore` — sin release

## Cómo se probó

<!-- Evidencia real: comandos ejecutados y su salida (resumen de npm test, curl, smoke test),
     capturas del dashboard si cambia la observabilidad. "Los tests pasan" no es evidencia. -->

```text
$ npm run lint
$ npm run test:cov
$ docker compose up --build -d && node scripts/smoke-test.mjs http://localhost:3000
```

## Checklist

- [ ] Título del PR en formato Conventional Commits
- [ ] Tests agregados o actualizados, en verde, cobertura ≥ 80%
- [ ] Rutas nuevas documentadas en `src/docs/openapi.yaml`
- [ ] Sin secretos en el diff ni en capturas
- [ ] Informe técnico actualizado si cambia una decisión de diseño
