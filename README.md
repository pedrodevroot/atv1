# CineBridge — Microsserviço de Recomendação e Orquestração de Equipes

API REST que recebe um projeto audiovisual, ranqueia os profissionais cadastrados
para cada papel técnico e monta sugestões de equipe dentro do orçamento e do prazo,
notificando os envolvidos e registrando tudo em auditoria.

Primeiro microsserviço da plataforma **CineBridge** — os próximos (gerenciamento de
projetos, financeiro) serão containers independentes na mesma rede Docker e no
mesmo PostgreSQL, cada um com seu próprio banco.

**Atividade ATVI** — Técnicas de Programação — Prof. Dr. Eng. Gerson Penha

---

## Tecnologias

|                           | Versão |
| ------------------------- | ------ |
| Node.js (LTS)             | 22     |
| TypeScript (modo estrito) | 6      |
| Fastify + TypeBox         | 5 / 1  |
| TypeORM                   | 1.1    |
| PostgreSQL                | 18     |
| Vitest                    | 5      |
| Docker Compose            | —      |

## O que precisa estar instalado na máquina

**Apenas o Docker Desktop** (ou Docker + Docker Compose no Linux).

Node.js **não** é necessário para executar: o `Dockerfile` instala as dependências,
compila o TypeScript e gera a imagem final só com o código compilado e as
dependências de produção.

As portas `3000` (API) e `5434` (PostgreSQL) precisam estar livres.

Para rodar os testes ou desenvolver é preciso o **Node.js 22.12+** (`.nvmrc`).

---

## Como executar

```bash
git clone https://github.com/pedrodevroot/atv1.git
cd atv1
docker compose up -d --build --wait
```

Nada para configurar: usuário, senha e nome do banco têm valor padrão no
`docker-compose.yml`. O mesmo comando funciona no Windows (PowerShell) e no Ubuntu.

|                                   | Endereço                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------- |
| API                               | http://localhost:3000                                                         |
| Documentação interativa (Swagger) | http://localhost:3000/docs                                                    |
| PostgreSQL                        | localhost:5434 — base `cinebridge_recomendacao`, usuário/senha `recomendacao` |

O comando sobe dois containers: o PostgreSQL compartilhado e o microsserviço. Na
primeira subida o microsserviço aplica as migrações e cadastra **10.000
profissionais** de demonstração (cerca de 30 segundos; desligável com
`SEED_AO_INICIAR=false`). A API roda em cluster com 4 processos
(`WEB_CONCURRENCY`).

### Conferir se subiu

```bash
docker compose ps
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "dependencias": { "postgres": "disponivel", "cadastro-profissionais": "disponivel" }
}
```

### Parar

```bash
docker compose down        # para os containers e mantém os dados
docker compose down -v     # para e apaga o banco
```

### Executar fora do Docker (desenvolvimento)

```bash
npm ci
cp .env.example .env       # PowerShell: Copy-Item .env.example .env
npm run db:up              # só o PostgreSQL, em localhost:5434
npm run db:preparar        # migrações + seed de 10 mil profissionais se o banco estiver vazio
npm run dev                # http://localhost:3000, recarrega ao salvar
```

---

## Os quatro padrões de projeto

```bash
npm run demo
```

Imprime as quatro demonstrações pedidas na atividade, sem precisar de banco.

| Padrão              | Onde está                                                | O que a demonstração prova                                                                                                                                           | Teste                                  |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Strategy**        | `src/application/strategies`                             | Mesmo projeto e mesmo cadastro: cosseno escolhe Helena Técnica, colaborativa escolhe Marta Consagrada, regras de orçamento escolhem Caio Local                       | `demonstracao-strategy.test.ts`        |
| **Template Method** | `src/application/orchestration`                          | `OrquestradorPadrao` e `OrquestradorSubstituicao` executam as mesmas 7 etapas; falha na validação interrompe antes de buscar; sobrescrever `orquestrar()` é recusado | `demonstracao-template-method.test.ts` |
| **Observer**        | `src/application/observers` + `infrastructure/messaging` | Um observador falha e e-mail, mensagem interna, auditoria e integração continuam; entrega assíncrona; observador lento não atrasa os demais                          | `demonstracao-observer.test.ts`        |
| **Visitor**         | `src/application/visitors`                               | Validação, compatibilidade e relatório sobre a mesma árvore; a árvore não muda; um visitante novo não exige alterar o domínio                                        | `demonstracao-visitor.test.ts`         |

