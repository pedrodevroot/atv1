import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp, type App } from '../../src/app.js';
import { carregarConfig } from '../../src/config/config.js';
import { criarContainer, type Container } from '../../src/container.js';
import { criarLogger } from '../../src/infrastructure/logging/opcoes-logger.js';
import { RepositorioProfissionaisTypeorm } from '../../src/infrastructure/repositories/repositorio-profissionais-typeorm.js';
import { cadastroDaApi } from '../fixtures/api.js';
import { executarFluxoCompleto } from '../fixtures/fluxo-api.js';
import { relogioFixo } from '../fixtures/orquestracao.js';
import { limparTabelas, prepararBanco } from './banco.js';

describe('Fluxo completo da API com PostgreSQL real', () => {
  let banco: DataSource;
  let container: Container;
  let app: App;

  beforeAll(async () => {
    banco = await prepararBanco();
    await limparTabelas(banco);
    await new RepositorioProfissionaisTypeorm(banco).salvarTodos(cadastroDaApi());
    const config = carregarConfig();
    container = criarContainer(config, criarLogger(config), { relogio: relogioFixo });
    await container.dataSource.initialize();
    app = await construirApp(container);
  });

  afterAll(async () => {
    await app.close();
    await container.encerrar();
    await banco.destroy();
  });

  it('persiste cada passo do fluxo e publica a equipe formada para os outros microsserviços', async () => {
    const projetoId = await executarFluxoCompleto(app, () =>
      container.barramento.aguardarEntregas(),
    );

    const projeto = await container.repositorioProjetos.obter(projetoId);
    const [convites] = await banco.query<{ total: string }[]>(
      'SELECT count(*) AS total FROM convite WHERE projeto_id = $1',
      [projetoId],
    );

    expect(projeto?.equipeFormada).toBeDefined();
    expect(Number(convites?.total)).toBe(3);
    expect(container.canais.publicador.publicadas.total).toBe(2);
  });
});
