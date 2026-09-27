import type { RepositorioConvites } from '../../application/ports/repositorio-convites.js';
import type { RepositorioRecomendacoes } from '../../application/ports/repositorio-recomendacoes.js';
import type { Convite } from '../../domain/entidades/convite.js';
import type { Recomendacao } from '../../domain/entidades/recomendacao.js';
import type { Papel } from '../../domain/enums/papel.js';

export class RepositorioConvitesMemoria implements RepositorioConvites {
  private readonly convites = new Map<string, Convite>();

  obter(id: string): Promise<Convite | undefined> {
    return Promise.resolve(this.convites.get(id));
  }

  salvar(convite: Convite): Promise<void> {
    this.convites.set(convite.id, convite);
    return Promise.resolve();
  }

  pendenteDoPapel(equipeId: string, papel: Papel): Promise<Convite | undefined> {
    return Promise.resolve(
      [...this.convites.values()].find(
        (convite) => convite.equipeId === equipeId && convite.papel === papel && convite.pendente,
      ),
    );
  }
}

export class RepositorioRecomendacoesMemoria implements RepositorioRecomendacoes {
  private readonly recomendacoes: Recomendacao[] = [];

  salvarTodas(recomendacoes: readonly Recomendacao[]): Promise<void> {
    this.recomendacoes.push(...recomendacoes);
    return Promise.resolve();
  }

  listarPorProjeto(projetoId: string): Promise<Recomendacao[]> {
    return Promise.resolve(
      this.recomendacoes.filter((recomendacao) => recomendacao.projetoId === projetoId),
    );
  }
}