---

## Como executar os testes

```bash
npm ci
npm run db:up        # os testes de integração usam o PostgreSQL do Docker
npm test             # todos
npm run test:unit    # só os unitários, sem banco
npm run coverage     # todos, reprovando abaixo de 80% de cobertura
```

São **277 testes automatizados**, em cerca de 15 segundos. Os de integração rodam
num schema separado (`teste_integracao`) e não apagam os dados de
desenvolvimento.

| Camada                                                           | Testes | Ferramenta              |
| ---------------------------------------------------------------- | ------ | ----------------------- |
| Domínio (entidades, value objects, eventos)                      | 86     | Vitest                  |
| Strategy                                                         | 48     | Vitest                  |
| Template Method                                                  | 25     | Vitest                  |
| Observer                                                         | 20     | Vitest                  |
| Visitor                                                          | 19     | Vitest                  |
| Aplicação (saúde, precisão)                                      | 7      | Vitest                  |
| Infraestrutura (config, cache resiliente, disjuntor, barramento) | 30     | Vitest                  |
| API HTTP com repositórios em memória                             | 24     | Vitest + `app.inject()` |
| Integração com PostgreSQL (repositórios, API ponta a ponta)      | 15     | Vitest + PostgreSQL 18  |
| Desempenho com 10 mil profissionais                              | 3      | Vitest                  |

Cobertura: **99,2% das linhas** (mínimo exigido: 80%). O CI roda lint, tipos,
build e testes no **Ubuntu 24.04 e no Windows**, com Node 22 e 24, além da
integração com PostgreSQL e da subida da stack Docker.

| Comando                   | O que faz                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `npm run lint`            | ESLint sem nenhum warning (inclui regra que proíbe comentários e `any`) + Prettier |
| `npm run typecheck`       | TypeScript estrito no código e nos testes                                          |
| `npm run test:desempenho` | Cada estratégia ranqueia 10 mil profissionais para 6 papéis em menos de 2 s        |
| `npm run perf`            | Teste de carga (ver [docs/desempenho.md](docs/desempenho.md))                      |
| `npm run precisao`        | Precision@5 de cada estratégia e parâmetro                                         |

---

## Endpoints

Base: `http://localhost:3000` — todos também em http://localhost:3000/docs e em
[requests.http](requests.http) (extensão REST Client do VS Code), na ordem do fluxo.

Em todo `POST` o corpo é JSON (`Content-Type: application/json`). O header
`x-request-id` é opcional e vira o `correlacaoId` da auditoria.

### Projetos e recomendações

| Método | URL                                   | Corpo | Esperado |
| ------ | ------------------------------------- | ----- | -------- |
| `GET`  | `/estrategias`                        | —     | 200      |
| `POST` | `/projetos`                           | **A** | 201      |
| `GET`  | `/projetos/{projetoId}`               | —     | 200      |
| `POST` | `/projetos/{projetoId}/recomendacoes` | **B** | 201      |
| `GET`  | `/projetos/{projetoId}/recomendacoes` | —     | 200      |
| `POST` | `/projetos/{projetoId}/reavaliacao`   | **C** | 200      |

### Equipe e convites

| Método   | URL                                                                    | Corpo | Esperado                    |
| -------- | ---------------------------------------------------------------------- | ----- | --------------------------- |
| `POST`   | `/projetos/{projetoId}/equipes/{equipeId}/membros/DIRETOR/aceite`      | —     | 201, cria o convite         |
| `POST`   | `/convites/{conviteId}/resposta`                                       | **D** | 200                         |
| `DELETE` | `/projetos/{projetoId}/equipes/{equipeId}/membros/EDITOR`              | —     | 200, papel fica vago        |
| `POST`   | `/projetos/{projetoId}/equipes/{equipeId}/membros/EDITOR/substituicao` | **E** | 200                         |
| `POST`   | `/projetos/{projetoId}/equipes/{equipeId}/finalizacao`                 | —     | 200, após todos confirmarem |

