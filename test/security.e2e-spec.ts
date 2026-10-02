import request from 'supertest';
import { createTestApp, flushLogs, TestApp } from './helpers';

const METRICS_TOKEN = 'token-de-prueba-de-32-caracteres!';

describe('Seguridad — OWASP Top 10 2025 (e2e)', () => {
  let t: TestApp;

  afterEach(async () => {
    await t.app.close();
  });

  it('A02: aplica cabeceras de seguridad y oculta el framework', async () => {
    t = await createTestApp();
    const res = await request(t.server).get('/version').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('A02: los endpoints de chaos no existen si CHAOS_ENABLED no está activo', async () => {
    t = await createTestApp();
    await request(t.server).get('/api/v1/chaos/error').expect(404);
    await request(t.server).get('/api/v1/chaos/latency').expect(404);
  });

  it('A10: un error inesperado devuelve 500 genérico con error_id y sin stack', async () => {
    t = await createTestApp({ CHAOS_ENABLED: 'true' });
    const res = await request(t.server).get('/api/v1/chaos/error').expect(500);
    expect(res.body).toMatchObject({ error: 'internal_error', message: 'Ocurrió un error inesperado.' });
    expect(JSON.stringify(res.body)).not.toMatch(/Error:|at |src\/|node_modules/);

    await flushLogs();
    const logged = t.logs.find((e) => e.msg === 'unhandled error') as { error_id: string; err: { stack: string } };
    expect(logged.error_id).toBe(res.body.error_id); // correlación cliente ↔ log
    expect(logged.err.stack).toBeTruthy(); // el stack queda solo del lado del servidor
  });

  it('A01/A06: el rate limit corta con 429 al superar el máximo', async () => {
    t = await createTestApp({ RATE_LIMIT_MAX: '2' });
    await request(t.server).get('/api/v1/tasks').expect(200).expect('x-ratelimit-remaining', '1');
    await request(t.server).get('/api/v1/tasks').expect(200);
    const res = await request(t.server).get('/api/v1/tasks').expect(429);
    expect(res.body.error).toBe('too_many_requests');
    expect(res.headers['retry-after']).toBeDefined();
    await request(t.server).get('/health').expect(200); // los endpoints operativos no se limitan
  });

  it('A07: con METRICS_TOKEN, /metrics exige el bearer correcto', async () => {
    t = await createTestApp({ METRICS_TOKEN });
    await request(t.server).get('/metrics').expect(401).expect('www-authenticate', 'Bearer');
    await request(t.server).get('/metrics').set('authorization', 'Bearer otro-token-cualquiera-largo').expect(401);
    await request(t.server).get('/metrics').set('authorization', `Bearer ${METRICS_TOKEN}`).expect(200);
  });

  it('A09: el header authorization nunca llega a los logs', async () => {
    t = await createTestApp({ METRICS_TOKEN });
    await request(t.server).get('/metrics').set('authorization', `Bearer ${METRICS_TOKEN}`).expect(200);
    await flushLogs();
    expect(JSON.stringify(t.logs)).not.toContain(METRICS_TOKEN);
  });
});
