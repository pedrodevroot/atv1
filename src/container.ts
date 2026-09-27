import type { DataSource } from 'typeorm';
import { ConsultarSaude } from './application/use-cases/consultar-saude.js';
import type { DependenciasApi } from './app.js';
import type { Config } from './config/config.js';
import { criarDataSource } from './infrastructure/database/data-source.js';
import { VerificadorBanco } from './infrastructure/database/verificador-banco.js';

export interface Container extends DependenciasApi {
  readonly config: Config;
  readonly dataSource: DataSource;
  encerrar(): Promise<void>;
}

export function criarContainer(config: Config): Container {
  const dataSource = criarDataSource(config.banco);
  const consultarSaude = new ConsultarSaude([new VerificadorBanco(dataSource)]);

  return {
    config,
    dataSource,
    consultarSaude,
    async encerrar() {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    },
  };
}
