import type { DataSource } from 'typeorm';

export interface Semeador {
  readonly nome: string;
  executar(dataSource: DataSource): Promise<number>;
}

export const semeadores: Semeador[] = [];
