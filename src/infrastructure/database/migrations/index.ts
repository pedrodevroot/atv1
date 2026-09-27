import type { MigrationInterface } from 'typeorm';
import { CriarEsquemaInicial1790540000000 } from './1790540000000-criar-esquema-inicial.js';

export const migracoes: (new () => MigrationInterface)[] = [CriarEsquemaInicial1790540000000];
