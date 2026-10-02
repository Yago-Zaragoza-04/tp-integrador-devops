import { createHash, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Inject,
  Injectable,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { APP_CONFIG, AppConfig } from './config';
import { MetricsService } from './metrics.service';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Si METRICS_TOKEN está configurado, /metrics exige "Authorization: Bearer <token>".
 * La comparación es en tiempo constante (OWASP A07).
 */
@Injectable()
export class MetricsAuthGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const token = this.config.metricsToken;
    if (!token) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.get('authorization') ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (provided && timingSafeEqual(digest(provided), digest(token))) return true;
    context.switchToHttp().getResponse<Response>().setHeader('www-authenticate', 'Bearer');
    throw new UnauthorizedException();
  }
}

@ApiTags('Operación')
@SkipThrottle()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @UseGuards(MetricsAuthGuard)
  @ApiBearerAuth('metricsToken')
  @ApiOperation({ summary: 'Métricas en formato Prometheus (Bearer si METRICS_TOKEN está configurado)' })
  @ApiOkResponse({ description: 'Exposición de métricas en texto plano' })
  @ApiUnauthorizedResponse({ description: 'Falta o es inválido el token' })
  async expose(@Res() res: Response): Promise<void> {
    res.set('content-type', this.metrics.registry.contentType);
    res.send(await this.metrics.registry.metrics());
  }
}
