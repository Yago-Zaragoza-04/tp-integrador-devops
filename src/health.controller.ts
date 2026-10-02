import { BeforeApplicationShutdown, Controller, Get, Inject, Injectable, Redirect, Res } from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { APP_CONFIG, AppConfig } from './config';

const HEAP_LIMIT_BYTES = 512 * 1024 * 1024;

/** Estado de readiness: deja de aceptar tráfico apenas empieza el graceful shutdown. */
@Injectable()
export class AppState implements BeforeApplicationShutdown {
  ready = true;

  beforeApplicationShutdown(): void {
    this.ready = false;
  }
}

/**
 * Endpoints operativos: liveness (terminus), readiness y versión desplegada.
 * /version es lo que valida el smoke test post-deploy contra el tag publicado.
 */
@ApiTags('Operación')
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly state: AppState,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  @Redirect('/docs', 302)
  @ApiExcludeEndpoint()
  root(): void {}

  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness: el proceso responde y el heap está bajo el límite' })
  check() {
    return this.health.check([() => this.memory.checkHeap('memory_heap', HEAP_LIMIT_BYTES)]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: puede recibir tráfico' })
  @ApiOkResponse({ schema: { example: { status: 'ready' } } })
  @ApiServiceUnavailableResponse({ description: 'Graceful shutdown en curso' })
  ready(@Res({ passthrough: true }) res: Response) {
    if (!this.state.ready) {
      res.status(503);
      return { status: 'shutting_down' };
    }
    return { status: 'ready' };
  }

  @Get('version')
  @ApiOperation({ summary: 'Versión SemVer y commit de la imagen desplegada' })
  @ApiOkResponse({ schema: { example: { version: '1.2.0', commit: 'a1b2c3d' } } })
  version() {
    return { version: this.config.version, commit: this.config.gitSha };
  }
}
