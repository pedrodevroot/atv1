import type { DataSource } from 'typeorm';
import type { RepositorioProjetos } from '../../application/ports/repositorio-projetos.js';
import type { Projeto } from '../../domain/entidades/projeto.js';
import { inserir, inserirOuAtualizar } from '../database/escrita.js';
import { deProjeto, paraProjeto, type LinhasProjetoLidas } from '../database/mapeadores.js';
import {
  EquipeSchema,
  MembroEquipeSchema,
  ProjetoSchema,
  RequisitoPapelSchema,
} from '../database/schemas/projeto.schema.js';
import type { RepositorioProfissionaisTypeorm } from './repositorio-profissionais-typeorm.js';

export class RepositorioProjetosTypeorm implements RepositorioProjetos {
  constructor(
    private readonly dataSource: DataSource,
    private readonly profissionais: RepositorioProfissionaisTypeorm,
  ) {}

  async obter(id: string): Promise<Projeto | undefined> {
    const [projeto] = await this.dataSource.query<LinhasProjetoLidas['projeto'][]>(
      'SELECT * FROM projeto WHERE id = $1',
      [id],
    );
    if (!projeto) {
      return undefined;
    }
    const [requisitos, equipes, membros] = await Promise.all([
      this.dataSource.query<LinhasProjetoLidas['requisitos']>(
        'SELECT * FROM requisito_papel WHERE projeto_id = $1',
        [id],
      ),
      this.dataSource.query<LinhasProjetoLidas['equipes']>(
        'SELECT * FROM equipe WHERE projeto_id = $1 ORDER BY ordem, criada_em, id',
        [id],
      ),
      this.dataSource.query<LinhasProjetoLidas['membros']>(
        `SELECT m.* FROM membro_equipe m
         JOIN equipe e ON e.id = m.equipe_id
         WHERE e.projeto_id = $1`,
        [id],
      ),
    ]);
    const profissionais = await this.profissionais.obterPorIds(
      membros.map((membro) => membro.profissional_id),
    );
    return paraProjeto({ projeto, requisitos, equipes, membros }, profissionais);
  }

  async salvar(projeto: Projeto): Promise<void> {
    const linhas = deProjeto(projeto);
    const equipesIds = linhas.equipes.map((equipe) => equipe.id);
    await this.dataSource.transaction(async (manager) => {
      await inserirOuAtualizar(manager, ProjetoSchema, [linhas.projeto], ['id']);
      await manager.query('DELETE FROM requisito_papel WHERE projeto_id = $1', [projeto.id]);
      await inserir(manager, RequisitoPapelSchema, linhas.requisitos);
      await inserirOuAtualizar(manager, EquipeSchema, linhas.equipes, ['id']);
      await manager.query('DELETE FROM membro_equipe WHERE equipe_id = ANY($1::text[])', [
        equipesIds,
      ]);
      await inserir(manager, MembroEquipeSchema, linhas.membros);
    });
  }
}
