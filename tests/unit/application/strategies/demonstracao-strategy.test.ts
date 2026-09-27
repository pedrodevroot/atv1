import { describe, expect, it } from 'vitest';
import { resolverParametros } from '../../../../src/application/strategies/parametros-recomendacao.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { criarRegistroEstrategias } from '../../../../src/container.js';
import {
  IDS_DEMONSTRACAO,
  criarCadastroDemonstracao,
  criarProjetoDemonstracao,
} from '../../../fixtures/cadastro-demonstracao.js';

const parametros = resolverParametros();
const registro = criarRegistroEstrategias();

function rankingDeDiretores(nomeEstrategia: string): string[] {
  const projeto = criarProjetoDemonstracao();
  const estrategia = registro.resolver(projeto, nomeEstrategia);
  const ranking = estrategia.recomendar(projeto, criarCadastroDemonstracao(), parametros);
  return (ranking.get(Papel.DIRETOR) ?? []).map((candidato) => candidato.profissional.id);
}

describe('Demonstração do Strategy: mesmo projeto e mesmo cadastro, rankings diferentes', () => {
  it('similaridade de cosseno escolhe quem tem as competências do perfil ideal', () => {
    expect(rankingDeDiretores('similaridade-cosseno')).toEqual([
      IDS_DEMONSTRACAO.DIRETORA_TECNICA,
      IDS_DEMONSTRACAO.DIRETOR_LOCAL,
      IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
    ]);
  });

  it('filtragem colaborativa escolhe quem é melhor avaliado em projetos parecidos', () => {
    expect(rankingDeDiretores('filtragem-colaborativa')).toEqual([
      IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
      IDS_DEMONSTRACAO.DIRETOR_LOCAL,
      IDS_DEMONSTRACAO.DIRETORA_TECNICA,
    ]);
  });

  it('regras de orçamento escolhem o melhor custo-benefício local', () => {
    expect(rankingDeDiretores('regras-orcamento')).toEqual([
      IDS_DEMONSTRACAO.DIRETOR_LOCAL,
      IDS_DEMONSTRACAO.DIRETORA_CONSAGRADA,
      IDS_DEMONSTRACAO.DIRETORA_TECNICA,
    ]);
  });

  it('cada estratégia coloca um profissional diferente em primeiro lugar', () => {
    const primeiros = registro.nomes.map((nome) => rankingDeDiretores(nome)[0]);

    expect(new Set(primeiros).size).toBe(3);
  });

  it('a estratégia definida na criação do projeto é usada quando o produtor não escolhe outra', () => {
    const projeto = criarProjetoDemonstracao('filtragem-colaborativa');

    expect(registro.resolver(projeto).nome).toBe('filtragem-colaborativa');
    expect(registro.resolver(projeto, 'regras-orcamento').nome).toBe('regras-orcamento');
  });
});
