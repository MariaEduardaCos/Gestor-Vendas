---
title: 'Story 1.1: Inicialização do Monorepo, Sessão Operacional e Isolamento Multi-inquilino'
type: 'feature'
created: '2026-11-10'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-consultorasync-2026-11-10/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-consultorasync-2026-11-10/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A operação do ConsultoraSync não possui infraestrutura inicial nem isolamento multi-inquilino, permitindo risco de vazamento de dados de clientes, vendas e estoque entre operações distintas, além de ausência de rastreabilidade de quem executa cada ação.

**Approach:** Inicializar a estrutura monorepo TypeScript com três pacotes (`core`, `server`, `web`) usando `npm workspaces`, estabelecendo backend Fastify 5, frontend React 19 com Vite e Tailwind CSS, e persistência SQLite com Prisma ORM estritamente vinculada a `operacao_id` e middleware de sessão com identificação nominal de `operador_id` e `operador_nome`.

**Decisions:**
- Stack Backend & Frontend: Fastify 5 + Prisma ORM / SQLite (`better-sqlite3`) no backend e React 19 / Vite no frontend com Tailwind CSS (tokens do `DESIGN.md`), alinhado ao `ARCHITECTURE-SPINE.md`.
- Gerenciador de Pacotes: `npm workspaces` (nativo do Node.js v22).

## Boundaries & Constraints

**Always:**
- Toda query, mutação e modelo persistido deve filtrar e associar obrigatoriamente `operacao_id`.
- Toda resposta de mutação e registro auditável deve conter `operador_id`, `operador_nome` e timestamp ISO-8601 UTC (NFR-003).
- O pacote `packages/core` deve ser puro, agnóstico a banco de dados e frameworks HTTP.
- Valores monetários representados estritamente em centavos inteiros (`INTEGER`).

**Never:**
- Não permitir requisições sem contexto de operação em rotas operacionais (rejeitar com 401/403).
- Não expor dados de outras operações sob nenhuma circunstância, mesmo conhecendo identificadores primários (FR-002).
- Não utilizar números decimais (float/double) para moedas ou preços.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Login de operador válido | Credenciais de operador + `operacao_id` | Sessão autenticada retornando token/cookie com `operacao_id`, `operador_id`, `operador_nome` | N/A |
| Tentativa de acesso sem sessão | Requisição em rota protegida sem credenciais | 401 Unauthorized com payload de erro padronizado | Retorna código `UNAUTHORIZED` |
| Tentativa de acesso cruzado entre operações | Sessão de `operacao_A` tentando consultar recurso da `operacao_B` por ID | 404 Not Found (ou 403 Forbidden) garantindo isolamento total | Dados de `operacao_B` nunca retornam |
| Mutação de dados por operador nominal | Transação confirmada por "Dona Sônia" | Registro salvo no banco e retornado na API contendo `operador_id`, `operador_nome` e timestamp UTC | N/A |

</frozen-after-approval>

## Code Map

- `package.json` -- Raiz do monorepo definindo workspaces (`packages/*`) e scripts unificados de build/teste.
- `tsconfig.base.json` -- Configurações compartilhadas de TypeScript estrito para todos os pacotes.
- `packages/core/package.json` -- Pacote do núcleo de domínio puro (entidades, tipos de sessão e tipos de erro).
- `packages/core/src/index.ts` -- Exportações de domínio (`Operacao`, `Operador`, value objects).
- `packages/server/package.json` -- Backend Fastify 5 com Prisma Client e SQLite.
- `packages/server/prisma/schema.prisma` -- Modelos de dados com campo mandatório `operacao_id`.
- `packages/server/src/plugins/session.ts` -- Plugin Fastify para injeção e validação do contexto `operacao_id` e `operador`.
- `packages/server/src/routes/auth.ts` -- Rotas de login e verificação de sessão operacional.
- `packages/server/src/db/tenant-prisma.ts` -- Extensão cliente do Prisma com injeção automática de `operacao_id`.
- `packages/server/tests/isolation.test.ts` -- Testes de integração validando a barreira multi-inquilino.
- `packages/web/package.json` -- Frontend React 19 + Vite com Tailwind CSS.
- `packages/web/tailwind.config.ts` -- Configuração dos design tokens de cores acolhedoras e contraste 10:1 (`DESIGN.md`).

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` e `tsconfig.base.json` -- Configurar monorepo e referências TypeScript -- Estabelecer a fundação do monorepo.
- [ ] `packages/core` -- Criar entidades e tipos puros de `Operacao`, `Operador` e `Sessao` -- Isolar regras de negócio.
- [ ] `packages/server/prisma/schema.prisma` -- Modelar `Operacao`, `Operador` e `RegistroAuditoria` em SQLite -- Suporte ao banco relacional local.
- [ ] `packages/server/src/db/tenant-prisma.ts` -- Criar middleware/extensão Prisma para filtro mandatório por `operacao_id` -- Garantir barreira multi-inquilino (NFR-002).
- [ ] `packages/server/src/plugins/session.ts` -- Criar middleware Fastify para extrair e validar `operacao_id` e `operador` -- Segurança de sessão (FR-001).
- [ ] `packages/server/src/routes/auth.ts` -- Implementar endpoints de login e validação de sessão -- Autenticação operacional.
- [ ] `packages/server/tests/isolation.test.ts` -- Escrever testes automatizados de tentativa de vazamento entre tenants -- Validar aceitação da história.
- [ ] `packages/web` -- Configurar scaffold Vite + React + Tailwind com design tokens do `DESIGN.md` -- Fundação da interface.

**Acceptance Criteria:**
- Given o monorepo TypeScript inicializado (`packages/core`, `packages/server` com Fastify e Prisma/SQLite, `packages/web` com Vite/React/Tailwind e tokens de `DESIGN.md`), when um usuário realiza login com suas credenciais de operador, then uma sessão segura com `operacao_id`, `operador_id` e `operador_nome` é estabelecida, and todas as consultas e mutações ao banco aplicam filtro estrito por `operacao_id`, impedindo acesso a dados de outra operação mesmo que os IDs sejam conhecidos (FR-001, FR-002, AD-1, NFR-002).
- Given uma usuária autenticada como "Dona Sônia", when qualquer registro ou transação for confirmado no sistema, then a resposta e o registro no banco incluem `operador_id` e `operador_nome` com timestamp ISO-8601 UTC (NFR-003).

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

A extensão do Prisma Client atuará interceptando as operações (`$extends({ query: ... })`) para injetar automaticamente `where: { operacao_id }` em leituras e mutações, assegurando que o desenvolvedor não precise confiar apenas na disciplina manual de filtros.
