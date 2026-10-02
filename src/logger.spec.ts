import { Writable } from 'node:stream';
import { createLogger, PinoLoggerService } from './logger';

function capture() {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      callback();
    },
  });
  return { lines, logger: createLogger({ level: 'trace', version: '1.2.3', destination }) };
}

describe('logger', () => {
  it('emite JSON con timestamp ISO, level como texto, servicio y versión', () => {
    const { lines, logger } = capture();
    logger.info({ path: '/x' }, 'hola');
    expect(lines[0]).toMatchObject({ level: 'info', msg: 'hola', service: 'tp-integrador-devops', version: '1.2.3' });
    expect(lines[0].timestamp).toMatch(/Z$/);
  });

  it('redacta el header authorization', () => {
    const { lines, logger } = capture();
    logger.info({ headers: { authorization: 'Bearer secreto' } }, 'req');
    expect(JSON.stringify(lines)).not.toContain('secreto');
  });

  it('PinoLoggerService traduce los niveles de Nest y baja a debug los mensajes de arranque', () => {
    const { lines, logger } = capture();
    const nest = new PinoLoggerService(logger);
    nest.log('Mapped route', 'RouterExplorer');
    nest.log('Nest application successfully started', 'NestApplication');
    nest.warn('w', 'Ctx');
    nest.error('e', 'trace', 'Ctx');
    nest.debug('d', 'Ctx');
    nest.verbose('v', 'Ctx');
    nest.fatal('f', 'Ctx');
    expect(lines.map((l) => l.level)).toEqual(['debug', 'info', 'warn', 'error', 'debug', 'trace', 'fatal']);
  });
});