### Relatórios e consultas

| Método | URL                                                  | Corpo | Esperado |
| ------ | ---------------------------------------------------- | ----- | -------- |
| `GET`  | `/projetos/{projetoId}/relatorio`                    | —     | 200      |
| `GET`  | `/projetos/{projetoId}/equipes/{equipeId}/relatorio` | —     | 200      |
| `GET`  | `/projetos/{projetoId}/auditoria`                    | —     | 200      |
| `GET`  | `/mensagens/produtor-1`                              | —     | 200      |
| `GET`  | `/health`                                            | —     | 200      |

Papéis aceitos na URL: `DIRETOR`, `DIRETOR_FOTOGRAFIA`, `SONOPLASTA`, `EDITOR`,
`ROTEIRISTA`, `EFEITOS_VISUAIS`.

### Corpos

**A** — novo projeto (a resposta já traz as equipes sugeridas e o ranking por papel)

```json
{
  "titulo": "Vozes do Sertão",
  "produtorId": "produtor-1",
  "genero": "drama",
  "tipoCaptacao": "FICCAO",
  "duracaoMinutos": 95,
  "orcamento": 280000,
  "dataInicio": "2026-10-15T00:00:00.000Z",
  "dataEntrega": "2027-02-28T00:00:00.000Z",
  "localizacao": { "cidade": "São Paulo", "uf": "SP", "latitude": -23.5505, "longitude": -46.6333 },
  "requisitos": [
    { "papel": "DIRETOR", "peso": 10 },
    { "papel": "DIRETOR_FOTOGRAFIA", "peso": 8 },
    { "papel": "ROTEIRISTA", "peso": 7 },
    { "papel": "EDITOR", "peso": 6 },
    { "papel": "SONOPLASTA", "peso": 5 },
    { "papel": "EFEITOS_VISUAIS", "peso": 3 }
  ],
  "estrategia": "similaridade-cosseno"
}
```

`tipoCaptacao`: `DOCUMENTARIO`, `FICCAO` ou `ANIMACAO`. `estrategia` é opcional:
sem ela, orçamentos até R$ 50 mil usam `regras-orcamento` e os demais
`similaridade-cosseno`.

**B** — nova rodada com outra estratégia e parâmetros próprios (todos opcionais)

```json
{
  "estrategia": "filtragem-colaborativa",
  "parametros": {
    "topN": 5,
    "colaborativa": { "pesoPriori": 3 },
    "orquestracao": { "numeroSugestoes": 2 }
  }
}
```

**C** — reavaliação: acima de 15% de variação no orçamento ou no prazo a equipe é refeita

```json
{ "orcamento": 150000, "dataEntrega": "2027-03-31T00:00:00.000Z" }
```

**D** — resposta do profissional ao convite (recusa dispara nova rodada só para o papel)

```json
{ "aceito": true }
```

**E** — substituição, opcionalmente com outra estratégia

```json
{ "estrategia": "regras-orcamento" }
```

> Os `projetoId`, `equipeId` e `conviteId` são gerados pela API. O `POST /projetos`
> devolve `projeto.id` e `projeto.equipes[0].id`; o aceite devolve `convite.id`.

### Casos de erro

