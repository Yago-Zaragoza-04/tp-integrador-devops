export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: string;
  version: string;
  gitSha: string;
  chaosEnabled: boolean;
  metricsToken?: string;
  rateLimit: { max: number; windowMs: number };
  trustProxy: number;
}

export class ConfigError extends Error {
  constructor(readonly issues: string[]) {
    super(`Configuración inválida: ${issues.join('; ')}`);
    this.name = 'ConfigError';
  }
}

type Env = Record<string, string | undefined>;

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const NODE_ENVS = ['development', 'test', 'production'] as const;

/**
 * Lee la configuración del entorno y falla rápido si algo es inválido (fail-secure):
 * sin configuración válida el proceso no arranca a medias. Las variables vacías toman su default.
 */
export function loadConfig(env: Env = process.env): AppConfig {
  const issues: string[] = [];
  const raw = (name: string): string | undefined => (env[name] === '' ? undefined : env[name]);

  const integer = (name: string, fallback: number, min: number, max: number): number => {
    const value = raw(name);
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      issues.push(`${name} debe ser un entero entre ${min} y ${max} (recibido "${value}")`);
      return fallback;
    }
    return parsed;
  };

  const oneOf = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => {
    const value = raw(name);
    if (value === undefined) return fallback;
    if (!allowed.includes(value as T)) {
      issues.push(`${name} debe ser uno de ${allowed.join(', ')} (recibido "${value}")`);
      return fallback;
    }
    return value as T;
  };

  const boolean = (name: string): boolean => {
    const value = oneOf(name, ['true', 'false', '1', '0'], 'false');
    return value === 'true' || value === '1';
  };

  const metricsToken = raw('METRICS_TOKEN');
  if (metricsToken !== undefined && metricsToken.length < 16) {
    issues.push('METRICS_TOKEN debe tener al menos 16 caracteres');
  }

  const config: AppConfig = {
    env: oneOf('NODE_ENV', NODE_ENVS, 'production'),
    host: raw('HOST') ?? '0.0.0.0',
    port: integer('PORT', 3000, 1, 65535),
    logLevel: oneOf('LOG_LEVEL', LOG_LEVELS, 'info'),
    version: raw('APP_VERSION') ?? '0.0.0-dev',
    gitSha: raw('GIT_SHA') ?? 'unknown',
    chaosEnabled: boolean('CHAOS_ENABLED'),
    metricsToken,
    rateLimit: {
      max: integer('RATE_LIMIT_MAX', 300, 1, 1_000_000),
      windowMs: integer('RATE_LIMIT_WINDOW_MS', 60_000, 1000, 3_600_000),
    },
    trustProxy: integer('TRUST_PROXY', 0, 0, 10),
  };

  if (issues.length > 0) {
    throw new ConfigError(issues);
  }
  return Object.freeze(config);
}
