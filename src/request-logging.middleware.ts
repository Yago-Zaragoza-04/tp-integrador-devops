import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { MetricsService } from './metrics.service';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;
const QUIET_PATHS = new Set(['/health', '/ready', '/metrics']);

/** Label "route" con cardinalidad acotada: el patrón de ruta (/api/v1/tasks/:id), nunca la URL cruda. */
export function routeLabel(req: Request, statusCode: number, path: string): string {
  if (req.route?.path) {
    const pattern = `${req.baseUrl}${req.route.path}`;
    return pattern.length > 1 ? pattern.replace(/\/$/, '') : pattern;
  }
  if (statusCode === 404) return 'unmatched';
  if (path.startsWith('/docs')) return '/docs';
  return 'other';
}

/**
 * Asigna request_id, mide la duración y, al terminar la respuesta, emite el log estructurado
 * y registra las métricas HTTP. Un único punto de medición para logs y métricas.
 */
export function requestLogging(logger: Logger, metrics: MetricsService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();
    const incoming = req.get('x-request-id');
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const statusCode = res.statusCode;
      const path = req.originalUrl.split('?')[0];
      const route = routeLabel(req, statusCode, path);

      metrics.observe({ method: req.method, route, status_code: String(statusCode) }, durationSeconds);

      let level: 'info' | 'warn' | 'error' | 'debug' = 'info';
      if (statusCode >= 500) level = 'error';
      else if (statusCode >= 400) level = 'warn';
      else if (QUIET_PATHS.has(path)) level = 'debug';

      logger[level](
        {
          request_id: requestId,
          method: req.method,
          path,
          route,
          status_code: statusCode,
          duration_ms: Math.round(durationSeconds * 100_000) / 100,
        },
        'request completed',
      );
    });

    next();
  };
}
