import type { Projeto } from '../../domain/entidades/projeto.js';
import { ErroAplicacao } from '../erros/erro-aplicacao.js';
import { NomeEstrategia, type EstrategiaRecomendacao } from './estrategia-recomendacao.js';
import type { ParametrosRecomendacao } from './parametros-recomendacao.js';

export class RegistroEstrategias {
  private readonly estrategias = new Map<string, EstrategiaRecomendacao>();

  constructor(estrategias: readonly EstrategiaRecomendacao[]) {
    for (const estrategia of estrategias) {
      if (this.estrategias.has(estrategia.nome)) {
        throw new ErroAplicacao(
          'PARAMETROS_INVALIDOS',
          `Estratégia "${estrategia.nome}" registrada mais de uma vez.`,
        );
      }
      this.estrategias.set(estrategia.nome, estrategia);
    }
  }

  get nomes(): string[] {
    return [...this.estrategias.keys()];
  }

  listar(): EstrategiaRecomendacao[] {
    return [...this.estrategias.values()];
  }

  existe(nome: string): boolean {
    return this.estrategias.has(nome);
  }

  obter(nome: string): EstrategiaRecomendacao {
    const estrategia = this.estrategias.get(nome);
    if (!estrategia) {
      throw new ErroAplicacao(
        'ESTRATEGIA_DESCONHECIDA',
        `Estratégia "${nome}" não existe. Disponíveis: ${this.nomes.join(', ')}.`,
      );
    }
    return estrategia;
  }

  resolver(projeto: Projeto, solicitadaPeloProdutor?: string): EstrategiaRecomendacao {
    return this.obter(solicitadaPeloProdutor ?? projeto.estrategia);
  }

  sugerirPara(orcamento: number, parametros: ParametrosRecomendacao): string {
    return orcamento <= parametros.orcamento.limiteOrcamentoReduzido
      ? NomeEstrategia.REGRAS_ORCAMENTO
      : NomeEstrategia.SIMILARIDADE_COSSENO;
  }
}
