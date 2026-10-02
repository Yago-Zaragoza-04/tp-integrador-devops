import request from 'supertest';
import { createTestApp, TestApp } from './helpers';

describe('Chaos — fallas controladas para la Tercera Forma (e2e)', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp({ CHAOS_ENABLED: 'true' });
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('latency demora la respuesta lo pedido', async () => {
    const started = Date.now();
    await request(t.server).get('/api/v1/chaos/latency?ms=50').expect(200, { delayed_ms: 50 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
  });

  it('latency está acotada entre 0 y 5000 ms', async () => {
    await request(t.server).get('/api/v1/chaos/latency?ms=60000').expect(400);
    await request(t.server).get('/api/v1/chaos/latency?ms=-1').expect(400);
    await request(t.server).get('/api/v1/chaos/latency?ms=abc').expect(400);
  });
});
