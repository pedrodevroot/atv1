import type { RepositorioProjetos } from '../../application/ports/repositorio-projetos.js';
import type { Projeto } from '../../domain/entidades/projeto.js';

export class RepositorioProjetosMemoria implements RepositorioProjetos {
  private readonly projetos = new Map<string, Projeto>();

  obter(id: string): Promise<Projeto | undefined> {
    return Promise.resolve(this.projetos.get(id));
  }

  salvar(projeto: Projeto): Promise<void> {
    this.projetos.set(projeto.id, projeto);
    return Promise.resolve();
  }
}
