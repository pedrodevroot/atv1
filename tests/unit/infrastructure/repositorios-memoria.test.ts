import { describe, expect, it } from 'vitest';
import { Convite } from '../../../src/domain/entidades/convite.js';
import { Recomendacao } from '../../../src/domain/entidades/recomendacao.js';
import { Papel } from '../../../src/domain/enums/papel.js';
import {
  RepositorioConvitesMemoria,
  RepositorioRecomendacoesMemoria,
} from '../../../src/infrastructure/repositories/repositorios-memoria.js';

function convite(papel: Papel) {
  return Convite.criar({
    projetoId: 'p',
    equipeId: 'e',
    papel,
    profissionalId: 'prof',
    produtorId: 'prod',
  });
}

describe('RepositorioConvitesMemoria', () => {
  it('salva, obtém e encontra o convite pendente do papel', async () => {
    const repositorio = new RepositorioConvitesMemoria();
    const doEditor = convite(Papel.EDITOR);
    await repositorio.salvar(doEditor);
    await repositorio.salvar(convite(Papel.DIRETOR));

    expect(await repositorio.obter(doEditor.id)).toBe(doEditor);
    expect(await repositorio.pendenteDoPapel('e', Papel.EDITOR)).toBe(doEditor);

    doEditor.recusar();
    expect(await repositorio.pendenteDoPapel('e', Papel.EDITOR)).toBeUndefined();
  });
});

describe('RepositorioRecomendacoesMemoria', () => {
  it('lista as recomendações do projeto', async () => {
    const repositorio = new RepositorioRecomendacoesMemoria();
    const base = {
      papel: Papel.DIRETOR,
      profissionalId: 'prof',
      score: 0.5,
      posicao: 1,
      estrategia: 'x',
      rodada: 1,
    };
    await repositorio.salvarTodas([
      Recomendacao.criar({ ...base, projetoId: 'p-1' }),
      Recomendacao.criar({ ...base, projetoId: 'p-2' }),
    ]);

    expect(await repositorio.listarPorProjeto('p-1')).toHaveLength(1);
  });
});
