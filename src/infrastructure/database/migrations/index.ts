import type { MigrationInterface } from 'typeorm';
import { CriarEsquemaInicial1790540000000 } from './1790540000000-criar-esquema-inicial.js';
import { AdicionarOrdemEquipe1790550000000 } from './1790550000000-adicionar-ordem-equipe.js';
import { AdicionarDescartadosEquipe1790560000000 } from './1790560000000-adicionar-descartados-equipe.js';

export const migracoes: (new () => MigrationInterface)[] = [
  CriarEsquemaInicial1790540000000,
  AdicionarOrdemEquipe1790550000000,
  AdicionarDescartadosEquipe1790560000000,
];
