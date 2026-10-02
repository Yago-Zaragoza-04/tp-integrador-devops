import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ChaosController } from './chaos.controller';
import { APP_CONFIG, AppConfig } from './config';
import { AppState, HealthController } from './health.controller';
import { MetricsAuthGuard, MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

export interface AppModuleOptions {
  config: AppConfig;
}

/**
 * Módulo raíz. Recibe la configuración ya validada desde afuera (main.ts o los tests),
 * así ningún componente lee el entorno por su cuenta.
 */
@Module({})
export class AppModule {
  static register({ config }: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        TerminusModule.forRoot({ logger: false }),
        // Rate limit por IP para toda la API (OWASP A01/A06); los endpoints operativos lo saltean.
        ThrottlerModule.forRoot({ throttlers: [{ ttl: config.rateLimit.windowMs, limit: config.rateLimit.max }] }),
      ],
      controllers: [HealthController, MetricsController, TasksController, ChaosController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: MetricsService, useFactory: () => new MetricsService(config.version) },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        AppState,
        MetricsAuthGuard,
        TasksService,
      ],
    };
  }
}
