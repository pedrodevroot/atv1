export type CodigoErroAplicacao =
  'ESTRATEGIA_DESCONHECIDA' | 'PARAMETROS_INVALIDOS' | 'RESTRICAO_VIOLADA' | 'FLUXO_INVARIAVEL';

export class ErroAplicacao extends Error {
  constructor(
    readonly codigo: CodigoErroAplicacao,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroAplicacao';
  }
}
