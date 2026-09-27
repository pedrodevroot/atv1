import type { DataSource } from 'typeorm';
import { FiltragemColaborativa } from './application/strategies/filtragem-colaborativa.js';
import { RegistroEstrategias } from './application/strategies/registro-estrategias.js';
import { RegrasOrcamento } from './application/strategies/regras-orcamento.js';
import { SimilaridadeCosseno } from './application/strategies/similaridade-cosseno.js';
import { ConsultarSaude } from './application/use-cases/consultar-saude.js';
import type { DependenciasApi } from './app.js';
import type { Config } from './config/config.js';
import { criarDataSource } from './infrastructure/database/data-source.js';
import { VerificadorBanco } from './infrastructure/database/verificador-banco.js';

export interface Container extends DependenciasApi {
  readonly config: Config;
  readonly dataSource: DataSource;
  readonly registroEstrategias: RegistroEstrategias;
  encerrar(): Promise<void>;
}

export function criarRegistroEstrategias(): RegistroEstrategias {
  return new RegistroEstrategias([
    new SimilaridadeCosseno(),
    new FiltragemColaborativa(),
    new RegrasOrcamento(),
  ]);
}

export function criarContainer(config: Config): Container {
  const dataSource = criarDataSource(config.banco);
  const consultarSaude = new ConsultarSaude([new VerificadorBanco(dataSource)]);

  return {
    config,
    dataSource,
    consultarSaude,
    registroEstrategias: criarRegistroEstrategias(),
    async encerrar() {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    },
  };
}
