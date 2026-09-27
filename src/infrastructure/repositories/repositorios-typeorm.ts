import type { DataSource } from 'typeorm';
import type {
  CaixaMensagens,
  EntradaAuditoria,
  Notificacao,
  RegistroAuditoria,
} from '../../application/ports/canais-saida.js';
import type { Logger } from '../../application/ports/logger.js';
import type { RepositorioConvites } from '../../application/ports/repositorio-convites.js';
import type { RepositorioRecomendacoes } from '../../application/ports/repositorio-recomendacoes.js';
import type { Convite } from '../../domain/entidades/convite.js';
import type { Recomendacao } from '../../domain/entidades/recomendacao.js';
import type { Papel } from '../../domain/enums/papel.js';
import { StatusConvite } from '../../domain/enums/status.js';
import { inserir, inserirOuAtualizar } from '../database/escrita.js';
import {
  deConvite,
  deRecomendacao,
  paraConvite,
  paraRecomendacao,
} from '../database/mapeadores.js';
import {
  ConviteSchema,
  RecomendacaoSchema,
  type ConviteRow,
  type RecomendacaoRow,
} from '../database/schemas/projeto.schema.js';
import {
  AuditoriaSchema,
  MensagemInternaSchema,
  type MensagemInternaRow,
} from '../database/schemas/registros.schema.js';

export class RepositorioConvitesTypeorm implements RepositorioConvites {
  constructor(private readonly dataSource: DataSource) {}

  async obter(id: string): Promise<Convite | undefined> {
    const [linha] = await this.dataSource.query<ConviteRow[]>(
      'SELECT * FROM convite WHERE id = $1',
      [id],
    );
    return linha ? paraConvite(linha) : undefined;
  }

  async salvar(convite: Convite): Promise<void> {
    await inserirOuAtualizar(this.dataSource.manager, ConviteSchema, [deConvite(convite)], ['id']);
  }

  async pendenteDoPapel(equipeId: string, papel: Papel): Promise<Convite | undefined> {
    const [linha] = await this.dataSource.query<ConviteRow[]>(
      `SELECT * FROM convite
       WHERE equipe_id = $1 AND papel = $2 AND status = $3
       ORDER BY criado_em DESC LIMIT 1`,
      [equipeId, papel, StatusConvite.PENDENTE],
    );
    return linha ? paraConvite(linha) : undefined;
  }
}

export class RepositorioRecomendacoesTypeorm implements RepositorioRecomendacoes {
  constructor(private readonly dataSource: DataSource) {}

  async salvarTodas(recomendacoes: readonly Recomendacao[]): Promise<void> {
    await inserir(this.dataSource.manager, RecomendacaoSchema, recomendacoes.map(deRecomendacao));
  }

  async listarPorProjeto(projetoId: string): Promise<Recomendacao[]> {
    const linhas = await this.dataSource.query<RecomendacaoRow[]>(
      `SELECT * FROM recomendacao WHERE projeto_id = $1
       ORDER BY rodada, papel, posicao`,
      [projetoId],
    );
    return linhas.map(paraRecomendacao);
  }
}

export class RegistroAuditoriaTypeorm implements RegistroAuditoria {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger?: Logger,
  ) {}

  async registrar(entrada: EntradaAuditoria): Promise<void> {
    this.logger?.info({ auditoria: entrada }, `Auditoria: ${entrada.tipo}`);
    await inserir(this.dataSource.manager, AuditoriaSchema, [
      {
        evento_id: entrada.eventoId,
        tipo: entrada.tipo,
        ocorrido_em: new Date(entrada.ocorridoEm),
        origem: entrada.origem,
        correlacao_id: entrada.correlacaoId ?? null,
        projeto_id: entrada.projetoId,
        ator_id: entrada.atorId,
        tipo_ator: entrada.tipoAtor,
        dados: entrada.dados,
      },
    ]);
  }

  async listarPorProjeto(projetoId: string): Promise<EntradaAuditoria[]> {
    const linhas = await this.dataSource.query<
      {
        evento_id: string;
        tipo: string;
        ocorrido_em: Date;
        origem: string;
        correlacao_id: string | null;
        projeto_id: string;
        ator_id: string;
        tipo_ator: EntradaAuditoria['tipoAtor'];
        dados: object;
      }[]
    >('SELECT * FROM auditoria WHERE projeto_id = $1 ORDER BY ocorrido_em, id', [projetoId]);
    return linhas.map((linha) => ({
      eventoId: linha.evento_id,
      tipo: linha.tipo,
      ocorridoEm: linha.ocorrido_em.toISOString(),
      origem: linha.origem,
      ...(linha.correlacao_id ? { correlacaoId: linha.correlacao_id } : {}),
      projetoId: linha.projeto_id,
      atorId: linha.ator_id,
      tipoAtor: linha.tipo_ator,
      dados: linha.dados,
    }));
  }
}

export class CaixaMensagensTypeorm implements CaixaMensagens {
  constructor(private readonly dataSource: DataSource) {}

  async entregar(notificacao: Notificacao): Promise<void> {
    await inserir(this.dataSource.manager, MensagemInternaSchema, [
      {
        destinatario_id: notificacao.destinatarioId,
        tipo_destinatario: notificacao.tipoDestinatario,
        assunto: notificacao.assunto,
        corpo: notificacao.corpo,
        evento_id: notificacao.eventoId,
      },
    ]);
  }

  async mensagensDe(destinatarioId: string): Promise<Notificacao[]> {
    const linhas = await this.dataSource.query<Required<MensagemInternaRow>[]>(
      `SELECT * FROM mensagem_interna WHERE destinatario_id = $1
       ORDER BY criada_em DESC, id DESC LIMIT 100`,
      [destinatarioId],
    );
    return linhas.map((linha) => ({
      destinatarioId: linha.destinatario_id,
      tipoDestinatario: linha.tipo_destinatario as Notificacao['tipoDestinatario'],
      assunto: linha.assunto,
      corpo: linha.corpo,
      eventoId: linha.evento_id,
    }));
  }
}
