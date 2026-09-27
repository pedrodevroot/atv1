import { Papel } from '../../domain/enums/papel.js';
import { TipoCaptacao } from '../../domain/enums/tipo-captacao.js';
import { VetorCompetencia } from '../../domain/value-objects/vetor-competencia.js';

type PesosCompetencia = Readonly<Record<string, number>>;

export interface DefinicaoPerfis {
  base: Readonly<Record<Papel, PesosCompetencia>>;
  ajustesPorTipo: Readonly<Partial<Record<TipoCaptacao, Partial<Record<Papel, PesosCompetencia>>>>>;
}

export const PERFIS_IDEAIS: DefinicaoPerfis = {
  base: {
    [Papel.DIRETOR]: { 'direcao-de-atores': 1, decupagem: 0.8, lideranca: 0.9, roteiro: 0.4 },
    [Papel.DIRETOR_FOTOGRAFIA]: {
      fotografia: 1,
      iluminacao: 0.9,
      'operacao-de-camera': 0.8,
      'color-grading': 0.5,
    },
    [Papel.SONOPLASTA]: {
      'captacao-de-som': 1,
      mixagem: 0.9,
      'desenho-de-som': 0.8,
      'trilha-sonora': 0.4,
    },
    [Papel.EDITOR]: {
      montagem: 1,
      'edicao-nao-linear': 0.9,
      'ritmo-narrativo': 0.7,
      'color-grading': 0.5,
    },
    [Papel.ROTEIRISTA]: { roteiro: 1, dramaturgia: 0.9, dialogos: 0.8, pesquisa: 0.5 },
    [Papel.EFEITOS_VISUAIS]: {
      'composicao-digital': 1,
      rastreamento: 0.7,
      'modelagem-3d': 0.8,
      animacao: 0.5,
    },
  },
  ajustesPorTipo: {
    [TipoCaptacao.DOCUMENTARIO]: {
      [Papel.DIRETOR]: { entrevista: 0.9, pesquisa: 0.7, 'direcao-de-atores': -0.6 },
      [Papel.ROTEIRISTA]: { pesquisa: 0.5, dialogos: -0.4 },
      [Papel.SONOPLASTA]: { 'captacao-de-som': 0.2 },
    },
    [TipoCaptacao.ANIMACAO]: {
      [Papel.DIRETOR]: { animacao: 0.9, 'direcao-de-atores': -0.6 },
      [Papel.EFEITOS_VISUAIS]: { animacao: 0.5, 'modelagem-3d': 0.2 },
      [Papel.SONOPLASTA]: { 'desenho-de-som': 0.2, 'captacao-de-som': -0.5 },
      [Papel.DIRETOR_FOTOGRAFIA]: { 'operacao-de-camera': -0.6, 'color-grading': 0.3 },
    },
    [TipoCaptacao.FICCAO]: {
      [Papel.DIRETOR]: { 'direcao-de-atores': 0.2 },
      [Papel.ROTEIRISTA]: { dramaturgia: 0.1 },
    },
  },
};

export class CatalogoPerfis {
  private readonly cache = new Map<string, VetorCompetencia>();

  constructor(private readonly definicao: DefinicaoPerfis = PERFIS_IDEAIS) {}

  perfilPara(papel: Papel, tipoCaptacao: TipoCaptacao): VetorCompetencia {
    const chave = `${papel}:${tipoCaptacao}`;
    const existente = this.cache.get(chave);
    if (existente) {
      return existente;
    }
    const pesos: Record<string, number> = { ...this.definicao.base[papel] };
    for (const [competencia, ajuste] of Object.entries(
      this.definicao.ajustesPorTipo[tipoCaptacao]?.[papel] ?? {},
    )) {
      pesos[competencia] = Math.max(0, (pesos[competencia] ?? 0) + ajuste);
    }
    const perfil = VetorCompetencia.de(pesos);
    this.cache.set(chave, perfil);
    return perfil;
  }
}
