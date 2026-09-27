import type { Projeto } from '../../domain/entidades/projeto.js';
import { naoEncontrado } from '../erros/erro-aplicacao.js';
import type { OrquestradorPadrao } from '../orchestration/orquestrador-padrao.js';
import type { OrquestradorSubstituicao } from '../orchestration/orquestrador-substituicao.js';
import type { Sujeito } from '../ports/observador.js';
import type { Relogio } from '../ports/relogio.js';
import type { RepositorioConvites } from '../ports/repositorio-convites.js';
import type { RepositorioProjetos } from '../ports/repositorio-projetos.js';
import type { RepositorioRecomendacoes } from '../ports/repositorio-recomendacoes.js';
import type { ParametrosRecomendacao } from '../strategies/parametros-recomendacao.js';
import type { RegistroEstrategias } from '../strategies/registro-estrategias.js';

export interface DependenciasCasosDeUso {
  readonly projetos: RepositorioProjetos;
  readonly convites: RepositorioConvites;
  readonly recomendacoes: RepositorioRecomendacoes;
  readonly estrategias: RegistroEstrategias;
  readonly parametros: ParametrosRecomendacao;
  readonly orquestradorPadrao: OrquestradorPadrao;
  readonly orquestradorSubstituicao: OrquestradorSubstituicao;
  readonly sujeito: Sujeito;
  readonly relogio: Relogio;
}

export interface ContextoRequisicao {
  readonly correlacaoId?: string;
}

export async function obterProjeto(
  projetos: RepositorioProjetos,
  projetoId: string,
): Promise<Projeto> {
  const projeto = await projetos.obter(projetoId);
  if (!projeto) {
    throw naoEncontrado('Projeto', projetoId);
  }
  return projeto;
}
