import { describe, expect, it } from 'vitest';
import { CatalogoPerfis } from '../../../../src/application/strategies/catalogo-perfis.js';
import { FiltragemColaborativa } from '../../../../src/application/strategies/filtragem-colaborativa.js';
import type { FiltroCandidato } from '../../../../src/application/strategies/filtros-candidato.js';
import { resolverParametros } from '../../../../src/application/strategies/parametros-recomendacao.js';
import { RegrasOrcamento } from '../../../../src/application/strategies/regras-orcamento.js';
import { SimilaridadeCosseno } from '../../../../src/application/strategies/similaridade-cosseno.js';
import { Competencia } from '../../../../src/domain/entidades/competencia.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { TipoCaptacao } from '../../../../src/domain/enums/tipo-captacao.js';
import { FaixaPreco } from '../../../../src/domain/value-objects/faixa-preco.js';
import {
  BELO_HORIZONTE,
  IDS_DEMONSTRACAO,
  criarCadastroDemonstracao,
  criarProjetoDemonstracao,
} from '../../../fixtures/cadastro-demonstracao.js';
import {
  RIO_DE_JANEIRO,
  SAO_PAULO,
  criarAvaliacao,
  criarProfissional,
  criarProjeto,
} from '../../../fixtures/dominio.js';

const padrao = resolverParametros();

function primeiroDiretor(ranking: ReturnType<SimilaridadeCosseno['recomendar']>) {
  const [primeiro] = ranking.get(Papel.DIRETOR) ?? [];
  if (!primeiro) {
    throw new Error('Nenhum diretor recomendado');
  }
  return primeiro;
}

describe('SimilaridadeCosseno', () => {
  it('usa o perfil ideal do tipo de captação', () => {
    const entrevistador = criarProfissional({
      id: 'entrevistador',
      competencias: [Competencia.criar('Entrevista', 5), Competencia.criar('Pesquisa', 5)],
    });
    const diretorDeAtores = criarProfissional({
      id: 'diretor-de-atores',
      competencias: [Competencia.criar('Direção de atores', 5)],
    });
    const cadastro = [entrevistador, diretorDeAtores];
    const estrategia = new SimilaridadeCosseno();

    const documentario = criarProjeto({ tipoCaptacao: TipoCaptacao.DOCUMENTARIO });
    const ficcao = criarProjeto({ tipoCaptacao: TipoCaptacao.FICCAO });

    expect(
      primeiroDiretor(estrategia.recomendar(documentario, cadastro, padrao)).profissional.id,
    ).toBe('entrevistador');
    expect(primeiroDiretor(estrategia.recomendar(ficcao, cadastro, padrao)).profissional.id).toBe(
      'diretor-de-atores',
    );
  });

  it('peso de experiência parametrizável altera o resultado', () => {
    const projeto = criarProjetoDemonstracao();
    const cadastro = criarCadastroDemonstracao();
    const estrategia = new SimilaridadeCosseno();
    const soExperiencia = resolverParametros({
      cosseno: { pesoSimilaridade: 0, pesoAderencia: 0, pesoExperiencia: 1 },
    });

    const local = (parametros: typeof padrao) =>
      (estrategia.recomendar(projeto, cadastro, parametros).get(Papel.DIRETOR) ?? []).find(
        (candidato) => candidato.profissional.id === IDS_DEMONSTRACAO.DIRETOR_LOCAL,
      )?.score;

    expect(local(soExperiencia)).toBe(0.2);
    expect(local(padrao)).toBeCloseTo(0.5, 1);
  });

  it('aceita catálogo e filtros injetados', () => {
    const catalogo = new CatalogoPerfis({
      base: {
        DIRETOR: { fotografia: 1 },
        DIRETOR_FOTOGRAFIA: {},
        SONOPLASTA: {},
        EDITOR: {},
        ROTEIRISTA: {},
        EFEITOS_VISUAIS: {},
      },
      ajustesPorTipo: {},
    });
    const aceitaTudoDoPapel: FiltroCandidato = {
      nome: 'papel',
      aceita: (profissional, contexto) => profissional.atuaComo(contexto.papel),
    };
    const estrategia = new SimilaridadeCosseno(catalogo, [aceitaTudoDoPapel]);

    const primeiro = primeiroDiretor(
      estrategia.recomendar(criarProjetoDemonstracao(), criarCadastroDemonstracao(), padrao),
    );

    expect(primeiro.profissional.id).toBe(IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA);
  });
});

