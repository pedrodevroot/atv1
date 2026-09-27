import type { Logger as Pino } from 'pino';
import type { DataSource } from 'typeorm';
import { OrquestradorPadrao } from './application/orchestration/orquestrador-padrao.js';
import { OrquestradorSubstituicao } from './application/orchestration/orquestrador-substituicao.js';
import { AtualizadorComposicao } from './application/observers/atualizador-composicao.js';
import { AuditoriaRecomendacao } from './application/observers/auditoria-recomendacao.js';
import { NotificadorEmail } from './application/observers/notificador-email.js';
import { NotificadorInterno } from './application/observers/notificador-interno.js';
import { PublicadorIntegracao } from './application/observers/publicador-integracao.js';
import type { Logger } from './application/ports/logger.js';
import type { Observador, Sujeito } from './application/ports/observador.js';
import { FiltragemColaborativa } from './application/strategies/filtragem-colaborativa.js';
import {
  resolverParametros,
  type ParametrosRecomendacao,
} from './application/strategies/parametros-recomendacao.js';
import { RegistroEstrategias } from './application/strategies/registro-estrategias.js';
import { RegrasOrcamento } from './application/strategies/regras-orcamento.js';
import { SimilaridadeCosseno } from './application/strategies/similaridade-cosseno.js';
import { ConsultarSaude } from './application/use-cases/consultar-saude.js';
import type { DependenciasApi } from './app.js';
import type { Config } from './config/config.js';
import { criarDataSource } from './infrastructure/database/data-source.js';
import { VerificadorBanco } from './infrastructure/database/verificador-banco.js';
import { criarLogger } from './infrastructure/logging/opcoes-logger.js';
import { BarramentoEventosEmMemoria } from './infrastructure/messaging/barramento-eventos-memoria.js';
import {
  CaixaMensagensMemoria,
  PublicadorExternoMemoria,
  RegistroAuditoriaLog,
  ServicoEmailSimulado,
} from './infrastructure/notifications/canais-simulados.js';
import { RepositorioProfissionaisMemoria } from './infrastructure/repositories/repositorio-profissionais-memoria.js';
import { RepositorioProjetosMemoria } from './infrastructure/repositories/repositorio-projetos-memoria.js';

export interface CanaisSaida {
  readonly email: ServicoEmailSimulado;
  readonly caixa: CaixaMensagensMemoria;
  readonly auditoria: RegistroAuditoriaLog;
  readonly publicador: PublicadorExternoMemoria;
}

export interface Container extends DependenciasApi {
  readonly config: Config;
  readonly logger: Pino;
  readonly dataSource: DataSource;
  readonly parametros: ParametrosRecomendacao;
  readonly registroEstrategias: RegistroEstrategias;
  readonly repositorioProfissionais: RepositorioProfissionaisMemoria;
  readonly repositorioProjetos: RepositorioProjetosMemoria;
  readonly orquestradorPadrao: OrquestradorPadrao;
  readonly orquestradorSubstituicao: OrquestradorSubstituicao;
  readonly barramento: BarramentoEventosEmMemoria;
  readonly canais: CanaisSaida;
  encerrar(): Promise<void>;
}

export function criarRegistroEstrategias(): RegistroEstrategias {
  return new RegistroEstrategias([
    new SimilaridadeCosseno(),
    new FiltragemColaborativa(),
    new RegrasOrcamento(),
  ]);
}

export function criarCanaisSaida(logger?: Logger): CanaisSaida {
  return {
    email: new ServicoEmailSimulado(logger),
    caixa: new CaixaMensagensMemoria(),
    auditoria: new RegistroAuditoriaLog(logger),
    publicador: new PublicadorExternoMemoria(logger),
  };
}

export interface DependenciasObservadores {
  readonly canais: CanaisSaida;
  readonly atualizador: AtualizadorComposicao;
}

export function criarObservadores({ canais, atualizador }: DependenciasObservadores): Observador[] {
  return [
    new NotificadorEmail(canais.email),
    new NotificadorInterno(canais.caixa),
    new AuditoriaRecomendacao(canais.auditoria, new Set([atualizador.nome])),
    atualizador,
    new PublicadorIntegracao(canais.publicador),
  ];
}

export function registrarObservadores(sujeito: Sujeito, observadores: readonly Observador[]): void {
  for (const observador of observadores) {
    sujeito.adicionarObservador(observador);
  }
}

export function criarContainer(config: Config, logger: Pino = criarLogger(config)): Container {
  const dataSource = criarDataSource(config.banco);
  const consultarSaude = new ConsultarSaude([new VerificadorBanco(dataSource)]);
  const parametros = resolverParametros();
  const registroEstrategias = criarRegistroEstrategias();
  const repositorioProfissionais = new RepositorioProfissionaisMemoria();
  const repositorioProjetos = new RepositorioProjetosMemoria();
  const orquestradorPadrao = new OrquestradorPadrao(repositorioProfissionais);
  const orquestradorSubstituicao = new OrquestradorSubstituicao(repositorioProfissionais);
  const barramento = new BarramentoEventosEmMemoria((falha) => {
    logger.error(
      {
        observador: falha.observador,
        eventoId: falha.evento.id,
        tipo: falha.evento.tipo,
        err: falha.erro,
      },
      'Observador falhou ao processar evento',
    );
  });
  const canais = criarCanaisSaida(logger);
  const atualizador = new AtualizadorComposicao({
    projetos: repositorioProjetos,
    substituicao: orquestradorSubstituicao,
    estrategias: registroEstrategias,
    parametros,
    sujeito: barramento,
  });
  registrarObservadores(barramento, criarObservadores({ canais, atualizador }));

  return {
    config,
    logger,
    dataSource,
    consultarSaude,
    parametros,
    registroEstrategias,
    repositorioProfissionais,
    repositorioProjetos,
    orquestradorPadrao,
    orquestradorSubstituicao,
    barramento,
    canais,
    async encerrar() {
      await barramento.aguardarEntregas();
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    },
  };
}
