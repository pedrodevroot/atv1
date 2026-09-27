import type { Profissional } from '../../domain/entidades/profissional.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Papel } from '../../domain/enums/papel.js';
import type { CandidatoRanqueado, RankingPorPapel } from './estrategia-recomendacao.js';
import type { ContextoPapel, FiltroCandidato } from './filtros-candidato.js';
import type { ParametrosRecomendacao } from './parametros-recomendacao.js';
import { arredondar, limitarEntreZeroEUm, type Pontuacao } from './pontuacao.js';

export type Avaliador = (profissional: Profissional) => Pontuacao;

export interface OpcoesRanqueamento {
  readonly projeto: Projeto;
  readonly profissionais: readonly Profissional[];
  readonly parametros: ParametrosRecomendacao;
  readonly filtros: readonly FiltroCandidato[];
  readonly folgaTeto: number;
  avaliadorPara(contexto: ContextoPapel): Avaliador;
}

export function calcularTetoPapel(projeto: Projeto, papel: Papel, folga: number): number {
  return projeto.orcamento * projeto.pesoNormalizado(papel) * (1 + folga);
}

export function ranquearPorPapel(opcoes: OpcoesRanqueamento): RankingPorPapel {
  const { projeto, profissionais, parametros, filtros } = opcoes;
  const ranking = new Map<Papel, CandidatoRanqueado[]>();

  for (const papel of projeto.papeisObrigatorios) {
    const contexto: ContextoPapel = {
      projeto,
      papel,
      teto: calcularTetoPapel(projeto, papel, opcoes.folgaTeto),
      parametros,
    };
    const avaliar = opcoes.avaliadorPara(contexto);
    const candidatos: CandidatoRanqueado[] = [];

    for (const profissional of profissionais) {
      if (!filtros.every((filtro) => filtro.aceita(profissional, contexto))) {
        continue;
      }
      const pontuacao = avaliar(profissional);
      candidatos.push({
        profissional,
        papel,
        score: arredondar(limitarEntreZeroEUm(pontuacao.score)),
        custoEstimado: arredondar(profissional.faixaPreco.precoNegociado(contexto.teto), 2),
        justificativa: pontuacao.justificativa,
      });
    }

    ranking.set(papel, candidatos.sort(compararCandidatos).slice(0, parametros.topN));
  }

  return ranking;
}

function compararCandidatos(a: CandidatoRanqueado, b: CandidatoRanqueado): number {
  return (
    b.score - a.score ||
    a.custoEstimado - b.custoEstimado ||
    a.profissional.id.localeCompare(b.profissional.id)
  );
}
