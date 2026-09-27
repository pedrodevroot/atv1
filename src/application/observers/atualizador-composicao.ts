import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Recomendacao } from '../../domain/entidades/recomendacao.js';
import {
  criarEvento,
  type EventoDoTipo,
  type EventoRecomendacao,
  type TipoEvento,
} from '../../domain/eventos/evento-recomendacao.js';
import { eventoRecomendacaoGerada } from '../eventos/fabrica-eventos.js';
import type { OrquestradorSubstituicao } from '../orchestration/orquestrador-substituicao.js';
import type { Observador, Sujeito } from '../ports/observador.js';
import type { RepositorioProjetos } from '../ports/repositorio-projetos.js';
import type { RepositorioRecomendacoes } from '../ports/repositorio-recomendacoes.js';
import type { ParametrosRecomendacao } from '../strategies/parametros-recomendacao.js';
import type { RegistroEstrategias } from '../strategies/registro-estrategias.js';

export const ORIGEM_ATUALIZADOR = 'atualizador-composicao';

export interface DependenciasAtualizador {
  readonly projetos: RepositorioProjetos;
  readonly recomendacoes?: RepositorioRecomendacoes;
  readonly substituicao: OrquestradorSubstituicao;
  readonly estrategias: RegistroEstrategias;
  readonly parametros: ParametrosRecomendacao;
  readonly sujeito: Sujeito;
}

type RespostaConvite = EventoDoTipo<'CONVITE_ACEITO'> | EventoDoTipo<'CONVITE_RECUSADO'>;

export class AtualizadorComposicao implements Observador {
  readonly nome = ORIGEM_ATUALIZADOR;
  readonly interesses: readonly TipoEvento[] = ['CONVITE_ACEITO', 'CONVITE_RECUSADO'];

  constructor(private readonly dependencias: DependenciasAtualizador) {}

  async atualizar(evento: EventoRecomendacao): Promise<void> {
    if (evento.tipo !== 'CONVITE_ACEITO' && evento.tipo !== 'CONVITE_RECUSADO') {
      return;
    }
    const { projetos, sujeito } = this.dependencias;
    const { projetoId, equipeId, papel } = evento.dados;
    const projeto = await projetos.obter(projetoId);
    if (!projeto) {
      throw new Error(`Projeto ${projetoId} não encontrado para atualizar a composição.`);
    }

    const aceito = evento.tipo === 'CONVITE_ACEITO';
    projeto.registrarRespostaConvite(equipeId, papel, aceito);
    const rodada = aceito
      ? { eventos: [], recomendacoes: [] }
      : await this.iniciarNovaRodada(projeto, evento);

    await projetos.salvar(projeto);
    await this.dependencias.recomendacoes?.salvarTodas(rodada.recomendacoes);
    for (const seguinte of rodada.eventos) {
      sujeito.notificarObservadores(seguinte);
    }
  }

  private async iniciarNovaRodada(
    projeto: Projeto,
    evento: RespostaConvite,
  ): Promise<{ eventos: EventoRecomendacao[]; recomendacoes: readonly Recomendacao[] }> {
    const { substituicao, estrategias, parametros } = this.dependencias;
    const { projetoId, produtorId, equipeId, papel, profissionalId } = evento.dados;
    const opcoes = { origem: ORIGEM_ATUALIZADOR, correlacaoId: evento.correlacaoId ?? evento.id };
    const estrategia = estrategias.resolver(projeto);
    const resultado = await substituicao.orquestrar({
      projeto,
      estrategia,
      parametros,
      equipeId,
      papel,
    });
    const novoMembro = projeto.equipe(equipeId).membro(papel);
    const eventos: EventoRecomendacao[] = [
      criarEvento(
        'SUBSTITUICAO_SOLICITADA',
        { projetoId, produtorId, equipeId, papel, profissionalAnteriorId: profissionalId },
        opcoes,
      ),
    ];
    if (novoMembro && novoMembro.profissional.id !== profissionalId) {
      eventos.push(
        eventoRecomendacaoGerada(
          {
            projeto,
            equipes: resultado.equipes,
            membros: [novoMembro],
            estrategia: estrategia.nome,
            rodada: resultado.rodada,
            parcial: resultado.parcial,
          },
          opcoes,
        ),
      );
    }
    return { eventos, recomendacoes: resultado.recomendacoes };
  }
}
