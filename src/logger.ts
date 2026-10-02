import { LoggerService } from '@nestjs/common';
import pino, { DestinationStream, Logger } from 'pino';

/**
 * Logger JSON estructurado. Contrato de campos: timestamp, level, msg y, en cada request,
 * method, path, status_code, duration_ms y request_id.
 */
export function createLogger(
  options: { level?: string; version?: string; destination?: DestinationStream } = {},
): Logger {
  const { level = 'info', version = '0.0.0-dev', destination } = options;
  return pino(
    {
      level,
      base: { service: 'tp-integrador-devops', version },
      messageKey: 'msg',
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: { level: (label) => ({ level: label }) },
      redact: {
        paths: ['req.headers.authorization', 'headers.authorization', '*.token', '*.password'],
        censor: '[REDACTED]',
      },
    },
    destination,
  );
}

// Mensajes de arranque de Nest que no aportan en producción (mapeo de rutas, módulos).
const NOISY_CONTEXTS = new Set(['InstanceLoader', 'RoutesResolver', 'RouterExplorer', 'NestFactory']);

/** Adapta pino a la interfaz de logger de Nest: los logs internos del framework también salen en JSON. */
export class PinoLoggerService implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, context?: string): void {
    const level = context && NOISY_CONTEXTS.has(context) ? 'debug' : 'info';
    this.logger[level]({ context }, String(message));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, String(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message));
  }

  fatal(message: unknown, context?: string): void {
    this.logger.fatal({ context }, String(message));
  }
}
