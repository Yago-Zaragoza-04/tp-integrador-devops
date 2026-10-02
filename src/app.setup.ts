import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Logger } from 'pino';
import type { AppConfig } from './config';
import { AllExceptionsFilter } from './exception.filter';
import { PinoLoggerService } from './logger';
import { MetricsService } from './metrics.service';
import { requestLogging } from './request-logging.middleware';

function flatten(errors: ValidationError[], parent = ''): { field: string; message: string }[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => ({ field, message }));
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/**
 * Configuración común de la aplicación. La usan main.ts y los tests e2e, así lo que se prueba
 * es exactamente lo que corre en producción.
 */
export function configureApp(app: NestExpressApplication, { config, logger }: { config: AppConfig; logger: Logger }) {
  app.useLogger(new PinoLoggerService(logger));
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(requestLogging(logger, app.get(MetricsService)));
  app.useBodyParser('json', { limit: '10kb' });
  // Nest convierte el SyntaxError del body parser en un 400 genérico; acá se conserva el motivo.
  app.use((err: { type?: string }, _req: Request, _res: Response, next: NextFunction) => {
    if (err?.type === 'entity.parse.failed') {
      return next(new BadRequestException({ error: 'invalid_json', message: 'El cuerpo no es JSON válido.' }));
    }
    return next(err);
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          error: 'validation_error',
          message: 'El cuerpo de la petición no es válido.',
          details: flatten(errors),
        }),
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('TP Integrador DevOps — API de tareas')
      .setDescription(
        'API REST de tareas del Trabajo Práctico Integrador de DevOps (Universidad de Palermo). ' +
          'La lógica de negocio es deliberadamente simple: el foco está en el ciclo de vida — CI/CD, ' +
          'contenedores, versionado semántico y observabilidad. Ante un error inesperado se devuelve un ' +
          '`error_id` para correlacionar con los logs, nunca detalles internos.',
      )
      .setVersion(config.version)
      .setLicense('MIT', 'https://opensource.org/licenses/MIT')
      .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'metricsToken')
      .addTag('Tareas', 'CRUD de tareas (repositorio en memoria)')
      .addTag('Operación', 'Salud, readiness, versión y métricas')
      .addTag('Chaos', 'Fallas controladas. Solo existen con CHAOS_ENABLED=true')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
    customSiteTitle: 'TP DevOps — API de tareas',
  });

  return app;
}
