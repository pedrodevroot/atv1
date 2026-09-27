import { carregarArquivoEnv } from '../../src/config/config.js';

carregarArquivoEnv();
process.env.NODE_ENV = 'test';
