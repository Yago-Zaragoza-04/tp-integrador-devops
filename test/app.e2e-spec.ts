import request from 'supertest';
import { AppState } from '../src/health.controller';
import { createTestApp, TestApp } from './helpers';

describe('Endpoints operativos y documentación (e2e)', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('GET /health responde ok con el chequeo de heap (terminus)', async () => {
    const res = await request(t.server).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info.memory_heap.status).toBe('up');
  });

  it('GET /ready responde ready y 503 durante el apagado', async () => {
    await request(t.server).get('/ready').expect(200, { status: 'ready' });
    t.app.get(AppState).beforeApplicationShutdown();
    await request(t.server).get('/ready').expect(503, { status: 'shutting_down' });
  });

  it('GET /version expone la versión y el commit de la imagen', async () => {
    await request(t.server).get('/version').expect(200, { version: '9.9.9-test', commit: 'abc1234' });
  });

  it('la documentación interactiva (Swagger UI) es navegable en /docs', async () => {
    const res = await request(t.server).get('/docs').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toMatch(/swagger-ui/i);
  });

  it('GET / redirige a la documentación', async () => {
    const res = await request(t.server).get('/').expect(302);
    expect(res.headers.location).toBe('/docs');
  });

  it('la especificación OpenAPI documenta todas las rutas y lleva la versión desplegada', async () => {
    const res = await request(t.server).get('/openapi.json').expect(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.version).toBe('9.9.9-test');
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/tasks',
        '/api/v1/tasks/{id}',
        '/health',
        '/ready',
        '/version',
        '/metrics',
        '/api/v1/chaos/error',
        '/api/v1/chaos/latency',
      ]),
    );
    expect(res.body.components.schemas).toHaveProperty('CreateTaskDto');
  });

  it('una ruta inexistente devuelve 404 genérico', async () => {
    await request(t.server)
      .get('/no-existe')
      .expect(404, { error: 'not_found', message: 'El recurso solicitado no existe.' });
  });
});
