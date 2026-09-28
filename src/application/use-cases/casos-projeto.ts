import { Projeto, type ResultadoReavaliacao } from '../../domain/entidades/projeto.js';
import { RequisitoPapel } from '../../domain/entidades/requisito-papel.js';
import type { Papel } from '../../domain/enums/papel.js';
import type { TipoCaptacao } from '../../domain/enums/tipo-captacao.js';
import { criarEvento } from '../../domain/eventos/evento-recomendacao.js';
import { Localizacao, type DadosLocalizacao } from '../../domain/value-objects/localizacao.js';
import {
  ORIGEM_SERVICO,
  eventoRecomendacaoGerada,
  membrosSugeridos,
} from '../eventos/fabrica-eventos.js';
import { comNovasTentativas } from '../erros/erro-aplicacao.js';
import type { ResultadoOrquestracao } from '../orchestration/orquestrador-equipe.js';
import {
  resolverParametros,
  type ParametrosRecomendacaoParciais,
} from '../strategies/parametros-recomendacao.js';
import {
  obterProjeto,
  type ContextoRequisicao,
  type DependenciasCasosDeUso,
} from './dependencias.js';

export interface OpcoesRodada {
  readonly estrategia?: string;
  readonly parametros?: ParametrosRecomendacaoParciais;
}

export interface ResultadoRodada {
  readonly projeto: Projeto;
  readonly resultado: ResultadoOrquestracao;
}

export class GerarRodadaRecomendacao {
  constructor(private readonly deps: DependenciasCasosDeUso) {}

  async executar(
    projeto: Projeto,
    opcoes: OpcoesRodada,
    contexto: ContextoRequisicao,
  ): Promise<ResultadoRodada> {
    const { estrategias, orquestradorPadrao, projetos, recomendacoes, sujeito } = this.deps;
    const estrategia = estrategias.resolver(projeto, opcoes.estrategia);
    const parametros = opcoes.parametros
      ? resolverParametros(opcoes.parametros)
      : this.deps.parametros;
    projeto.definirEstrategia(estrategia.nome);

    const resultado = await orquestradorPadrao.orquestrar({ projeto, estrategia, parametros });
    if (resultado.equipes.length > 0) {
      projeto.registrarSugestoes(resultado.equipes);
    }
    await projetos.salvar(projeto);
    await recomendacoes.salvarTodas(resultado.recomendacoes);

    sujeito.notificarObservadores(
      eventoRecomendacaoGerada(
        {
          projeto,
          equipes: resultado.equipes,
          membros: membrosSugeridos(resultado.equipes),
          estrategia: estrategia.nome,
          rodada: resultado.rodada,
          parcial: resultado.parcial,
        },
        contexto,
      ),
    );
    return { projeto, resultado };
  }
}

export interface DadosNovoProjeto {
  readonly titulo: string;
  readonly produtorId: string;
  readonly genero: string;
  readonly tipoCaptacao: TipoCaptacao;
  readonly duracaoMinutos: number;
  readonly orcamento: number;
  readonly dataInicio: Date;
  readonly dataEntrega: Date;
  readonly localizacao: DadosLocalizacao;
  readonly requisitos: readonly { papel: Papel; peso: number }[];
  readonly estrategia?: string;
  readonly parametros?: ParametrosRecomendacaoParciais;
}

export class CriarProjetoERecomendar {
  constructor(
    private readonly deps: DependenciasCasosDeUso,
    private readonly gerarRodada: GerarRodadaRecomendacao,
  ) {}

  async executar(dados: DadosNovoProjeto, contexto: ContextoRequisicao): Promise<ResultadoRodada> {
    const { estrategias, parametros, relogio } = this.deps;
    const estrategia = estrategias.obter(
      dados.estrategia ?? estrategias.sugerirPara(dados.orcamento, parametros),
    );
    const projeto = Projeto.criar({
      titulo: dados.titulo,
      produtorId: dados.produtorId,
      genero: dados.genero,
      tipoCaptacao: dados.tipoCaptacao,
      duracaoMinutos: dados.duracaoMinutos,
      orcamento: dados.orcamento,
      dataInicio: dados.dataInicio,
      dataEntrega: dados.dataEntrega,
      localizacao: Localizacao.criar(dados.localizacao),
      requisitos: dados.requisitos.map((requisito) =>
        RequisitoPapel.criar(requisito.papel, requisito.peso),
      ),
      estrategia: estrategia.nome,
      criadoEm: relogio(),
    });
    return this.gerarRodada.executar(
      projeto,
      dados.parametros ? { parametros: dados.parametros } : {},
      contexto,
    );
  }
}

export class RecomendarNovamente {
  constructor(
    private readonly deps: DependenciasCasosDeUso,
    private readonly gerarRodada: GerarRodadaRecomendacao,
  ) {}

  executar(
    projetoId: string,
    opcoes: OpcoesRodada,
    contexto: ContextoRequisicao,
  ): Promise<ResultadoRodada> {
    return comNovasTentativas(async () => {
      const projeto = await obterProjeto(this.deps.projetos, projetoId);
      return this.gerarRodada.executar(projeto, opcoes, contexto);
    });
  }
}

export interface DadosReavaliacao {
  readonly orcamento?: number;
  readonly dataEntrega?: Date;
  readonly limiar?: number;
}

export interface ResultadoReavaliacaoProjeto {
  readonly projeto: Projeto;
  readonly reavaliacao: ResultadoReavaliacao;
  readonly rodada?: ResultadoRodada;
}

export class ReavaliarProjeto {
  constructor(
    private readonly deps: DependenciasCasosDeUso,
    private readonly gerarRodada: GerarRodadaRecomendacao,
  ) {}

  executar(
    projetoId: string,
    dados: DadosReavaliacao,
    contexto: ContextoRequisicao,
  ): Promise<ResultadoReavaliacaoProjeto> {
    return comNovasTentativas(() => this.tentar(projetoId, dados, contexto));
  }

  private async tentar(
    projetoId: string,
    dados: DadosReavaliacao,
    contexto: ContextoRequisicao,
  ): Promise<ResultadoReavaliacaoProjeto> {
    const projeto = await obterProjeto(this.deps.projetos, projetoId);
    const reavaliacao = projeto.solicitarReavaliacao(
      {
        ...(dados.orcamento === undefined ? {} : { orcamento: dados.orcamento }),
        ...(dados.dataEntrega === undefined ? {} : { dataEntrega: dados.dataEntrega }),
      },
      dados.limiar,
    );
    const rodada = reavaliacao.significativa
      ? await this.gerarRodada.executar(projeto, {}, contexto)
      : undefined;
    if (!rodada) {
      await this.deps.projetos.salvar(projeto);
    }
    this.deps.sujeito.notificarObservadores(
      criarEvento(
        'REAVALIACAO_SOLICITADA',
        { projetoId: projeto.id, produtorId: projeto.produtorId, ...reavaliacao },
        { origem: ORIGEM_SERVICO, ...contexto },
      ),
    );
    return rodada ? { projeto, reavaliacao, rodada } : { projeto, reavaliacao };
  }
}
