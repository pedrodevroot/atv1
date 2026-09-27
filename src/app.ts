import { randomUUID } from 'node:crypto';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { type FastifyBaseLogger } from 'fastify';
import { tratarErro } from './api/erros/tratador-erros.js';
import { rotasSaude } from './api/routes/saude.routes.js';
import { RespostaErro } from './api/schemas/comum.schema.js';
import type { ConsultarSaude } from './application/use-cases/consultar-saude.js';

export interface DependenciasApi {
  consultarSaude: ConsultarSaude;
}

export interface OpcoesApp {
  logger?: FastifyBaseLogger;
}

export async function construirApp(dependencias: DependenciasApi, opcoes: OpcoesApp = {}) {
  const app = Fastify({
    ...(opcoes.logger ? { loggerInstance: opcoes.logger } : { logger: false }),
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.addHook('onSend', async (requisicao, resposta) => {
    void resposta.header('x-request-id', requisicao.id);
  });
  app.setErrorHandler(tratarErro);
  app.addSchema(RespostaErro);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'CineBridge - Recomendação e Orquestração de Equipes',
        version: '0.1.0',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(rotasSaude(dependencias.consultarSaude));

  return app;
}

export type App = Awaited<ReturnType<typeof construirApp>>;
