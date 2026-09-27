import type { DataSource } from 'typeorm';
import { carregarArquivoEnv, carregarConfig } from '../../../config/config.js';
import { criarDataSource } from '../data-source.js';

export async function executarComBanco(tarefa: (dataSource: DataSource) => Promise<void>) {
  carregarArquivoEnv();
  const dataSource = criarDataSource(carregarConfig().banco);
  try {
    await dataSource.initialize();
    await tarefa(dataSource);
  } catch (erro) {
    console.error(erro);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}
