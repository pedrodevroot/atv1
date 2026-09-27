import type {
  CriteriosBusca,
  RepositorioProfissionais,
  ResultadoBusca,
} from '../../application/ports/repositorio-profissionais.js';
import type { Profissional } from '../../domain/entidades/profissional.js';

export class RepositorioProfissionaisMemoria implements RepositorioProfissionais {
  private readonly profissionais = new Map<string, Profissional>();

  constructor(iniciais: readonly Profissional[] = []) {
    this.salvarTodos(iniciais);
  }

  salvarTodos(profissionais: readonly Profissional[]): void {
    for (const profissional of profissionais) {
      this.profissionais.set(profissional.id, profissional);
    }
  }

  get total(): number {
    return this.profissionais.size;
  }

  buscarCandidatos(criterios: CriteriosBusca): Promise<ResultadoBusca> {
    const excluidos = new Set(criterios.excluirIds ?? []);
    const profissionais = [...this.profissionais.values()].filter(
      (profissional) =>
        profissional.ativo &&
        !excluidos.has(profissional.id) &&
        criterios.papeis.some((papel) => profissional.atuaComo(papel)) &&
        profissional.faixaPreco.cabeNoOrcamento(criterios.precoMinimoAte) &&
        profissional.disponivelEm(criterios.periodo),
    );
    return Promise.resolve({ profissionais, parcial: false, avisos: [] });
  }
}
