import { construirApp } from './app.js';
import { carregarArquivoEnv, carregarConfig } from './config/config.js';
import { criarContainer } from './container.js';
import { criarOpcoesLogger } from './infrastructure/logging/opcoes-logger.js';

carregarArquivoEnv();
const config = carregarConfig();
const container = criarContainer(config);
const app = await construirApp(container, { logger: criarOpcoesLogger(config) });

app.addHook('onClose', async () => {
  await container.encerrar();
});

try {
  await container.dataSource.initialize();
} catch (erro) {
  app.log.warn({ err: erro }, 'Banco indisponível na inicialização; serviço em modo degradado');
}

await app.listen({ host: config.servidor.host, port: config.servidor.porta });

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sinal, () => {
    app.log.info({ sinal }, 'Encerrando serviço');
    void app.close().then(() => process.exit(0));
  });
}