| Método   | URL                                                  | Corpo                                     | Esperado                                   |
| -------- | ---------------------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| `GET`    | `/projetos/inexistente`                              | —                                         | 404 `NAO_ENCONTRADO`                       |
| `POST`   | `/convites/inexistente/resposta`                     | **D**                                     | 404 `NAO_ENCONTRADO`                       |
| `POST`   | `/projetos`                                          | `{ "titulo": "x" }`                       | 400 `REQUISICAO_INVALIDA`                  |
| `POST`   | `/projetos`                                          | **A** com `"estrategia": "aleatoria"`     | 400 `ESTRATEGIA_DESCONHECIDA`              |
| `POST`   | `/projetos`                                          | **A** com `"orcamento": 1500`             | 422 `RESTRICAO_VIOLADA`                    |
| `POST`   | `/projetos`                                          | **A** com `"dataEntrega"` antes do início | 422 `VALOR_INVALIDO`                       |
| `POST`   | `/projetos/{id}/equipes/{id}/membros/DIRETOR/aceite` | repetido                                  | 409 `TRANSICAO_INVALIDA`                   |
| `POST`   | `/convites/{conviteId}/resposta`                     | repetido                                  | 409 `TRANSICAO_INVALIDA`                   |
| `POST`   | `/projetos/{id}/equipes/{id}/finalizacao`            | com papel sem confirmar                   | 422 `REGRA_VIOLADA`                        |
| qualquer | com o PostgreSQL fora do ar                          | —                                         | 503 `SERVICO_INDISPONIVEL` + `retry-after` |

### Respostas de erro

```json
{
  "codigo": "REQUISICAO_INVALIDA",
  "mensagem": "A requisição não atende ao contrato esperado.",
  "detalhes": ["/orcamento: must be > 0"]
}
```

Erros de regra de negócio trazem só `codigo` e `mensagem`, por exemplo
`{ "codigo": "RESTRICAO_VIOLADA", "mensagem": "Orçamento de 1500 é insuficiente para 6 papéis (mínimo 6000)." }`.

Quando o cadastro de profissionais está indisponível a recomendação **não falha**:
responde com `"parcial": true` e os motivos em `"avisos"`.

### Validações

| Campo                              | Regra                                                       |
| ---------------------------------- | ----------------------------------------------------------- |
| `titulo` · `genero` · `produtorId` | obrigatórios                                                |
| `tipoCaptacao`                     | `DOCUMENTARIO`, `FICCAO` ou `ANIMACAO`                      |
| `duracaoMinutos`                   | inteiro maior que zero                                      |
| `orcamento`                        | maior que zero e suficiente para R$ 1.000 por papel         |
| `dataInicio` · `dataEntrega`       | ISO 8601; entrega depois do início e ainda não vencida      |
| `localizacao.uf`                   | 2 letras; latitude e longitude em faixas válidas            |
| `requisitos`                       | de 1 a 6 papéis, sem repetir; peso entre 0 (exclusivo) e 10 |
| `estrategia`                       | uma das listadas em `GET /estrategias`                      |
| `parametros`                       | números ≥ 0; `topN` de 1 a 100; `numeroSugestoes` de 1 a 10 |
| `reavaliacao`                      | ao menos um campo; `limiar` entre 0 e 1                     |
| campos desconhecidos               | descartados antes de chegar ao caso de uso                  |

---

## Arquitetura

Camadas com inversão de dependência. O domínio não conhece Fastify nem TypeORM; a
aplicação depende só de portas (interfaces); a composição é explícita em
`src/container.ts`.

```
src/
  domain/          entidades, value objects, eventos tipados, interface Visitavel
  application/
    ports/         interfaces que a aplicação exige (repositórios, Sujeito, canais)
    strategies/    Strategy
    orchestration/ Template Method
    observers/     Observer
    visitors/      Visitor
    use-cases/     um caso de uso por ação da API
  infrastructure/  TypeORM, cache resiliente, EventEmitter, canais de saída, pino
  api/             rotas Fastify, schemas TypeBox, apresentação e erros
  container.ts     composition root
  cluster.ts       vários processos Node atrás da mesma porta
```

Estrutura equivalente à de um projeto FastAPI:

