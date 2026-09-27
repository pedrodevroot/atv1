import type { DataSource } from 'typeorm';
import type { VerificadorDependencia } from '../../application/ports/verificador-dependencia.js';

export class VerificadorBanco implements VerificadorDependencia {
  readonly nome = 'postgres';

  constructor(private readonly dataSource: DataSource) {}

  async verificar(): Promise<boolean> {
    try {
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
