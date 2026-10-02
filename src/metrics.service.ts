import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Registro de métricas por instancia de la app (evita colisiones entre tests).
 * Golden signals: tráfico (counter), latencia (histograma) y errores (label status_code).
 */
export class MetricsService {
  readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Cantidad de requests HTTP atendidos',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });

  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duración de los requests HTTP en segundos',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  constructor(version: string) {
    this.registry.setDefaultLabels({ service: 'tp-integrador-devops' });
    collectDefaultMetrics({ register: this.registry });

    const buildInfo = new Counter({
      name: 'app_build_info',
      help: 'Versión desplegada de la aplicación (valor constante 1)',
      labelNames: ['version'] as const,
      registers: [this.registry],
    });
    buildInfo.inc({ version });
  }

  observe(labels: { method: string; route: string; status_code: string }, durationSeconds: number): void {
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationSeconds);
  }
}
