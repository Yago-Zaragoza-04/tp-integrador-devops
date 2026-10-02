import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CreateTaskDto, ReplaceTaskDto, TaskDto } from './task.dto';

/**
 * Repositorio en memoria. La lógica de negocio no es el foco del TP; el servicio aísla a los
 * controladores del almacenamiento, así que cambiarlo por una base no toca las rutas.
 * Los ids son UUID aleatorios: no son enumerables (OWASP A01, IDOR).
 */
@Injectable()
export class TasksService {
  private readonly tasks = new Map<string, TaskDto>();

  list(): TaskDto[] {
    return [...this.tasks.values()];
  }

  get(id: string): TaskDto | undefined {
    return this.tasks.get(id);
  }

  create(input: CreateTaskDto): TaskDto {
    const now = new Date().toISOString();
    const task: TaskDto = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? '',
      done: input.done ?? false,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  replace(id: string, input: ReplaceTaskDto): TaskDto | undefined {
    const current = this.tasks.get(id);
    if (!current) return undefined;
    const task: TaskDto = {
      ...current,
      title: input.title,
      description: input.description,
      done: input.done,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(id, task);
    return task;
  }

  remove(id: string): boolean {
    return this.tasks.delete(id);
  }
}
