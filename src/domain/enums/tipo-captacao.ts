export const TipoCaptacao = {
  DOCUMENTARIO: 'DOCUMENTARIO',
  FICCAO: 'FICCAO',
  ANIMACAO: 'ANIMACAO',
} as const;

export type TipoCaptacao = (typeof TipoCaptacao)[keyof typeof TipoCaptacao];

export const TIPOS_CAPTACAO: readonly TipoCaptacao[] = Object.values(TipoCaptacao);
