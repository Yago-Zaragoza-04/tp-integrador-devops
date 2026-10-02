import { BadRequestException, Controller, Get, Inject, NotFoundException, Query } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { APP_CONFIG, AppConfig } from './config';
import { ErrorDto } from './task.dto';

const MAX_LATENCY_MS = 5000;

/**
 * Fallas controladas para la Tercera Forma (experimentación). Solo existen si CHAOS_ENABLED=true;
 * si no, responden 404 como cualquier ruta inexistente (OWASP A02).
 */
@ApiTags('Chaos')
@ApiNotFoundResponse({ description: 'CHAOS_ENABLED no está activo', type: ErrorDto })
@Controller('api/v1/chaos')
export class ChaosController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get('error')
  @ApiOperation({ summary: 'Provoca un error 500 controlado' })
  @ApiInternalServerErrorResponse({ type: ErrorDto, description: 'Error genérico con error_id' })
  error(): never {
    this.ensureEnabled();
    throw new Error('Falla inyectada por el endpoint de chaos');
  }

  @Get('latency')
  @ApiOperation({ summary: 'Responde con una demora artificial' })
  @ApiQuery({
    name: 'ms',
    required: false,
    schema: { type: 'integer', minimum: 0, maximum: MAX_LATENCY_MS, default: 1000 },
  })
  @ApiOkResponse({ schema: { example: { delayed_ms: 1000 } } })
  async latency(@Query('ms') ms?: string): Promise<{ delayed_ms: number }> {
    this.ensureEnabled();
    const delay = ms === undefined ? 1000 : Number(ms);
    if (!Number.isInteger(delay) || delay < 0 || delay > MAX_LATENCY_MS) {
      throw new BadRequestException({
        error: 'validation_error',
        message: `ms debe ser un entero entre 0 y ${MAX_LATENCY_MS}.`,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    return { delayed_ms: delay };
  }

  private ensureEnabled(): void {
    if (!this.config.chaosEnabled) {
      throw new NotFoundException();
    }
  }
}
