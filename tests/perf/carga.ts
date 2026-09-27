import { readFileSync } from 'node:fs';
import autocannon from 'autocannon';

const url = process.env.PERF_URL ?? 'http://localhost:3000/health';
const metodo = (process.env.PERF_METODO ?? 'GET') as autocannon.Request['method'];
const corpo = process.env.PERF_CORPO ? readFileSync(process.env.PERF_CORPO, 'utf8') : undefined;
const conexoes = Number(process.env.PERF_CONEXOES ?? 100);
const duracao = Number(process.env.PERF_DURACAO ?? 10);
const limiteP99Ms = Number(process.env.PERF_LIMITE_P99_MS ?? 2000);

const resultado = await autocannon({
  url,
  method: metodo,
  connections: conexoes,
  duration: duracao,
  headers: { 'content-type': 'application/json' },
  ...(corpo === undefined ? {} : { body: corpo }),
});

const resumo = {
  url,
  metodo,
  conexoes,
  duracaoSegundos: duracao,
  requisicoes: resultado.requests.total,
  requisicoesPorSegundo: resultado.requests.average,
  latenciaMediaMs: resultado.latency.average,
  latenciaP50Ms: resultado.latency.p50,
  latenciaP99Ms: resultado.latency.p99,
  latenciaMaximaMs: resultado.latency.max,
  erros: resultado.errors,
  timeouts: resultado.timeouts,
  respostasNao2xx: resultado.non2xx,
  limiteP99Ms,
};

console.table(resumo);

const aprovado =
  resultado.latency.p99 < limiteP99Ms &&
  resultado.errors === 0 &&
  resultado.timeouts === 0 &&
  resultado.non2xx === 0;

console.info(aprovado ? 'APROVADO' : 'REPROVADO');
process.exitCode = aprovado ? 0 : 1;
