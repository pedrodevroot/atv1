# CineBridge — Microsserviço de Recomendação e Orquestração de Equipes

Primeira etapa (ATV1) da plataforma CineBridge para produção audiovisual independente.

## Stack

| Item         | Escolha                                                      |
| ------------ | ------------------------------------------------------------ |
| Runtime      | Node.js LTS (>= 22.12), TypeScript strict, ESM               |
| HTTP         | Fastify 5 + TypeBox (validação e serialização por schema)    |
| Documentação | OpenAPI em `/docs` (`@fastify/swagger` + `swagger-ui`)       |
| Persistência | PostgreSQL 18 + TypeORM 1 (`EntitySchema`, domínio sem ORM)  |
| Testes       | Vitest (projetos `unit` e `integration`) + cobertura v8 ≥80% |
| Carga        | autocannon                                                   |
| Plataformas  | Windows 10+, Ubuntu 24.04.3+ e derivados (CI em ambos)       |

## Pré-requisitos

- Docker com Docker Compose v2
- Node.js 22.12+ (`.nvmrc`), apenas para desenvolvimento local

## Como rodar

Os comandos são os mesmos no Windows (PowerShell) e no Ubuntu.

### Tudo em Docker

```bash
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
npm run docker:up           # ou: docker compose up -d --build --wait
```

- API: http://localhost:3000/health e http://localhost:3000/docs
- PostgreSQL: `localhost:5434`

O container do microsserviço aplica as migrações antes de iniciar a API.

### Desenvolvimento local (API no host, banco no Docker)

```bash
npm ci
cp .env.example .env
npm run db:up
npm run migration:run
npm run seed
npm run dev
```

Se a stack completa estiver rodando, pare o container da API antes (`docker compose stop recomendacao`) para liberar a porta 3000.

## Docker e microsserviços

```
rede docker "cinebridge"
 ├── cinebridge-postgres        PostgreSQL 18 compartilhado (host: 5434)
 │    └── banco cinebridge_recomendacao  →  usuário recomendacao
 └── cinebridge-recomendacao    este microsserviço (host: 3000)
```

- **Um servidor PostgreSQL, um banco por microsserviço.** Cada serviço tem banco e usuário próprios, sem superusuário; nenhum serviço lê tabelas de outro. A integração entre serviços é feita por eventos.
- **Novo microsserviço:** adicionar um script em `docker/postgres/init/` criando seu banco e usuário e conectar o container à rede externa `cinebridge` (`networks: { cinebridge: { external: true } }`).
- Os scripts de `docker/postgres/init/` só rodam quando o volume é criado. Para recriar do zero: `npm run docker:reset` (apaga os dados).
- A imagem é multi-stage (`node:22-alpine`), contém só dependências de produção e roda como usuário `node`, com `HEALTHCHECK` em `/health`.

## Scripts

| Script                      | Descrição                                               |
| --------------------------- | ------------------------------------------------------- |
| `npm run dev`               | Servidor com recarga automática (tsx watch)             |
| `npm run build` / `start`   | Compila para `dist/` e executa a versão compilada       |
| `npm run lint`              | ESLint (inclui regra que proíbe comentários) + Prettier |
| `npm run typecheck`         | Verificação de tipos do código e dos testes             |
| `npm test`                  | Todos os testes                                         |
| `npm run test:unit`         | Testes unitários (não precisam de banco)                |
| `npm run test:int`          | Testes de integração (precisam do PostgreSQL)           |
| `npm run coverage`          | Todos os testes com cobertura mínima de 80%             |
| `npm run docker:up`         | Constrói a imagem e sobe PostgreSQL + microsserviço     |
| `npm run docker:down`       | Derruba a stack mantendo os dados                       |
| `npm run docker:logs`       | Acompanha os logs do microsserviço                      |
| `npm run docker:reset`      | Derruba a stack e apaga o volume do banco               |
| `npm run db:up` / `db:down` | Sobe/para apenas o PostgreSQL                           |
| `npm run migration:run`     | Aplica migrações pendentes                              |
| `npm run migration:revert`  | Reverte a última migração                               |
| `npm run seed`              | Popula o banco                                          |
| `npm run perf`              | Teste de carga (100 conexões; reprova se p99 ≥ 2 s)     |

O teste de carga aceita `PERF_URL`, `PERF_METODO`, `PERF_CORPO` (arquivo JSON), `PERF_CONEXOES`, `PERF_DURACAO` e `PERF_LIMITE_P99_MS`.

## Arquitetura

Camadas com inversão de dependência; a composição é explícita em `src/container.ts`.

```
src/
  domain/          entidades, value objects, eventos de domínio
  application/
    ports/         interfaces que a aplicação exige da infraestrutura
    use-cases/     casos de uso
    strategies/    padrão Strategy
    orchestration/ padrão Template Method
    observers/     padrão Observer
    visitors/      padrão Visitor
  infrastructure/  TypeORM, logging e adaptadores das portas
  api/             rotas Fastify, schemas TypeBox e tratamento de erros
  config/          configuração validada na inicialização
  container.ts     composition root
  app.ts           construção da aplicação Fastify
  server.ts        ponto de entrada
tests/ unit/ integration/ perf/
```

Paralelo com FastAPI:

| FastAPI             | Aqui                                           |
| ------------------- | ---------------------------------------------- |
| `APIRouter`         | plugin de rotas (`src/api/routes/*.routes.ts`) |
| Pydantic            | schemas TypeBox (`src/api/schemas`)            |
| `Depends()`         | composition root (`src/container.ts`)          |
| pydantic-settings   | `src/config/config.ts`                         |
| `uvicorn --reload`  | `npm run dev`                                  |
| pytest + TestClient | Vitest + `app.inject()`                        |
