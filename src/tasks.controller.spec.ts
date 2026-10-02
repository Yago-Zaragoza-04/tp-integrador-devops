import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

describe('TasksController', () => {
  let controller: TasksController;
  const res = { location: jest.fn() } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [TasksService],
    }).compile();
    controller = module.get(TasksController);
  });

  it('lista las tareas con su total', () => {
    controller.create({ title: 'a' }, res);
    controller.create({ title: 'b' }, res);
    expect(controller.list().total).toBe(2);
  });

  it('al crear informa la ubicación del recurso', () => {
    const task = controller.create({ title: 'a' }, res);
    expect(res.location).toHaveBeenCalledWith(`/api/v1/tasks/${task.id}`);
  });

  it('lanza 404 si la tarea no existe', () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    expect(() => controller.get(missing)).toThrow(NotFoundException);
    expect(() => controller.replace(missing, { title: 'x', description: '', done: false })).toThrow(NotFoundException);
    expect(() => controller.remove(missing)).toThrow(NotFoundException);
  });
});
