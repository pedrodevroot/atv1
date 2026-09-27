import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Type, { type Static } from 'typebox';
import Value from 'typebox/value';

const AMBIENTES = ['development', 'test', 'production'] as const;
const NIVEIS_LOG = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const EsquemaAmbiente = Type.Object({
  NODE_ENV: Type.Enum(AMBIENTES, { default: 'development' }),
  HOST: Type.String({ minLength: 1, default: '0.0.0.0' }),
  PORT: Type.Integer({ minimum: 0, maximum: 65535, default: 3000 }),
  LOG_LEVEL: Type.Enum(NIVEIS_LOG, { default: 'info' }),
  DB_HOST: Type.String({ minLength: 1, default: 'localhost' }),
  DB_PORT: Type.Integer({ minimum: 1, maximum: 65535, default: 5432 }),
  DB_USER: Type.String({ minLength: 1 }),
  DB_PASSWORD: Type.String({ minLength: 1 }),
  DB_NAME: Type.String({ minLength: 1 }),
  DB_SCHEMA: Type.String({ pattern: '^[a-z_][a-z0-9_]{0,62}$', default: 'public' }),
  DB_POOL_MAX: Type.Integer({ minimum: 1, maximum: 200, default: 20 }),
  DB_TIMEOUT_MS: Type.Integer({ minimum: 100, maximum: 60000, default: 2000 }),
});

type Ambiente = Static<typeof EsquemaAmbiente>;

export type NivelLog = (typeof NIVEIS_LOG)[number];

export interface ConfigBanco {
  host: string;
  porta: number;
  usuario: string;
  senha: string;
  nome: string;
  schema: string;
  poolMaximo: number;
  timeoutMs: number;
}

export interface Config {
  ambiente: (typeof AMBIENTES)[number];
  servidor: { host: string; porta: number };
  log: { nivel: NivelLog };
  banco: ConfigBanco;
}

export class ErroConfiguracao extends Error {
  constructor(readonly problemas: string[]) {
    super(`Configuração inválida: ${problemas.join('; ')}`);
    this.name = 'ErroConfiguracao';
  }
}

export function carregarArquivoEnv(caminho = resolve(process.cwd(), '.env')): boolean {
  if (!existsSync(caminho)) {
    return false;
  }
  process.loadEnvFile(caminho);
  return true;
}

export function carregarConfig(variaveis: NodeJS.ProcessEnv = process.env): Config {
  const entrada = Object.fromEntries(
    Object.keys(EsquemaAmbiente.properties).flatMap((chave) => {
      const valor = variaveis[chave];
      return valor === undefined || valor === '' ? [] : [[chave, valor]];
    }),
  );
  const convertido = Value.Convert(EsquemaAmbiente, Value.Default(EsquemaAmbiente, entrada));

  if (!Value.Check(EsquemaAmbiente, convertido)) {
    const problemas = Value.Errors(EsquemaAmbiente, convertido).map(
      (erro) => `${erro.instancePath.replace('/', '') || 'raiz'}: ${erro.message}`,
    );
    throw new ErroConfiguracao([...new Set(problemas)]);
  }

  return mapearConfig(convertido);
}

function mapearConfig(ambiente: Ambiente): Config {
  return {
    ambiente: ambiente.NODE_ENV,
    servidor: { host: ambiente.HOST, porta: ambiente.PORT },
    log: { nivel: ambiente.LOG_LEVEL },
    banco: {
      host: ambiente.DB_HOST,
      porta: ambiente.DB_PORT,
      usuario: ambiente.DB_USER,
      senha: ambiente.DB_PASSWORD,
      nome: ambiente.DB_NAME,
      schema: ambiente.DB_SCHEMA,
      poolMaximo: ambiente.DB_POOL_MAX,
      timeoutMs: ambiente.DB_TIMEOUT_MS,
    },
  };
}