| FastAPI                            | Aqui                                                                  |
| ---------------------------------- | --------------------------------------------------------------------- |
| `APIRouter`                        | plugin de rotas (`src/api/routes`)                                    |
| Pydantic                           | schemas TypeBox (`src/api/schemas`): validam, documentam e serializam |
| `Depends()`                        | composition root (`src/container.ts`)                                 |
| services                           | casos de uso (`src/application/use-cases`)                            |
| modelos SQLAlchemy                 | `EntitySchema` do TypeORM (`src/infrastructure/database/schemas`)     |
| pydantic-settings                  | `src/config/config.ts`, validado na inicialização                     |
| `uvicorn --reload` / `gunicorn -w` | `npm run dev` / `npm run start:cluster`                               |
| pytest + TestClient                | Vitest + `app.inject()`                                               |

A troca do EventEmitter por RabbitMQ é uma nova implementação da porta `Sujeito`,
sem alterar observadores nem casos de uso.

---

## Requisitos atendidos

| Requisito                                                                                        | Onde                                                                    | Teste                                                                  |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| RF01 projeto com gênero, duração, orçamento, entrega, captação, local e papéis com peso          | `domain/entidades/projeto.ts`, `api/schemas`                            | `projeto.test.ts`, `rotas.test.ts`                                     |
| RF02 profissional com histórico, avaliações, especialidades, preço, agenda, local e competências | `domain/entidades/profissional.ts`                                      | `profissional.test.ts`, `repositorios.test.ts`                         |
| RF03 ranking por papel respeitando orçamento e prazo                                             | `strategies/ranqueador.ts`, `filtros-candidato.ts`                      | `contrato-estrategias.test.ts`                                         |
| RF04 uma ou mais sugestões de equipe                                                             | `orchestration/orquestrador-padrao.ts`                                  | `orquestrador-padrao.test.ts`                                          |
| RF05 aceitar, rejeitar e substituir membros                                                      | `use-cases/casos-equipe.ts`, `domain/entidades/equipe.ts`               | `equipe.test.ts`, `rotas.test.ts`                                      |
| RF06 substituição refaz só o papel afetado                                                       | `orchestration/orquestrador-substituicao.ts`                            | `orquestrador-substituicao.test.ts`                                    |
| RF07 reavaliação completa quando orçamento/prazo mudam muito                                     | `Projeto.solicitarReavaliacao`, `ReavaliarProjeto`                      | `projeto.test.ts`, `rotas.test.ts`                                     |
| RF08 profissionais avisados do interesse do produtor                                             | `observers/compositor-notificacoes.ts`                                  | `observadores.test.ts`                                                 |
| RF09 produtor avisado de aceite e recusa                                                         | `observers/compositor-notificacoes.ts`                                  | `observadores.test.ts`, `fluxo-api.ts`                                 |
| RF10 recusa atualiza a composição e gera nova rodada                                             | `observers/atualizador-composicao.ts`                                   | `atualizador-composicao.test.ts`                                       |
| RF11 composição final registrada e publicada para projetos e financeiro                          | `FinalizarEquipe`, `observers/publicador-integracao.ts`                 | `api-fluxo.test.ts`                                                    |
| RF12 estratégia dinâmica, na criação ou pelo produtor                                            | `strategies/registro-estrategias.ts`                                    | `demonstracao-strategy.test.ts`                                        |
| RF13 validação, compatibilidade e relatório                                                      | `application/visitors`                                                  | `demonstracao-visitor.test.ts`, `visitantes.test.ts`                   |
| RF14 endpoint que recebe o projeto e devolve a equipe com notificações e auditoria               | `POST /projetos`                                                        | `rotas.test.ts`, `api-fluxo.test.ts`                                   |
| RNF01 menos de 2 s com 10 mil profissionais                                                      | cache do cadastro, ranqueador com top-N parcial                         | `estrategias.desempenho.test.ts`, [desempenho](docs/desempenho.md)     |
| RNF02 pelo menos 100 requisições simultâneas                                                     | `cluster.ts`, pool repartido                                            | [desempenho](docs/desempenho.md): 100 simultâneas, p99 1,76 s, 0 erros |
| RNF03 precisão mensurável e algoritmo parametrizável                                             | `strategies/parametros-recomendacao.ts`, `avaliacao/precisao.ts`        | `precisao.test.ts`, `npm run precisao`                                 |
| RNF04 ações registradas em logs estruturados                                                     | `observers/auditoria-recomendacao.ts`, tabela `auditoria`, pino em JSON | `observadores.test.ts`, `GET /auditoria`                               |
| RNF05 tolerância a falhas com resultado parcial                                                  | `repositorio-profissionais-resiliente.ts`, `resiliencia/disjuntor.ts`   | `resiliencia.test.ts`                                                  |
| RNF06 camadas, inversão de dependência e injeção explícita                                       | `application/ports`, `container.ts`                                     | `barramento-container.test.ts`                                         |
| RNF07 eventos em memória substituíveis por fila                                                  | porta `Sujeito`, `barramento-eventos-memoria.ts`                        | `demonstracao-observer.test.ts`                                        |
| RNF08 Node LTS, TypeScript estrito, Fastify, PostgreSQL, TypeORM                                 | `package.json`, `tsconfig.json`                                         | CI                                                                     |
| RNF09 testes por padrão e cobertura acima de 80%                                                 | `tests/`                                                                | `npm run coverage` (99,2%)                                             |
| RNF10 Windows 10+ e Ubuntu 24.04+                                                                | scripts sem bash, `.gitattributes`                                      | CI em `ubuntu-24.04` e `windows-latest`                                |

