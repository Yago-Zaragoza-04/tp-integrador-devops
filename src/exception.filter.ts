import { randomUUID } from 'node:crypto';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Logger } from 'pino';

export interface ErrorBody {
  error: string;
  message: string;
  details?: { field: string; message: string }[];
  error_id?: string;
}

const STATUS_CODES: Record<number, { error: string; message: string }> = {
  400: { error: 'bad_request', message: 'La petición no es válida.' },
  401: { error: 'unauthorized', message: 'Falta o es inválida la credencial.' },
  404: { error: 'not_found', message: 'El recurso solicitado no existe.' },
  405: { error: 'method_not_allowed', message: 'Método no permitido.' },
  413: { error: 'payload_too_large', message: 'El cuerpo supera el tamaño permitido.' },
  415: { error: 'unsupported_media_type', message: 'Tipo de contenido no soportado.' },
  429: { error: 'too_many_requests', message: 'Demasiadas peticiones, reintentá más tarde.' },
};

// Errores del body parser de Express que Nest deja pasar sin convertir (el JSON inválido se trata en app.setup.ts).
const BODY_PARSER_ERRORS: Record<string, { status: number } & ErrorBody> = {
  'entity.too.large': { status: 413, error: 'payload_too_large', message: 'El cuerpo supera el tamaño permitido.' },
  'encoding.unsupported': { status: 415, error: 'unsupported_encoding', message: 'Codificación no soportada.' },
};

/**
 * Manejo central de errores (OWASP A10): el cliente nunca ve stack, rutas ni versiones;
 * ante un error inesperado recibe un error_id para correlacionar con los logs del servidor.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const { status, body } = this.toResponse(exception, req, res);
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(status).json(body);
  }

  private toResponse(exception: unknown, req: Request, res: Response): { status: number; body: ErrorBody | object } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse() as Record<string, unknown> | string;
      // Las respuestas por defecto de Nest traen statusCode; las propias no.
      if (typeof response === 'object' && !('statusCode' in response)) {
        // Respuesta ya armada con el contrato de la API ({ error, message, details? }).
        if (typeof response.error === 'string' && typeof response.message === 'string') {
          return { status, body: response };
        }
        // Resultado de un health check de terminus ({ status, info, error, details }).
        if (typeof response.status === 'string') {
          return { status, body: response };
        }
      }
      const known = STATUS_CODES[status];
      if (known && status < 500) return { status, body: known };
      if (status < 500) return { status, body: { error: `http_${status}`, message: exception.message } };
    }

    const parserError = BODY_PARSER_ERRORS[(exception as { type?: string })?.type ?? ''];
    if (parserError) {
      const { status, ...body } = parserError;
      return { status, body };
    }

    const errorId = randomUUID();
    this.logger.error(
      { err: exception, error_id: errorId, request_id: res.locals?.requestId, path: req.path },
      'unhandled error',
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: 'internal_error', message: 'Ocurrió un error inesperado.', error_id: errorId },
    };
  }
}
