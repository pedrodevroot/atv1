import { Convite } from '../../domain/entidades/convite.js';
import type { Equipe } from '../../domain/entidades/equipe.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import type { Papel } from '../../domain/enums/papel.js';
import { criarEvento, type EventoRecomendacao } from '../../domain/eventos/evento-recomendacao.js';
import { comNovasTentativas, naoEncontrado } from '../erros/erro-aplicacao.js';
import { ORIGEM_SERVICO, eventoRecomendacaoGerada } from '../eventos/fabrica-eventos.js';
import type { ResultadoOrquestracao } from '../orchestration/orquestrador-equipe.js';
import {
  obterProjeto,
  type ContextoRequisicao,
  type DependenciasCasosDeUso,
} from './dependencias.js';

export interface AlvoMembro {
  readonly projetoId: string;
  readonly equipeId: string;
  readonly papel: Papel;
}

abstract class CasoDeEquipe {
  constructor(protected readonly deps: DependenciasCasosDeUso) {}

  protected opcoesEvento(contexto: ContextoRequisicao) {
    return { origem: ORIGEM_SERVICO, ...contexto };
  }

  protected async cancelarConvitePendente(equipeId: string, papel: Papel): Promise<void> {
    const pendente = await this.deps.convites.pendenteDoPapel(equipeId, papel);
    if (pendente) {
      pendente.cancelar();
      await this.deps.convites.salvar(pendente);
    }
  }

  protected publicar(eventos: readonly EventoRecomendacao[]): void {
    for (const evento of eventos) {
      this.deps.sujeito.notificarObservadores(evento);
    }
  }
}

export class AceitarMembro extends CasoDeEquipe {
  executar(
    alvo: AlvoMembro,
    contexto: ContextoRequisicao,
  ): Promise<{ projeto: Projeto; convite: Convite }> {
    return comNovasTentativas(() => this.tentar(alvo, contexto));
  }

  private async tentar(
    alvo: AlvoMembro,
    contexto: ContextoRequisicao,
  ): Promise<{ projeto: Projeto; convite: Convite }> {
    const projeto = await obterProjeto(this.deps.projetos, alvo.projetoId);
    const membro = projeto.aceitarRecomendacao(alvo.equipeId, alvo.papel);
    const convite = Convite.criar({
      projetoId: projeto.id,
      equipeId: alvo.equipeId,
      papel: alvo.papel,
      profissionalId: membro.profissional.id,
      produtorId: projeto.produtorId,
      criadoEm: this.deps.relogio(),
    });
    await this.deps.projetos.salvar(projeto);
    await this.deps.convites.salvar(convite);
    this.publicar([
      criarEvento(
        'CONVITE_ENVIADO',
        {
          conviteId: convite.id,
          projetoId: projeto.id,
          produtorId: projeto.produtorId,
          equipeId: alvo.equipeId,
          papel: alvo.papel,
          profissionalId: membro.profissional.id,
          expiraEm: convite.expiraEm.toISOString(),
        },
        this.opcoesEvento(contexto),
      ),
    ]);
    return { projeto, convite };
  }
}

export class RejeitarMembro extends CasoDeEquipe {
  executar(alvo: AlvoMembro, contexto: ContextoRequisicao): Promise<Projeto> {
    return comNovasTentativas(() => this.tentar(alvo, contexto));
  }

  private async tentar(alvo: AlvoMembro, contexto: ContextoRequisicao): Promise<Projeto> {
    const projeto = await obterProjeto(this.deps.projetos, alvo.projetoId);
    const rejeitado = projeto.rejeitarRecomendacao(alvo.equipeId, alvo.papel);
    await this.deps.projetos.salvar(projeto);
    await this.cancelarConvitePendente(alvo.equipeId, alvo.papel);
    this.publicar([
      criarEvento(
        'MEMBRO_REJEITADO',
        {
          projetoId: projeto.id,
          produtorId: projeto.produtorId,
          equipeId: alvo.equipeId,
          papel: alvo.papel,
          profissionalId: rejeitado.profissional.id,
        },
        this.opcoesEvento(contexto),
      ),
    ]);
    return projeto;
  }
}

