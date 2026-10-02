#!/usr/bin/env node
/**
 * Smoke test contra una instancia corriendo (contenedor en CI o el deploy en Render).
 *
 *   node scripts/smoke-test.mjs <BASE_URL> [EXPECTED_VERSION]
 *
 * Espera hasta SMOKE_TIMEOUT_S (default 60) a que /version responda con la versión esperada
 * — un deploy en Render free puede tardar varios minutos — y después valida lo esencial.
 * Sale con código 1 ante cualquier falla: es un Andon Cord post-deploy.
 */
const [baseArg, expectedVersion] = process.argv.slice(2);
if (!baseArg) {
  console.error('Uso: node scripts/smoke-test.mjs <BASE_URL> [EXPECTED_VERSION]');
  process.exit(2);
}
const BASE_URL = baseArg.replace(/\/$/, '');
const TIMEOUT_S = Number(process.env.SMOKE_TIMEOUT_S ?? 60);
const POLL_MS = Number(process.env.SMOKE_POLL_MS ?? 5000);

const failures = [];
const check = (name, condition, detail = '') => {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!condition) failures.push(name);
};
const get = (path, init) => fetch(`${BASE_URL}${path}`, { ...init, signal: AbortSignal.timeout(15_000) });

async function waitForVersion() {
  const deadline = Date.now() + TIMEOUT_S * 1000;
  let last = 'sin respuesta';
  while (Date.now() < deadline) {
    try {
      const res = await get('/version');
      if (res.ok) {
        const body = await res.json();
        last = body.version;
        if (!expectedVersion || body.version === expectedVersion) return body;
      } else {
        last = `HTTP ${res.status}`;
      }
    } catch (error) {
      last = error.cause?.code ?? error.name;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`timeout de ${TIMEOUT_S}s esperando la versión ${expectedVersion ?? '(cualquiera)'}; última: ${last}`);
}

try {
  console.log(`smoke-test → ${BASE_URL}${expectedVersion ? ` (versión esperada ${expectedVersion})` : ''}`);
  const version = await waitForVersion();
  check('versión desplegada', true, `${version.version} @ ${version.commit}`);

  const health = await get('/health');
  check('GET /health = 200', health.status === 200);
  check('cabeceras de seguridad (helmet)', health.headers.get('x-content-type-options') === 'nosniff');

  check('GET /ready = 200', (await get('/ready')).status === 200);

  const docs = await get('/docs');
  check('GET /docs (Swagger UI) navegable', docs.status === 200 && /swagger-ui/i.test(await docs.text()));

  const spec = await (await get('/openapi.json')).json();
  check('OpenAPI documenta /api/v1/tasks', Boolean(spec.paths?.['/api/v1/tasks']));

  const created = await get('/api/v1/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'smoke test' }),
  });
  check('POST /api/v1/tasks = 201', created.status === 201);
  if (created.status === 201) {
    const { id } = await created.json();
    check('GET /api/v1/tasks/:id = 200', (await get(`/api/v1/tasks/${id}`)).status === 200);
    check('DELETE /api/v1/tasks/:id = 204', (await get(`/api/v1/tasks/${id}`, { method: 'DELETE' })).status === 204);
  }

  check('ruta inexistente = 404', (await get('/no-existe')).status === 404);
  check('GET /metrics responde (200 o 401 si tiene token)', [200, 401].includes((await get('/metrics')).status));
} catch (error) {
  check('instancia disponible', false, error.message);
}

if (failures.length) {
  console.error(`\n${failures.length} chequeo(s) fallaron: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nSmoke test OK');
