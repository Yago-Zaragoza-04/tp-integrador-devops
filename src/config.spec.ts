import { ConfigError, loadConfig } from './config';

describe('loadConfig', () => {
  it('aplica valores por defecto seguros', () => {
    expect(loadConfig({})).toMatchObject({
      port: 3000,
      host: '0.0.0.0',
      env: 'production',
      chaosEnabled: false,
      metricsToken: undefined,
      rateLimit: { max: 300, windowMs: 60_000 },
    });
  });

  it('las variables vacías toman el valor por defecto', () => {
    expect(loadConfig({ PORT: '', CHAOS_ENABLED: '' }).port).toBe(3000);
  });

  it('interpreta booleanos y números del entorno', () => {
    expect(loadConfig({ PORT: '10000', CHAOS_ENABLED: 'true', TRUST_PROXY: '1' })).toMatchObject({
      port: 10000,
      chaosEnabled: true,
      trustProxy: 1,
    });
    expect(loadConfig({ CHAOS_ENABLED: '1' }).chaosEnabled).toBe(true);
  });

  it('falla rápido ante un PORT inválido nombrando la variable', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });

  it('reporta todos los problemas juntos', () => {
    expect.assertions(1);
    try {
      loadConfig({ PORT: '0', LOG_LEVEL: 'verbose', METRICS_TOKEN: 'corto', CHAOS_ENABLED: 'quizas' });
    } catch (error) {
      expect((error as ConfigError).issues).toHaveLength(4);
    }
  });
});
