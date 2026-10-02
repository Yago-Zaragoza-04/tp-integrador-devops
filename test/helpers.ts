import { Writable } from 'node:stream';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { AppConfig, loadConfig } from '../src/config';
import { createLogger } from '../src/logger';

export type LogEntry = Record<string, unknown>;

export interface TestApp {
  app: NestExpressApplication;
  server: App;
  config: AppConfig;
  logs: LogEntry[];
}

/**
 * Levanta la aplicación completa (mismo módulo y misma configureApp que producción),
 * capturando los logs JSON en memoria.
 */
export async function createTestApp(env: Record<string, string> = {}): Promise<TestApp> {
  const config = loadConfig({ NODE_ENV: 'test', APP_VERSION: '9.9.9-test', GIT_SHA: 'abc1234', ...env });
  const logs: LogEntry[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        logs.push(JSON.parse(line) as LogEntry);
      }
      callback();
    },
  });
  const logger = createLogger({ level: 'debug', version: config.version, destination });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule.register({ config })] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
  configureApp(app, { config, logger });
  await app.init();
  return { app, server: app.getHttpServer() as App, config, logs };
}

/** Los logs de request se emiten en el evento 'finish' de la respuesta: se espera un tick. */
export const flushLogs = () => new Promise((resolve) => setImmediate(resolve));

export const requestLogs = (logs: LogEntry[]) => logs.filter((entry) => entry.msg === 'request completed');
