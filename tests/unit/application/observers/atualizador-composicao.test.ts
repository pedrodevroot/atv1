import { beforeEach, describe, expect, it } from 'vitest';
import { OrquestradorPadrao } from '../../../../src/application/orchestration/orquestrador-padrao.js';
import { OrquestradorSubstituicao } from '../../../../src/application/orchestration/orquestrador-substituicao.js';
import { AtualizadorComposicao } from '../../../../src/application/observers/atualizador-composicao.js';
import type { Equipe } from '../../../../src/domain/entidades/equipe.js';
import type { Projeto } from '../../../../src/domain/entidades/projeto.js';
import { Papel } from '../../../../src/domain/enums/papel.js';
import { StatusMembro } from '../../../../src/domain/enums/status.js';
import type { EventoRecomendacao } from '../../../../src/domain/eventos/evento-recomendacao.js';
import { RepositorioProjetosMemoria } from '../../../../src/infrastructure/repositories/repositorio-projetos-memoria.js';
import {
  IDS_DEMONSTRACAO,
  criarProjetoDemonstracao,
} from '../../../fixtures/cadastro-demonstracao.js';
import { eventoRespostaConvite } from '../../../fixtures/eventos.js';
import {
  ID_EDITOR_ECONOMICO,
  criarAmbienteOrquestracao,
  relogioFixo,
} from '../../../fixtures/orquestracao.js';

describe('AtualizadorComposicao (RF10)', () => {
  const ambiente = criarAmbienteOrquestracao();
  let projetos: RepositorioProjetosMemoria;
  let publicados: EventoRecomendacao[];
  let atualizador: AtualizadorComposicao;
  let projeto: Projeto;
  let equipe: Equipe;

  const resposta = (tipo: 'CONVITE_ACEITO' | 'CONVITE_RECUSADO', projetoId = projeto.id) =>
    eventoRespostaConvite(tipo, {
      projetoId,
      equipeId: equipe.id,
      papel: Papel.EDITOR,
      profissionalId: IDS_DEMONSTRACAO.EDITOR,
    });

  beforeEach(async () => {
    projetos = new RepositorioProjetosMemoria();
    publicados = [];
    atualizador = new AtualizadorComposicao({
      projetos,
      substituicao: new OrquestradorSubstituicao(ambiente.repositorio, relogioFixo),
      estrategias: ambiente.registro,
      parametros: ambiente.parametros,
      sujeito: {
        adicionarObservador: () => undefined,
        removerObservador: () => undefined,
        notificarObservadores: (evento) => publicados.push(evento),
      },
    });
    projeto = criarProjetoDemonstracao();
    const resultado = await new OrquestradorPadrao(ambiente.repositorio, relogioFixo).orquestrar({
      projeto,
      estrategia: ambiente.cosseno,
      parametros: ambiente.parametros,
    });
    projeto.registrarSugestoes(resultado.equipes);
    const [primeira] = resultado.equipes;
    if (!primeira) {
      throw new Error('Nenhuma equipe sugerida');
    }
    equipe = primeira;
    projeto.aceitarRecomendacao(equipe.id, Papel.EDITOR);
    await projetos.salvar(projeto);
  });

  it('convite aceito confirma o membro sem disparar nova rodada', async () => {
    await atualizador.atualizar(resposta('CONVITE_ACEITO'));

    expect(equipe.membro(Papel.EDITOR)?.status).toBe(StatusMembro.CONFIRMADO);
    expect(publicados).toEqual([]);
  });

  it('convite recusado dispara nova rodada só para o papel e notifica o novo recomendado', async () => {
    const diretorAntes = equipe.membro(Papel.DIRETOR);

    await atualizador.atualizar(resposta('CONVITE_RECUSADO'));

    expect(equipe.membro(Papel.EDITOR)?.profissional.id).toBe(ID_EDITOR_ECONOMICO);
    expect(equipe.membro(Papel.DIRETOR)).toBe(diretorAntes);
    expect(publicados.map((evento) => evento.tipo)).toEqual([
      'SUBSTITUICAO_SOLICITADA',
      'RECOMENDACAO_GERADA',
    ]);
    expect(publicados[0]).toMatchObject({
      origem: 'atualizador-composicao',
      correlacaoId: 'req-1',
      dados: { profissionalAnteriorId: IDS_DEMONSTRACAO.EDITOR },
    });
    expect(publicados[1]).toMatchObject({
      dados: { profissionais: [{ profissionalId: ID_EDITOR_ECONOMICO, papel: Papel.EDITOR }] },
    });
  });

  it('sem substituto disponível publica só a solicitação de substituição', async () => {
    projeto.solicitarReavaliacao({ orcamento: 58_000 });

    await atualizador.atualizar(resposta('CONVITE_RECUSADO'));

    expect(equipe.membro(Papel.EDITOR)?.status).toBe(StatusMembro.RECUSADO);
    expect(publicados.map((evento) => evento.tipo)).toEqual(['SUBSTITUICAO_SOLICITADA']);
  });

  it('ignora eventos fora do seu interesse e falha para projeto inexistente', async () => {
    await expect(
      atualizador.atualizar(resposta('CONVITE_ACEITO', 'projeto-fantasma')),
    ).rejects.toThrow('Projeto projeto-fantasma não encontrado');

    const outro = {
      ...resposta('CONVITE_ACEITO'),
      tipo: 'EQUIPE_FORMADA',
    } as unknown as EventoRecomendacao;
    await expect(atualizador.atualizar(outro)).resolves.toBeUndefined();
  });
});
