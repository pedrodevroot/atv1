export type CodigoErroAplicacao =
  | 'ESTRATEGIA_DESCONHECIDA'
  | 'PARAMETROS_INVALIDOS'
  | 'RESTRICAO_VIOLADA'
  | 'FLUXO_INVARIAVEL'
  | 'NAO_ENCONTRADO';

export class ErroAplicacao extends Error {
  constructor(
    readonly codigo: CodigoErroAplicacao,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroAplicacao';
  }
}

export function naoEncontrado(recurso: string, id: string): ErroAplicacao {
  return new ErroAplicacao('NAO_ENCONTRADO', `${recurso} ${id} não encontrado.`);
}
