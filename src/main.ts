import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfig, loadConfig } from './config';
import { createLogger } from './logger';

async function bootstrap(): Promise<void> {
  let config: AppConfig;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    // Fail fast: sin configuración válida el proceso no arranca a medias.
    createLogger().fatal({ reason: (error as Error).message }, 'invalid configuration');
    process.exit(1);
  }

  const logger = createLogger({ level: config.logLevel, version: config.version });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled rejection');
    process.exit(1);
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule.register({ config }), {
    bodyParser: false,
    bufferLogs: true,
  });
  configureApp(app, { config, logger });
  app.enableShutdownHooks();

  await app.listen(config.port, config.host);
  logger.info({ port: config.port, commit: config.gitSha }, 'server started');
}

void bootstrap();
