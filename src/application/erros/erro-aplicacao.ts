export type CodigoErroAplicacao = 'ESTRATEGIA_DESCONHECIDA' | 'PARAMETROS_INVALIDOS';

export class ErroAplicacao extends Error {
  constructor(
    readonly codigo: CodigoErroAplicacao,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroAplicacao';
  }
}
