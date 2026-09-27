import { describe, expect, it } from 'vitest';
import { resolverParametros } from '../../../../src/application/strategies/parametros-recomendacao.js';
import { Competencia } from '../../../../src/domain/entidades/competencia.js';
import type { Profissional } from '../../../../src/domain/entidades/profissional.js';
import { RequisitoPapel } from '../../../../src/domain/entidades/requisito-papel.js';
import { PAPEIS } from '../../../../src/domain/enums/papel.js';
import { FaixaPreco } from '../../../../src/domain/value-objects/faixa-preco.js';
import { criarRegistroEstrategias } from '../../../../src/container.js';
import { criarAvaliacao, criarProfissional, criarProjeto } from '../../../fixtures/dominio.js';

const TOTAL_PROFISSIONAIS = 10_000;
const LIMITE_MS = 2_000;
const COMPETENCIAS = [
  'direção de atores',
  'decupagem',
  'liderança',
  'roteiro',
  'fotografia',
  'iluminação',
  'montagem',
  'mixagem',
  'captação de som',
  'composição digital',
];

function gerarCadastro(total: number): Profissional[] {
  let semente = 42;
  const aleatorio = () => {
    semente = (semente * 1_103_515_245 + 12_345) % 2_147_483_648;
    return semente / 2_147_483_648;
  };
  const inteiro = (maximo: number) => Math.floor(aleatorio() * maximo);

  return Array.from({ length: total }, (_, indice) => {
    const papel = PAPEIS[indice % PAPEIS.length] ?? 'DIRETOR';
    const minimo = 2_000 + inteiro(40_000);
    return criarProfissional({
      id: `prof-${indice}`,
      especialidades: [papel],
      competencias: Array.from({ length: 4 }, () =>
        Competencia.criar(COMPETENCIAS[inteiro(COMPETENCIAS.length)] ?? 'roteiro', 1 + inteiro(5)),
      ),
      avaliacoes: Array.from({ length: inteiro(8) }, () =>
        criarAvaliacao({ nota: 1 + inteiro(5), papel }),
      ),
      faixaPreco: FaixaPreco.criar(minimo, minimo + inteiro(20_000)),
    });
  });
}

describe('Desempenho das estratégias (RNF01: < 2 s com 10 mil profissionais)', () => {
  const cadastro = gerarCadastro(TOTAL_PROFISSIONAIS);
  const projeto = criarProjeto({
    orcamento: 400_000,
    requisitos: PAPEIS.map((papel, indice) => RequisitoPapel.criar(papel, indice + 1)),
  });
  const parametros = resolverParametros();

  it.each(criarRegistroEstrategias().listar())(
    '$nome ranqueia 6 papéis em menos de 2 s',
    (estrategia) => {
      const inicio = performance.now();
      const ranking = estrategia.recomendar(projeto, cadastro, parametros);
      const duracao = performance.now() - inicio;

      expect(ranking.size).toBe(PAPEIS.length);
      expect(
        [...ranking.values()].every((candidatos) => candidatos.length === parametros.topN),
      ).toBe(true);
      expect(duracao).toBeLessThan(LIMITE_MS);
    },
  );
});
