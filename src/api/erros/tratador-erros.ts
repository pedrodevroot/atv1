import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { RespostaErro } from '../schemas/comum.schema.js';

export function tratarErro(erro: FastifyError, requisicao: FastifyRequest, resposta: FastifyReply) {
  if (erro.validation) {
    const corpo: RespostaErro = {
      codigo: 'REQUISICAO_INVALIDA',
      mensagem: 'A requisição não atende ao contrato esperado.',
      detalhes: erro.validation.map(
        (falha) =>
          `${falha.instancePath || erro.validationContext || 'corpo'}: ${falha.message ?? ''}`,
      ),
    };
    return resposta.status(400).send(corpo);
  }

  const status = erro.statusCode ?? 500;
  if (status >= 500) {
    requisicao.log.error({ err: erro }, 'Erro não tratado');
    const corpo: RespostaErro = { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor.' };
    return resposta.status(500).send(corpo);
  }

  const corpo: RespostaErro = { codigo: erro.code, mensagem: erro.message };
  return resposta.status(status).send(corpo);
}