describe('FiltragemColaborativa', () => {
  const estrategia = new FiltragemColaborativa();

  it('encolhe para a média a priori quem tem poucas avaliações', () => {
    const umaNotaCinco = criarProfissional({
      id: 'uma-nota',
      avaliacoes: [criarAvaliacao({ nota: 5 })],
    });
    const muitasNotasQuatro = criarProfissional({
      id: 'muitas-notas',
      avaliacoes: Array.from({ length: 20 }, () => criarAvaliacao({ nota: 4 })),
    });

    const ranking = estrategia.recomendar(
      criarProjeto(),
      [umaNotaCinco, muitasNotasQuatro],
      padrao,
    );

    expect(primeiroDiretor(ranking).profissional.id).toBe('muitas-notas');
  });

  it('valoriza avaliações de projetos parecidos com o atual', () => {
    const avaliacao = (genero: string, tipoCaptacao: TipoCaptacao) =>
      criarAvaliacao({ nota: 5, genero, tipoCaptacao, produtorId: 'outro' });
    const especialistaEmDrama = criarProfissional({
      id: 'drama',
      avaliacoes: [
        avaliacao('drama', TipoCaptacao.FICCAO),
        avaliacao('drama', TipoCaptacao.FICCAO),
      ],
    });
    const especialistaEmComedia = criarProfissional({
      id: 'comedia',
      avaliacoes: [
        avaliacao('comédia', TipoCaptacao.ANIMACAO),
        avaliacao('comédia', TipoCaptacao.ANIMACAO),
      ],
    });

    const ranking = estrategia.recomendar(
      criarProjeto({ genero: 'drama' }),
      [especialistaEmComedia, especialistaEmDrama],
      padrao,
    );

    expect(primeiroDiretor(ranking).profissional.id).toBe('drama');
    expect(primeiroDiretor(ranking).justificativa).toContain('2 em projetos similares');
  });

  it('usa a média a priori para quem não tem avaliações', () => {
    const ranking = estrategia.recomendar(criarProjeto(), [criarProfissional()], padrao);

    expect(primeiroDiretor(ranking).score).toBe(0.5);
  });
});

describe('RegrasOrcamento', () => {
  const estrategia = new RegrasOrcamento();

  it('aplica teto estrito proporcional ao peso do papel', () => {
    const projeto = criarProjeto({ orcamento: 40_000 });
    const acimaDoTeto = criarProfissional({
      id: 'acima',
      faixaPreco: FaixaPreco.criar(26_000, 30_000),
    });
    const dentroDoTeto = criarProfissional({
      id: 'dentro',
      faixaPreco: FaixaPreco.criar(20_000, 24_000),
    });

    const ids = (
      estrategia.recomendar(projeto, [acimaDoTeto, dentroDoTeto], padrao).get(Papel.DIRETOR) ?? []
    ).map((candidato) => candidato.profissional.id);

    expect(ids).toEqual(['dentro']);
  });

  it('prefere profissional mais próximo quando custo e nota empatam', () => {
    const local = criarProfissional({ id: 'local', localizacao: SAO_PAULO });
    const vizinho = criarProfissional({ id: 'vizinho', localizacao: RIO_DE_JANEIRO });
    const distante = criarProfissional({ id: 'distante', localizacao: BELO_HORIZONTE });
    const raioAmplo = resolverParametros({ orcamento: { raioKm: 600 } });

    const ranking = estrategia.recomendar(criarProjeto(), [distante, vizinho, local], raioAmplo);

    expect(
      (ranking.get(Papel.DIRETOR) ?? []).map((candidato) => candidato.profissional.id),
    ).toEqual(['local', 'vizinho', 'distante']);
  });

  it('proximidade é binária quando o raio é zero', () => {
    const parametros = resolverParametros({
      orcamento: { raioKm: 0, pesoEconomia: 0, pesoNota: 0, pesoProximidade: 1 },
    });
    const ranking = estrategia.recomendar(
      criarProjeto(),
      [criarProfissional({ id: 'rio', localizacao: RIO_DE_JANEIRO })],
      parametros,
    );

    expect(primeiroDiretor(ranking).score).toBe(0);
  });

  it('usa nota das avaliações e custo negociado na justificativa', () => {
    const avaliado = criarProfissional({ avaliacoes: [criarAvaliacao({ nota: 5 })] });

    const primeiro = primeiroDiretor(estrategia.recomendar(criarProjeto(), [avaliado], padrao));

    expect(primeiro.justificativa).toMatch(
      /^custo 15000\.00 de teto 62500\.00; nota 1\.00; proximidade 1\.00$/,
    );
    expect(primeiro.custoEstimado).toBe(15_000);
  });
});
