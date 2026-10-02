import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;

  beforeEach(() => {
    service = new TasksService();
  });

  it('crea tareas con valores por defecto y timestamps', () => {
    const task = service.create({ title: 'Configurar CI' });
    expect(task).toMatchObject({ title: 'Configurar CI', description: '', done: false });
    expect(task.createdAt).toBe(task.updatedAt);
    expect(service.get(task.id)).toEqual(task);
  });

  it('genera ids distintos y no enumerables', () => {
    const a = service.create({ title: 'a' });
    const b = service.create({ title: 'b' });
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('reemplaza conservando id y fecha de creación', () => {
    const task = service.create({ title: 'a' });
    const replaced = service.replace(task.id, { title: 'b', description: 'c', done: true });
    expect(replaced).toMatchObject({
      id: task.id,
      title: 'b',
      description: 'c',
      done: true,
      createdAt: task.createdAt,
    });
  });

  it('devuelve undefined/false para ids inexistentes', () => {
    expect(service.get('x')).toBeUndefined();
    expect(service.replace('x', { title: 'b', description: '', done: false })).toBeUndefined();
    expect(service.remove('x')).toBe(false);
  });

  it('borra y lista', () => {
    const task = service.create({ title: 'a' });
    expect(service.list()).toHaveLength(1);
    expect(service.remove(task.id)).toBe(true);
    expect(service.list()).toHaveLength(0);
  });
});
