import type { FastifyServerOptions } from 'fastify';
import type { Config } from '../../config/config.js';

export function criarOpcoesLogger(config: Config): FastifyServerOptions['logger'] {
  if (config.ambiente === 'test') {
    return false;
  }
  const base = {
    level: config.log.nivel,
    base: { servico: 'cinebridge-recomendacao' },
    redact: ['req.headers.authorization'],
  };
  if (config.ambiente === 'development') {
    return {
      ...base,
      transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss.l' } },
    };
  }
  return base;
}