export class SubstituirMembro extends CasoDeEquipe {
  executar(
    alvo: AlvoMembro,
    opcoes: { estrategia?: string },
    contexto: ContextoRequisicao,
  ): Promise<{ projeto: Projeto; resultado: ResultadoOrquestracao }> {
    return comNovasTentativas(() => this.tentar(alvo, opcoes, contexto));
  }

  private async tentar(
    alvo: AlvoMembro,
    opcoes: { estrategia?: string },
    contexto: ContextoRequisicao,
  ): Promise<{ projeto: Projeto; resultado: ResultadoOrquestracao }> {
    const { projetos, estrategias, orquestradorSubstituicao, recomendacoes, parametros } =
      this.deps;
    const projeto = await obterProjeto(projetos, alvo.projetoId);
    const anterior = projeto.equipe(alvo.equipeId).membro(alvo.papel);
    const estrategia = estrategias.resolver(projeto, opcoes.estrategia);

    const resultado = await orquestradorSubstituicao.orquestrar({
      projeto,
      estrategia,
      parametros,
      equipeId: alvo.equipeId,
      papel: alvo.papel,
    });
    await projetos.salvar(projeto);
    await this.cancelarConvitePendente(alvo.equipeId, alvo.papel);
    await recomendacoes.salvarTodas(resultado.recomendacoes);

    const novo = projeto.equipe(alvo.equipeId).membro(alvo.papel);
    const opcoesEvento = this.opcoesEvento(contexto);
    this.publicar([
      criarEvento(
        'SUBSTITUICAO_SOLICITADA',
        {
          projetoId: projeto.id,
          produtorId: projeto.produtorId,
          equipeId: alvo.equipeId,
          papel: alvo.papel,
          ...(anterior ? { profissionalAnteriorId: anterior.profissional.id } : {}),
        },
        opcoesEvento,
      ),
      ...(novo && novo !== anterior
        ? [
            eventoRecomendacaoGerada(
              {
                projeto,
                equipes: resultado.equipes,
                membros: [novo],
                estrategia: estrategia.nome,
                rodada: resultado.rodada,
                parcial: resultado.parcial,
              },
              opcoesEvento,
            ),
          ]
        : []),
    ]);
    return { projeto, resultado };
  }
}

export class ResponderConvite extends CasoDeEquipe {
  async executar(
    conviteId: string,
    aceito: boolean,
    contexto: ContextoRequisicao,
  ): Promise<Convite> {
    const convite = await this.deps.convites.obter(conviteId);
    if (!convite) {
      throw naoEncontrado('Convite', conviteId);
    }
    if (aceito) {
      convite.aceitar(this.deps.relogio());
    } else {
      convite.recusar(this.deps.relogio());
    }
    await this.deps.convites.salvar(convite);
    const dados = {
      conviteId: convite.id,
      projetoId: convite.projetoId,
      produtorId: convite.produtorId,
      equipeId: convite.equipeId,
      papel: convite.papel,
      profissionalId: convite.profissionalId,
    };
    this.publicar([
      aceito
        ? criarEvento('CONVITE_ACEITO', dados, this.opcoesEvento(contexto))
        : criarEvento('CONVITE_RECUSADO', dados, this.opcoesEvento(contexto)),
    ]);
    return convite;
  }
}

export class FinalizarEquipe extends CasoDeEquipe {
  executar(
    projetoId: string,
    equipeId: string,
    contexto: ContextoRequisicao,
  ): Promise<{ projeto: Projeto; equipe: Equipe }> {
    return comNovasTentativas(() => this.tentar(projetoId, equipeId, contexto));
  }

  private async tentar(
    projetoId: string,
    equipeId: string,
    contexto: ContextoRequisicao,
  ): Promise<{ projeto: Projeto; equipe: Equipe }> {
    const projeto = await obterProjeto(this.deps.projetos, projetoId);
    const equipe = projeto.finalizarEquipe(equipeId);
    await this.deps.projetos.salvar(projeto);
    this.publicar([
      criarEvento(
        'EQUIPE_FORMADA',
        {
          projetoId: projeto.id,
          produtorId: projeto.produtorId,
          equipeId: equipe.id,
          custoTotal: equipe.custoTotal,
          membros: equipe.membros.map((membro) => ({
            papel: membro.papel,
            profissionalId: membro.profissional.id,
            custo: membro.custo,
          })),
        },
        this.opcoesEvento(contexto),
      ),
    ]);
    return { projeto, equipe };
  }
}
