import request from 'supertest';
import { createTestApp, flushLogs, requestLogs, TestApp } from './helpers';

describe('Observabilidad: logs estructurados y métricas (e2e)', () => {
  let t: TestApp;

  afterEach(async () => {
    await t.app.close();
  });

  it('cada request emite un log JSON con timestamp, level, path y status_code', async () => {
    t = await createTestApp();
    await request(t.server).post('/api/v1/tasks?trace=1').send({ title: 'log' }).expect(201);
    await flushLogs();

    const [entry] = requestLogs(t.logs);
    expect(entry).toMatchObject({
      level: 'info',
      path: '/api/v1/tasks', // sin la query string
      route: '/api/v1/tasks',
      status_code: 201,
      method: 'POST',
      version: '9.9.9-test',
      service: 'tp-integrador-devops',
    });
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(typeof entry.duration_ms).toBe('number');
    expect(entry.request_id).toBeTruthy();
  });

  it('el nivel refleja el resultado: 4xx es warn y 5xx es error', async () => {
    t = await createTestApp({ CHAOS_ENABLED: 'true' });
    await request(t.server).get('/api/v1/tasks/00000000-0000-4000-8000-000000000000').expect(404);
    await request(t.server).get('/api/v1/chaos/error').expect(500);
    await flushLogs();

    expect(requestLogs(t.logs).map((e) => [e.status_code, e.level])).toEqual([
      [404, 'warn'],
      [500, 'error'],
    ]);
  });

  it('respeta un x-request-id válido y reemplaza uno inseguro', async () => {
    t = await createTestApp();
    await request(t.server).get('/version').set('x-request-id', 'abc-123').expect('x-request-id', 'abc-123');
    const unsafe = await request(t.server).get('/version').set('x-request-id', 'a b"}{"level":"fatal');
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('los endpoints operativos se loguean en debug para no generar ruido', async () => {
    t = await createTestApp();
    await request(t.server).get('/health').expect(200);
    await flushLogs();
    expect(requestLogs(t.logs)[0].level).toBe('debug');
  });

  it('/metrics expone las golden signals con el patrón de ruta como label', async () => {
    t = await createTestApp();
    const created = await request(t.server).post('/api/v1/tasks').send({ title: 'm' }).expect(201);
    await request(t.server).get(`/api/v1/tasks/${created.body.id}`).expect(200);
    await request(t.server).get('/no-existe').expect(404);

    const res = await request(t.server).get('/metrics').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toMatch(
      /http_requests_total\{[^}]*method="GET"[^}]*route="\/api\/v1\/tasks\/:id"[^}]*status_code="200"/,
    );
    expect(res.text).toMatch(/http_requests_total\{[^}]*route="unmatched"[^}]*status_code="404"/);
    expect(res.text).toMatch(/http_request_duration_seconds_bucket\{/);
    expect(res.text).toMatch(/app_build_info\{[^}]*version="9.9.9-test"/);
    expect(res.text).not.toContain(created.body.id); // la URL cruda nunca es label
  });
});
