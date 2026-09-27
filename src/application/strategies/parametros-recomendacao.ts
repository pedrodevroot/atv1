import { ErroAplicacao } from '../erros/erro-aplicacao.js';

export interface ParametrosCosseno {
  pesoSimilaridade: number;
  pesoExperiencia: number;
  experienciaSaturacao: number;
}

export interface ParametrosColaborativa {
  mediaPriori: number;
  pesoPriori: number;
  bonusMesmoGenero: number;
  bonusMesmoTipo: number;
  bonusMesmoPapel: number;
  bonusMesmoProdutor: number;
}

export interface ParametrosOrcamento {
  folgaTeto: number;
  pesoEconomia: number;
  pesoNota: number;
  pesoProximidade: number;
  raioKm: number;
  limiteOrcamentoReduzido: number;
}

export interface ParametrosOrquestracao {
  numeroSugestoes: number;
  scoreMinimo: number;
  custoMinimoPorPapel: number;
}

export interface ParametrosRecomendacao {
  topN: number;
  folgaTetoPapel: number;
  cosseno: ParametrosCosseno;
  colaborativa: ParametrosColaborativa;
  orcamento: ParametrosOrcamento;
  orquestracao: ParametrosOrquestracao;
}

export interface ParametrosRecomendacaoParciais {
  topN?: number;
  folgaTetoPapel?: number;
  cosseno?: Partial<ParametrosCosseno>;
  colaborativa?: Partial<ParametrosColaborativa>;
  orcamento?: Partial<ParametrosOrcamento>;
  orquestracao?: Partial<ParametrosOrquestracao>;
}

export const PARAMETROS_PADRAO: Readonly<ParametrosRecomendacao> = Object.freeze({
  topN: 5,
  folgaTetoPapel: 0.5,
  cosseno: { pesoSimilaridade: 0.8, pesoExperiencia: 0.2, experienciaSaturacao: 5 },
  colaborativa: {
    mediaPriori: 3,
    pesoPriori: 5,
    bonusMesmoGenero: 1,
    bonusMesmoTipo: 1,
    bonusMesmoPapel: 1,
    bonusMesmoProdutor: 0.5,
  },
  orcamento: {
    folgaTeto: 0,
    pesoEconomia: 0.5,
    pesoNota: 0.3,
    pesoProximidade: 0.2,
    raioKm: 300,
    limiteOrcamentoReduzido: 50_000,
  },
  orquestracao: {
    numeroSugestoes: 3,
    scoreMinimo: 0.05,
    custoMinimoPorPapel: 1_000,
  },
});

export function resolverParametros(
  parciais: ParametrosRecomendacaoParciais = {},
): ParametrosRecomendacao {
  const parametros: ParametrosRecomendacao = {
    topN: parciais.topN ?? PARAMETROS_PADRAO.topN,
    folgaTetoPapel: parciais.folgaTetoPapel ?? PARAMETROS_PADRAO.folgaTetoPapel,
    cosseno: { ...PARAMETROS_PADRAO.cosseno, ...parciais.cosseno },
    colaborativa: { ...PARAMETROS_PADRAO.colaborativa, ...parciais.colaborativa },
    orcamento: { ...PARAMETROS_PADRAO.orcamento, ...parciais.orcamento },
    orquestracao: { ...PARAMETROS_PADRAO.orquestracao, ...parciais.orquestracao },
  };
  validarParametros(parametros);
  return parametros;
}

function validarParametros(parametros: ParametrosRecomendacao): void {
  const problemas: string[] = [];
  const inteirosEntre: [string, number, number, number][] = [
    ['topN', parametros.topN, 1, 100],
    ['orquestracao.numeroSugestoes', parametros.orquestracao.numeroSugestoes, 1, 10],
  ];
  for (const [nome, valor, minimo, maximo] of inteirosEntre) {
    if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
      problemas.push(`${nome} deve ser inteiro entre ${minimo} e ${maximo}`);
    }
  }
  if (parametros.orquestracao.scoreMinimo > 1) {
    problemas.push('orquestracao.scoreMinimo deve ser <= 1');
  }
  const numeros: [string, number][] = [
    ['folgaTetoPapel', parametros.folgaTetoPapel],
    ...prefixar('cosseno', parametros.cosseno),
    ...prefixar('colaborativa', parametros.colaborativa),
    ...prefixar('orcamento', parametros.orcamento),
    ...prefixar('orquestracao', parametros.orquestracao),
  ];
  for (const [nome, valor] of numeros) {
    if (!Number.isFinite(valor) || valor < 0) {
      problemas.push(`${nome} deve ser um número >= 0`);
    }
  }
  const somasDePesos: [string, number][] = [
    ['cosseno', parametros.cosseno.pesoSimilaridade + parametros.cosseno.pesoExperiencia],
    [
      'orcamento',
      parametros.orcamento.pesoEconomia +
        parametros.orcamento.pesoNota +
        parametros.orcamento.pesoProximidade,
    ],
  ];
  for (const [grupo, soma] of somasDePesos) {
    if (soma <= 0) {
      problemas.push(`os pesos de ${grupo} não podem ser todos zero`);
    }
  }
  if (problemas.length > 0) {
    throw new ErroAplicacao(
      'PARAMETROS_INVALIDOS',
      `Parâmetros inválidos: ${problemas.join('; ')}.`,
    );
  }
}

function prefixar(grupo: string, valores: object): [string, number][] {
  return Object.entries(valores).map(([chave, valor]) => [`${grupo}.${chave}`, Number(valor)]);
}
