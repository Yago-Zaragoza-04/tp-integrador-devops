import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CreateTaskDto, ErrorDto, ReplaceTaskDto, TaskDto, TaskListDto } from './task.dto';
import { TasksService } from './tasks.service';

const notFound = () => new NotFoundException({ error: 'not_found', message: 'La tarea no existe.' });

// Un id que no es UUID no puede existir: se responde 404 sin consultar el repositorio.
const TaskId = Param('id', new ParseUUIDPipe({ version: '4', exceptionFactory: notFound }));

@ApiTags('Tareas')
@ApiTooManyRequestsResponse({ description: 'Se superó el límite de peticiones por minuto', type: ErrorDto })
@Controller('api/v1/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tareas' })
  @ApiOkResponse({ type: TaskListDto })
  list(): TaskListDto {
    const items = this.tasks.list();
    return { items, total: items.length };
  }

  @Post()
  @ApiOperation({ summary: 'Crear una tarea' })
  @ApiCreatedResponse({ type: TaskDto, description: 'Tarea creada; el header Location apunta a ella' })
  @ApiBadRequestResponse({ type: ErrorDto })
  @ApiPayloadTooLargeResponse({ type: ErrorDto, description: 'El cuerpo supera 10 kb' })
  create(@Body() body: CreateTaskDto, @Res({ passthrough: true }) res: Response): TaskDto {
    const task = this.tasks.create(body);
    res.location(`/api/v1/tasks/${task.id}`);
    return task;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una tarea' })
  @ApiOkResponse({ type: TaskDto })
  @ApiNotFoundResponse({ type: ErrorDto })
  get(@TaskId id: string): TaskDto {
    const task = this.tasks.get(id);
    if (!task) throw notFound();
    return task;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Reemplazar una tarea' })
  @ApiOkResponse({ type: TaskDto })
  @ApiBadRequestResponse({ type: ErrorDto })
  @ApiNotFoundResponse({ type: ErrorDto })
  replace(@TaskId id: string, @Body() body: ReplaceTaskDto): TaskDto {
    const task = this.tasks.replace(id, body);
    if (!task) throw notFound();
    return task;
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar una tarea' })
  @ApiNoContentResponse({ description: 'Tarea borrada' })
  @ApiNotFoundResponse({ type: ErrorDto })
  remove(@TaskId id: string): void {
    if (!this.tasks.remove(id)) throw notFound();
  }
}
