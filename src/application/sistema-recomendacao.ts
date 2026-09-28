import type { Projeto } from '../domain/entidades/projeto.js';
import type { EventoRecomendacao } from '../domain/eventos/evento-recomendacao.js';
import { eventoRecomendacaoGerada, membrosSugeridos } from './eventos/fabrica-eventos.js';
import type { ResultadoOrquestracao } from './orchestration/orquestrador-equipe.js';
import type { OrquestradorPadrao } from './orchestration/orquestrador-padrao.js';
import type { Observador, Sujeito } from './ports/observador.js';
import type { EstrategiaRecomendacao } from './strategies/estrategia-recomendacao.js';
import type { ParametrosRecomendacao } from './strategies/parametros-recomendacao.js';
import type { RegistroEstrategias } from './strategies/registro-estrategias.js';

export type RecomendacaoStrategy = EstrategiaRecomendacao;

export interface DependenciasSistemaRecomendacao {
  readonly orquestrador: OrquestradorPadrao;
  readonly estrategias: RegistroEstrategias;
  readonly sujeito: Sujeito;
  readonly parametros: ParametrosRecomendacao;
}

export class SistemaRecomendacao {
  private estrategiaAtual: RecomendacaoStrategy;

  constructor(
    private readonly dependencias: DependenciasSistemaRecomendacao,
    estrategiaInicial: RecomendacaoStrategy | string = 'similaridade-cosseno',
  ) {
    this.estrategiaAtual = this.resolver(estrategiaInicial);
  }

  get estrategia(): RecomendacaoStrategy {
    return this.estrategiaAtual;
  }

  definirEstrategia(estrategia: RecomendacaoStrategy | string): void {
    this.estrategiaAtual = this.resolver(estrategia);
  }

  async executarRecomendacao(projeto: Projeto): Promise<ResultadoOrquestracao> {
    const resultado = await this.dependencias.orquestrador.orquestrar({
      projeto,
      estrategia: this.estrategiaAtual,
      parametros: this.dependencias.parametros,
    });
    this.notificarObservadores(
      eventoRecomendacaoGerada({
        projeto,
        equipes: resultado.equipes,
        membros: membrosSugeridos(resultado.equipes),
        estrategia: this.estrategiaAtual.nome,
        rodada: resultado.rodada,
        parcial: resultado.parcial,
      }),
    );
    return resultado;
  }

  adicionarObservador(observador: Observador): void {
    this.dependencias.sujeito.adicionarObservador(observador);
  }

  removerObservador(observador: Observador): void {
    this.dependencias.sujeito.removerObservador(observador);
  }

  notificarObservadores(evento: EventoRecomendacao): void {
    this.dependencias.sujeito.notificarObservadores(evento);
  }

  private resolver(estrategia: RecomendacaoStrategy | string): RecomendacaoStrategy {
    return typeof estrategia === 'string'
      ? this.dependencias.estrategias.obter(estrategia)
      : estrategia;
  }
}
