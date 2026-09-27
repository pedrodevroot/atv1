import {
  AceitarMembro,
  FinalizarEquipe,
  RejeitarMembro,
  ResponderConvite,
  SubstituirMembro,
} from './casos-equipe.js';
import {
  ConsultasRecomendacao,
  type LeitorAuditoria,
  type LeitorMensagens,
} from './casos-consulta.js';
import {
  CriarProjetoERecomendar,
  GerarRodadaRecomendacao,
  ReavaliarProjeto,
  RecomendarNovamente,
} from './casos-projeto.js';
import type { DependenciasCasosDeUso } from './dependencias.js';

export interface CasosDeUso {
  readonly criarProjeto: CriarProjetoERecomendar;
  readonly recomendarNovamente: RecomendarNovamente;
  readonly reavaliarProjeto: ReavaliarProjeto;
  readonly aceitarMembro: AceitarMembro;
  readonly rejeitarMembro: RejeitarMembro;
  readonly substituirMembro: SubstituirMembro;
  readonly responderConvite: ResponderConvite;
  readonly finalizarEquipe: FinalizarEquipe;
  readonly consultas: ConsultasRecomendacao;
}

export function criarCasosDeUso(
  deps: DependenciasCasosDeUso,
  leitores: { auditoria: LeitorAuditoria; mensagens: LeitorMensagens },
): CasosDeUso {
  const gerarRodada = new GerarRodadaRecomendacao(deps);
  return {
    criarProjeto: new CriarProjetoERecomendar(deps, gerarRodada),
    recomendarNovamente: new RecomendarNovamente(deps, gerarRodada),
    reavaliarProjeto: new ReavaliarProjeto(deps, gerarRodada),
    aceitarMembro: new AceitarMembro(deps),
    rejeitarMembro: new RejeitarMembro(deps),
    substituirMembro: new SubstituirMembro(deps),
    responderConvite: new ResponderConvite(deps),
    finalizarEquipe: new FinalizarEquipe(deps),
    consultas: new ConsultasRecomendacao(deps, leitores.auditoria, leitores.mensagens),
  };
}
