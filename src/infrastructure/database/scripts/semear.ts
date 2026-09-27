import { semeadores } from '../seeds/index.js';
import { executarComBanco } from './executar-com-banco.js';

await executarComBanco(async (dataSource) => {
  if (semeadores.length === 0) {
    console.info('Nenhum semeador registrado.');
    return;
  }
  for (const semeador of semeadores) {
    const inicio = performance.now();
    const registros = await semeador.executar(dataSource);
    const duracao = Math.round(performance.now() - inicio);
    console.info(`${semeador.nome}: ${registros} registros em ${duracao} ms`);
  }
});
