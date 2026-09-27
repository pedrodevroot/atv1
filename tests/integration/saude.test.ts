import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp, type App } from '../../src/app.js';
import { carregarConfig } from '../../src/config/config.js';
import { criarContainer, type Container } from '../../src/container.js';

describe('GET /health com PostgreSQL real', () => {
  let container: Container;
  let app: App;

  beforeAll(async () => {
    container = criarContainer(carregarConfig());
    app = await construirApp(container);
    app.addHook('onClose', () => container.encerrar());
  });

  afterAll(async () => {
    await app.close();
  });

  it('reporta o banco como disponível', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/health' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({
      status: 'ok',
      dependencias: { postgres: 'disponivel' },
    });
  });

  it('conecta no PostgreSQL 18 ou superior', async () => {
    const [linha] = await container.dataSource.query<{ versao: string }[]>(
      "SELECT current_setting('server_version') AS versao",
    );

    expect(container.dataSource.isInitialized).toBe(true);
    expect(Number.parseInt(linha?.versao ?? '0', 10)).toBeGreaterThanOrEqual(18);
  });
});
