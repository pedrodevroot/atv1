import { describe, expect, it } from 'vitest';
import type { Observador } from '../../../src/application/ports/observador.js';
import { carregarConfig } from '../../../src/config/config.js';
import { criarContainer } from '../../../src/container.js';
import { BarramentoEventosEmMemoria } from '../../../src/infrastructure/messaging/barramento-eventos-memoria.js';
import { eventoRecomendacao } from '../../fixtures/eventos.js';

describe('BarramentoEventosEmMemoria', () => {
  it('ignora inscrição repetida e remoção de observador desconhecido', async () => {
    const barramento = new BarramentoEventosEmMemoria();
    let chamadas = 0;
    const observador: Observador = {
      nome: 'contador',
      interesses: ['RECOMENDACAO_GERADA'],
      atualizar: () => {
        chamadas += 1;
        return Promise.resolve();
      },
    };

    barramento.adicionarObservador(observador);
    barramento.adicionarObservador(observador);
    barramento.removerObservador({ ...observador });
    barramento.notificarObservadores(eventoRecomendacao());
    await barramento.aguardarEntregas();

    expect(chamadas).toBe(1);
    expect(barramento.observadores).toEqual(['contador']);
  });

  it('isola até um tratador de falhas que também falha', async () => {
    const barramento = new BarramentoEventosEmMemoria(() => {
      throw new Error('logger quebrado');
    });
    barramento.adicionarObservador({
      nome: 'falho',
      interesses: '*',
      atualizar: () => {
        throw new Error('erro síncrono');
      },
    });

    barramento.notificarObservadores(eventoRecomendacao());

    await expect(barramento.aguardarEntregas()).resolves.toBeUndefined();
  });
});

describe('criarContainer', () => {
  const config = carregarConfig({ NODE_ENV: 'test', DB_USER: 'u', DB_PASSWORD: 's', DB_NAME: 'b' });

  it('liga os cinco observadores ao barramento por injeção explícita', () => {
    const container = criarContainer(config);

    expect(container.barramento.observadores).toEqual([
      'notificador-email',
      'notificador-interno',
      'auditoria-recomendacao',
      'atualizador-composicao',
      'publicador-integracao',
    ]);
  });

  it('registra no log a falha de um observador e aguarda as entregas ao encerrar', async () => {
    const container = criarContainer(config);
    const erros: string[] = [];
    container.logger.error = ((_dados: object, mensagem: string) => {
      erros.push(mensagem);
    }) as typeof container.logger.error;
    container.barramento.adicionarObservador({
      nome: 'falho',
      interesses: '*',
      atualizar: () => Promise.reject(new Error('x')),
    });

    container.barramento.notificarObservadores(eventoRecomendacao());
    await container.encerrar();

    expect(erros).toEqual(['Observador falhou ao processar evento']);
    expect(container.canais.email.enviados.total).toBe(2);
  });
});
