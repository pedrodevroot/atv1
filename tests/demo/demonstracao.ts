import {
  eventoRecomendacaoGerada,
  membrosSugeridos,
} from '../../src/application/eventos/fabrica-eventos.js';
import { OrquestradorPadrao } from '../../src/application/orchestration/orquestrador-padrao.js';
import { OrquestradorSubstituicao } from '../../src/application/orchestration/orquestrador-substituicao.js';
import { AuditoriaRecomendacao } from '../../src/application/observers/auditoria-recomendacao.js';
import { NotificadorEmail } from '../../src/application/observers/notificador-email.js';
import { NotificadorInterno } from '../../src/application/observers/notificador-interno.js';
import { PublicadorIntegracao } from '../../src/application/observers/publicador-integracao.js';
import type { Observador } from '../../src/application/ports/observador.js';
import type { RepositorioProfissionais } from '../../src/application/ports/repositorio-profissionais.js';
import { CalculadorCompatibilidade } from '../../src/application/visitors/calculador-compatibilidade.js';
import { GeradorRelatorio } from '../../src/application/visitors/gerador-relatorio.js';
import { ValidadorConsistencia } from '../../src/application/visitors/validador-consistencia.js';
import { criarCanaisSaida } from '../../src/container.js';
import { Papel } from '../../src/domain/enums/papel.js';
import { criarEvento } from '../../src/domain/eventos/evento-recomendacao.js';
import { BarramentoEventosEmMemoria } from '../../src/infrastructure/messaging/barramento-eventos-memoria.js';
import { criarArvoreProjeto, fotografar } from '../fixtures/arvore-projeto.js';
import {
  criarCadastroDemonstracao,
  criarProjetoDemonstracao,
} from '../fixtures/cadastro-demonstracao.js';
import { criarProjeto } from '../fixtures/dominio.js';
import { criarAmbienteOrquestracao, relogioFixo } from '../fixtures/orquestracao.js';

const titulo = (texto: string) => {
  console.info(`\n${'='.repeat(78)}\n${texto}\n${'='.repeat(78)}`);
};
const passo = (texto: string) => {
  console.info(`\n> ${texto}`);
};

async function demonstrarStrategy() {
  titulo('1. STRATEGY: mesmo projeto e mesmo cadastro, estratégias diferentes');
  const { registro, parametros } = criarAmbienteOrquestracao();
  const cadastro = criarCadastroDemonstracao();
  for (const estrategia of registro.listar()) {
    passo(`${estrategia.nome}: ${estrategia.descricao}`);
    const ranking = estrategia.recomendar(criarProjetoDemonstracao(), cadastro, parametros);
    console.table(
      (ranking.get(Papel.DIRETOR) ?? []).map((candidato, indice) => ({
        posicao: indice + 1,
        diretor: candidato.profissional.nome,
        score: candidato.score,
        custo: candidato.custoEstimado,
        justificativa: candidato.justificativa,
      })),
    );
  }
  console.info(
    'Cada estratégia coloca um diretor diferente em 1º lugar; a troca é feita em tempo de execução.',
  );
  await Promise.resolve();
}

async function demonstrarTemplateMethod() {
  titulo('2. TEMPLATE METHOD: o fluxo principal é invariável');
  const { repositorio, parametros, cosseno } = criarAmbienteOrquestracao();
  const projeto = criarProjetoDemonstracao();

  const padrao = await new OrquestradorPadrao(repositorio, relogioFixo).orquestrar({
    projeto,
    estrategia: cosseno,
    parametros,
  });
  projeto.registrarSugestoes(padrao.equipes);
  const [equipe] = padrao.equipes;
  const substituicao = await new OrquestradorSubstituicao(repositorio, relogioFixo).orquestrar({
    projeto,
    estrategia: cosseno,
    parametros,
    equipeId: equipe?.id ?? '',
    papel: Papel.EDITOR,
  });
  passo('Etapas executadas por cada subclasse:');
  console.table({
    OrquestradorPadrao: padrao.etapas.join(' > '),
    OrquestradorSubstituicao: substituicao.etapas.join(' > '),
  });
  console.info(
    `Padrão: ${padrao.equipes.length} sugestões. Substituição: novo editor = ${equipe?.membro(Papel.EDITOR)?.profissional.nome ?? '-'}.`,
  );

  passo('Uma validação que falha interrompe o fluxo antes de buscar e ranquear:');
  let buscas = 0;
  const repositorioContado: RepositorioProfissionais = {
    buscarCandidatos: (criterios) => {
      buscas += 1;
      return repositorio.buscarCandidatos(criterios);
    },
  };
  try {
    await new OrquestradorPadrao(repositorioContado, relogioFixo).orquestrar({
      projeto: criarProjeto({ orcamento: 1_500 }),
      estrategia: cosseno,
      parametros,
    });
  } catch (erro) {
    console.info(`Erro: ${(erro as Error).message} | buscas no repositório: ${buscas}`);
  }

  passo('Uma subclasse que tenta sobrescrever orquestrar() é recusada:');
  class Atalho extends OrquestradorPadrao {
    override orquestrar(): never {
      throw new Error('pulou etapas');
    }
  }
  try {
    new Atalho(repositorio);
  } catch (erro) {
    console.info(`Erro: ${(erro as Error).message}`);
  }
}

