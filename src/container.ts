import type { Logger as Pino } from 'pino';
import type { DataSource } from 'typeorm';
import { OrquestradorPadrao } from './application/orchestration/orquestrador-padrao.js';
import { OrquestradorSubstituicao } from './application/orchestration/orquestrador-substituicao.js';
import { AtualizadorComposicao } from './application/observers/atualizador-composicao.js';
import { AuditoriaRecomendacao } from './application/observers/auditoria-recomendacao.js';
import { NotificadorEmail } from './application/observers/notificador-email.js';
import { NotificadorInterno } from './application/observers/notificador-interno.js';
import { PublicadorIntegracao } from './application/observers/publicador-integracao.js';
import type {
  CaixaMensagens,
  PublicadorExterno,
  RegistroAuditoria,
  ServicoEmail,
} from './application/ports/canais-saida.js';
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
import { relogioDoSistema, type Relogio } from './application/ports/relogio.js';
import { criarCasosDeUso } from './application/use-cases/casos-de-uso.js';
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
import { RepositorioProfissionaisResiliente } from './infrastructure/repositories/repositorio-profissionais-resiliente.js';
import { RepositorioProfissionaisTypeorm } from './infrastructure/repositories/repositorio-profissionais-typeorm.js';
import { DisjuntorCircuito } from './infrastructure/resiliencia/disjuntor.js';
import { RepositorioProjetosTypeorm } from './infrastructure/repositories/repositorio-projetos-typeorm.js';
import {
  CaixaMensagensTypeorm,
  RegistroAuditoriaTypeorm,
  RepositorioConvitesTypeorm,
  RepositorioRecomendacoesTypeorm,
} from './infrastructure/repositories/repositorios-typeorm.js';

export interface CanaisSaida {
  readonly email: ServicoEmail;
  readonly caixa: CaixaMensagens;
  readonly auditoria: RegistroAuditoria;
  readonly publicador: PublicadorExterno;
}

export interface CanaisSaidaMemoria extends CanaisSaida {
  readonly email: ServicoEmailSimulado;
  readonly caixa: CaixaMensagensMemoria;
  readonly auditoria: RegistroAuditoriaLog;
  readonly publicador: PublicadorExternoMemoria;
}

export interface CanaisSaidaContainer extends CanaisSaida {
  readonly email: ServicoEmailSimulado;
  readonly caixa: CaixaMensagensTypeorm;
  readonly auditoria: RegistroAuditoriaTypeorm;
  readonly publicador: PublicadorExternoMemoria;
}

export interface Container extends DependenciasApi {
  readonly config: Config;
  readonly logger: Pino;
  readonly dataSource: DataSource;
  readonly parametros: ParametrosRecomendacao;
  readonly registroEstrategias: RegistroEstrategias;
  readonly repositorioProfissionais: RepositorioProfissionaisTypeorm;
  readonly cadastroProfissionais: RepositorioProfissionaisResiliente;
  readonly repositorioProjetos: RepositorioProjetosTypeorm;
  readonly repositorioConvites: RepositorioConvitesTypeorm;
  readonly repositorioRecomendacoes: RepositorioRecomendacoesTypeorm;
  readonly orquestradorPadrao: OrquestradorPadrao;
  readonly orquestradorSubstituicao: OrquestradorSubstituicao;
  readonly barramento: BarramentoEventosEmMemoria;
  readonly canais: CanaisSaidaContainer;
  encerrar(): Promise<void>;
}

export function criarRegistroEstrategias(): RegistroEstrategias {
  return new RegistroEstrategias([
    new SimilaridadeCosseno(),
    new FiltragemColaborativa(),
    new RegrasOrcamento(),
  ]);
}

export function criarCanaisSaida(logger?: Logger): CanaisSaidaMemoria {
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

export interface OpcoesContainer {
  readonly relogio?: Relogio;
}

export function criarContainer(
  config: Config,
  logger: Pino = criarLogger(config),
  opcoes: OpcoesContainer = {},
): Container {
  const relogio = opcoes.relogio ?? relogioDoSistema;
  const dataSource = criarDataSource(config.banco);
  const parametros = resolverParametros();
  const registroEstrategias = criarRegistroEstrategias();
  const repositorioProfissionais = new RepositorioProfissionaisTypeorm(dataSource);
  const cadastroProfissionais = new RepositorioProfissionaisResiliente(
    repositorioProfissionais,
    new DisjuntorCircuito({
      nome: 'cadastro-profissionais',
      limiteFalhas: config.resiliencia.circuitoLimiteFalhas,
      esperaMs: config.resiliencia.circuitoEsperaMs,
    }),
    { ttlMs: config.resiliencia.cacheTtlMs, timeoutMs: config.resiliencia.cadastroTimeoutMs },
    relogioDoSistema,
    logger,
  );
  const consultarSaude = new ConsultarSaude([
    new VerificadorBanco(dataSource),
    cadastroProfissionais,
  ]);
  const repositorioProjetos = new RepositorioProjetosTypeorm(dataSource, repositorioProfissionais);
  const repositorioConvites = new RepositorioConvitesTypeorm(dataSource);
  const repositorioRecomendacoes = new RepositorioRecomendacoesTypeorm(dataSource);
  const orquestradorPadrao = new OrquestradorPadrao(cadastroProfissionais, relogio);
  const orquestradorSubstituicao = new OrquestradorSubstituicao(cadastroProfissionais, relogio);
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
  const canais: CanaisSaidaContainer = {
    email: new ServicoEmailSimulado(logger),
    caixa: new CaixaMensagensTypeorm(dataSource),
    auditoria: new RegistroAuditoriaTypeorm(dataSource, logger),
    publicador: new PublicadorExternoMemoria(logger),
  };
  const atualizador = new AtualizadorComposicao({
    projetos: repositorioProjetos,
    recomendacoes: repositorioRecomendacoes,
    substituicao: orquestradorSubstituicao,
    estrategias: registroEstrategias,
    parametros,
    sujeito: barramento,
  });
  registrarObservadores(barramento, criarObservadores({ canais, atualizador }));
  const casos = criarCasosDeUso(
    {
      projetos: repositorioProjetos,
      convites: repositorioConvites,
      recomendacoes: repositorioRecomendacoes,
      estrategias: registroEstrategias,
      parametros,
      orquestradorPadrao,
      orquestradorSubstituicao,
      sujeito: barramento,
      relogio,
    },
    { auditoria: canais.auditoria, mensagens: canais.caixa },
  );

  return {
    casos,
    config,
    logger,
    dataSource,
    consultarSaude,
    parametros,
    registroEstrategias,
    repositorioProfissionais,
    cadastroProfissionais,
    repositorioProjetos,
    repositorioConvites,
    repositorioRecomendacoes,
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
