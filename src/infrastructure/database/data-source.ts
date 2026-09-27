import { DataSource } from 'typeorm';
import type { ConfigBanco } from '../../config/config.js';
import { entidades } from './schemas/index.js';
import { migracoes } from './migrations/index.js';

export function criarDataSource(banco: ConfigBanco): DataSource {
  return new DataSource({
    type: 'postgres',
    host: banco.host,
    port: banco.porta,
    username: banco.usuario,
    password: banco.senha,
    database: banco.nome,
    entities: entidades,
    migrations: migracoes,
    synchronize: false,
    logging: false,
    connectTimeoutMS: banco.timeoutMs,
    extra: { max: banco.poolMaximo },
  });
}