## Desempenho

| Cenário (POST /projetos, 6 papéis, 10 mil profissionais) | Resultado                                    |
| -------------------------------------------------------- | -------------------------------------------- |
| Requisição isolada                                       | 0,27 s                                       |
| 100 requisições simultâneas                              | todas abaixo de 2 s (máximo 1,81 s), 0 erros |
| 100 conexões contínuas por 30 s                          | 87 req/s, p99 1,76 s, 0 erros                |

Metodologia, as otimizações medidas e a precisão de cada estratégia estão em
[docs/desempenho.md](docs/desempenho.md).

---

## Refinamentos do diagrama

O diagrama da atividade era ponto de partida. As correções feitas no código:

| Problema no diagrama                                                                                                     | Correção                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Faltavam as entidades `Recomendacao` e `Convite`, citadas no enunciado                                                   | Criadas, com `StatusConvite` (pendente, aceito, recusado, expirado, cancelado)                                          |
| `Projeto` sem tipo de captação, localização e peso por papel                                                             | `tipoCaptacao`, `localizacao`, `estrategia` e `RequisitoPapel { papel, peso }`                                          |
| `Profissional` sem especialidades, faixa de preço, histórico e localização; `VetorCompetencia` e `Intervalo` indefinidos | Atributos e value objects criados                                                                                       |
| Visitor sem `aceitar()` — sem double dispatch                                                                            | Interface `Visitavel` em Projeto, Equipe, MembroEquipe e Profissional; `VisitanteProjeto<R>` genérico no lugar de `any` |
| Visitor só visitava projeto e profissional                                                                               | `visitarEquipe` e `visitarMembro`, os níveis reais da árvore                                                            |
| Strategy devolvia só a lista de profissionais                                                                            | `CandidatoRanqueado { score, custoEstimado, justificativa }` e `ParametrosRecomendacao`                                 |
| Template Method com uma subclasse e sem a etapa de busca                                                                 | Etapas completas, `OrquestradorSubstituicao` e fluxo protegido contra sobrescrita                                       |
| Subject embutido em `SistemaRecomendacao` e `EventoRecomendacao` genérico (`dados: Map`)                                 | Porta `Sujeito` implementada com EventEmitter; eventos como união tipada                                                |
| Faltavam os observadores de fluxo do enunciado                                                                           | `AtualizadorComposicao` (recusa gera nova rodada) e `PublicadorIntegracao`                                              |
| Projeto → Equipe 1:1, mas o enunciado pede uma ou mais sugestões                                                         | 1 → 0..*, com status da equipe e descarte das sugestões antigas                                                         |
| Classes dependiam de repositórios concretos                                                                              | Portas (`RepositorioProfissionais`, `RepositorioProjetos`, canais de saída) e adaptadores                               |