async function demonstrarObserver() {
  titulo('3. OBSERVER: observadores reagem de forma independente');
  const falhas: string[] = [];
  const barramento = new BarramentoEventosEmMemoria((falha) =>
    falhas.push(`${falha.observador}: ${(falha.erro as Error).message}`),
  );
  const canais = criarCanaisSaida();
  const quebrado: Observador = {
    nome: 'notificador-sms (fora do ar)',
    interesses: '*',
    atualizar: () => Promise.reject(new Error('gateway de SMS indisponível')),
  };
  for (const observador of [
    quebrado,
    new NotificadorEmail(canais.email),
    new NotificadorInterno(canais.caixa),
    new AuditoriaRecomendacao(canais.auditoria),
    new PublicadorIntegracao(canais.publicador),
  ]) {
    barramento.adicionarObservador(observador);
  }

  const { repositorio, parametros, cosseno } = criarAmbienteOrquestracao();
  const projeto = criarProjetoDemonstracao();
  const resultado = await new OrquestradorPadrao(repositorio, relogioFixo).orquestrar({
    projeto,
    estrategia: cosseno,
    parametros,
  });
  const evento = eventoRecomendacaoGerada({
    projeto,
    equipes: resultado.equipes,
    membros: membrosSugeridos(resultado.equipes),
    estrategia: cosseno.nome,
    rodada: resultado.rodada,
    parcial: resultado.parcial,
  });

  passo('Publicando RECOMENDACAO_GERADA (entrega assíncrona):');
  barramento.notificarObservadores(evento);
  console.info(
    `Logo após publicar: ${canais.email.enviados.total} e-mails enviados, ${barramento.entregasPendentes} entregas pendentes.`,
  );
  await barramento.aguardarEntregas();
  console.table({
    'e-mails enviados': canais.email.enviados.total,
    'registros de auditoria': canais.auditoria.entradas.total,
    'publicações para outros serviços': canais.publicador.publicadas.total,
    'falhas isoladas': falhas.length,
  });
  console.info(`Falha registrada sem afetar os demais: ${falhas.join('; ')}`);

  passo('Publicando EQUIPE_FORMADA (só agora o publicador de integração reage):');
  barramento.notificarObservadores(
    criarEvento(
      'EQUIPE_FORMADA',
      {
        projetoId: projeto.id,
        produtorId: projeto.produtorId,
        equipeId: resultado.equipes[0]?.id ?? '',
        custoTotal: resultado.equipes[0]?.custoTotal ?? 0,
        membros: [],
      },
      { origem: 'demonstracao' },
    ),
  );
  await barramento.aguardarEntregas();
  console.info(
    `Tópicos publicados: ${canais.publicador.publicadas.todos.map((mensagem) => mensagem.topico).join(', ')}`,
  );
}

async function demonstrarVisitor() {
  titulo('4. VISITOR: operações distintas sobre a mesma árvore, sem alterar o domínio');
  const { projeto } = await criarArvoreProjeto();
  const antes = JSON.stringify(fotografar(projeto));

  const validacao = projeto.aceitar(new ValidadorConsistencia(projeto));
  const compatibilidade = projeto.aceitar(new CalculadorCompatibilidade(projeto));
  const relatorio = projeto.aceitar(new GeradorRelatorio(projeto, relogioFixo()));

  console.table({
    ValidadorConsistencia: `válido: ${validacao.valido}, problemas: ${validacao.problemas.length}`,
    CalculadorCompatibilidade: `compatibilidade da melhor equipe: ${compatibilidade.toFixed(2)}`,
    GeradorRelatorio: `${relatorio.split('\n').length} linhas de relatório`,
  });
  passo('Início do relatório gerado:');
  console.info(relatorio.split('\n').slice(0, 16).join('\n'));
  console.info(
    `\nÁrvore idêntica após as três visitas: ${JSON.stringify(fotografar(projeto)) === antes}`,
  );
}

await demonstrarStrategy();
await demonstrarTemplateMethod();
await demonstrarObserver();
await demonstrarVisitor();
console.info('\nDemonstração concluída.');
