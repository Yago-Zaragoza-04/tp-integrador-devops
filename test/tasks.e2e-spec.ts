import request from 'supertest';
import { createTestApp, TestApp } from './helpers';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('API de tareas (e2e)', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await createTestApp();
  });

  afterEach(async () => {
    await t.app.close();
  });

  it('lista vacía al iniciar', async () => {
    await request(t.server).get('/api/v1/tasks').expect(200, { items: [], total: 0 });
  });

  it('crea una tarea con id UUID, Location y valores por defecto', async () => {
    const res = await request(t.server).post('/api/v1/tasks').send({ title: '  Configurar CI  ' }).expect(201);
    expect(res.body.id).toMatch(UUID_V4);
    expect(res.body).toMatchObject({ title: 'Configurar CI', description: '', done: false });
    expect(res.headers.location).toBe(`/api/v1/tasks/${res.body.id}`);
  });

  it('recorre el ciclo completo: crear, leer, reemplazar, borrar', async () => {
    const created = await request(t.server).post('/api/v1/tasks').send({ title: 'Dockerfile' }).expect(201);
    const url = `/api/v1/tasks/${created.body.id}`;

    await request(t.server)
      .get(url)
      .expect(200)
      .expect((res) => expect(res.body.title).toBe('Dockerfile'));

    const replaced = await request(t.server)
      .put(url)
      .send({ title: 'Dockerfile multi-stage', description: 'non-root', done: true })
      .expect(200);
    expect(replaced.body).toMatchObject({ done: true, createdAt: created.body.createdAt });

    await request(t.server)
      .get('/api/v1/tasks')
      .expect(200)
      .expect((res) => expect(res.body.total).toBe(1));
    await request(t.server).delete(url).expect(204);
    await request(t.server).get(url).expect(404);
    await request(t.server).delete(url).expect(404);
  });

  it('rechaza un título vacío con 400 y el detalle del campo', async () => {
    const res = await request(t.server).post('/api/v1/tasks').send({ title: '   ' }).expect(400);
    expect(res.body.error).toBe('validation_error');
    expect(res.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'title' })]));
  });

  it('rechaza propiedades no declaradas (allow-list estricta)', async () => {
    const res = await request(t.server).post('/api/v1/tasks').send({ title: 'x', isAdmin: true }).expect(400);
    expect(res.body.details).toEqual([expect.objectContaining({ field: 'isAdmin' })]);
  });

  it('rechaza un cuerpo vacío, tipos incorrectos y un PUT incompleto', async () => {
    await request(t.server).post('/api/v1/tasks').expect(400);
    await request(t.server).post('/api/v1/tasks').send({ title: 'x', done: 'yes' }).expect(400);
    const created = await request(t.server).post('/api/v1/tasks').send({ title: 'x' }).expect(201);
    await request(t.server).put(`/api/v1/tasks/${created.body.id}`).send({ title: 'y' }).expect(400);
  });

  it('PUT sobre una tarea inexistente devuelve 404', async () => {
    await request(t.server)
      .put(`/api/v1/tasks/${MISSING_ID}`)
      .send({ title: 'y', description: '', done: false })
      .expect(404, { error: 'not_found', message: 'La tarea no existe.' });
  });

  it('un id que no es UUID devuelve 404 sin consultar el repositorio', async () => {
    await request(t.server).get('/api/v1/tasks/1').expect(404);
  });

  it('JSON malformado devuelve 400 invalid_json', async () => {
    await request(t.server)
      .post('/api/v1/tasks')
      .set('content-type', 'application/json')
      .send('{"title":')
      .expect(400, { error: 'invalid_json', message: 'El cuerpo no es JSON válido.' });
  });

  it('un cuerpo mayor a 10 kb devuelve 413', async () => {
    const res = await request(t.server)
      .post('/api/v1/tasks')
      .send({ title: 'x', description: 'a'.repeat(11 * 1024) })
      .expect(413);
    expect(res.body.error).toBe('payload_too_large');
  });
});
