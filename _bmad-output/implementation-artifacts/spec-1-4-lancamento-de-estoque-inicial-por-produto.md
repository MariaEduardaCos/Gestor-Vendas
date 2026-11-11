---
title: 'Story 1.4: Lançamento de Estoque Inicial por Produto'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: 'bc7ea2c6ce36dd9f7f25af2254dd2b74e999629a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-1-context.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-consultorasync-2026-11-10/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-consultorasync-2026-11-10/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-consultorasync-2026-11-10/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Ao começar a utilizar o sistema, a revendedora já possui produtos físicos em sua estante que precisam ser contabilizados como disponíveis para pronta-entrega, sem gerar cobranças ou registros de compras fictícias junto às marcas.

**Approach:** Criar as entidades de domínio `EstoqueItem` e `MovimentacaoEstoque` no `@consultorasync/core` aplicando a regra estrita de conservação de estoque (`Presentes = Reservados + ProntaEntrega`), implementar as tabelas no SQLite com Prisma e endpoints REST `/api/estoque` no `@consultorasync/server` com auditoria nominal e sem vínculo com compras, e disponibilizar o modal de contagem inicial e pílulas de quantidade no `@consultorasync/web`.

## Boundaries & Constraints

**Always:**
- Todo registro de estoque e movimentação é restrito à `operacao_id` ativa da sessão.
- A regra de conservação de estoque deve ser respeitada em qualquer estado: `Presentes = Reservados + ProntaEntrega` (AD-3).
- O lançamento de estoque inicial define `Presentes = X`, `ProntaEntrega = X` e `Reservados = 0` (onde X é a contagem inicial positiva).
- A movimentação de estoque registra tipo `ESTOQUE_INICIAL` sem vínculo a pedidos de compra à fábrica (`compra_id = null`) (FR-013).
- Quantidades de estoque são números inteiros estritamente não negativos (rejeitando decimais e números negativos) (NFR-001).
- Toda confirmação de estoque inicial registra auditoria nominal com `operador_id`, `operador_nome` e timestamp ISO-8601 UTC (NFR-003).

**Never:**
- Nunca permitir que `Presentes` seja menor do que `Reservados`.
- Nunca gerar pedido de compra ou obrigação financeira à marca durante o estoque inicial.
- Nunca aceitar quantidades não inteiras (ex: 1.5) ou negativas (ex: -2).
- Nunca permitir que uma operação acesse ou altere o estoque de outra operação.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Lançamento de estoque inicial válido | Produto existente, quantidade inteira = 5 | Estoque criado/atualizado com `presentes: 5`, `pronta_entrega: 5`, `reservados: 0`. Movimentação `ESTOQUE_INICIAL` registrada | N/A |
| Tentativa com quantidade negativa | Quantidade = -2 | Operação recusada com validação explícita de quantidade inteira | Retorna 400 Bad Request RFC 7807 |
| Tentativa com quantidade decimal | Quantidade = 1.5 | Operação recusada exigindo número inteiro | Retorna 400 Bad Request RFC 7807 |
| Consulta de extrato do produto | Produto com estoque inicial lançado | Extrato lista movimentação `ESTOQUE_INICIAL` com operador, data UTC e sem vínculo de compra | N/A |
| Tentativa de lançar estoque em produto de outro tenant | Operação B tenta lançar estoque no `produto_id` da Operação A | 404 Not Found mantendo isolamento total | Retorna 404 Not Found RFC 7807 |

</frozen-after-approval>

## Code Map

- `packages/core/src/domain/estoque.ts` -- Entidades de domínio `EstoqueItem` e `MovimentacaoEstoque` com validação da invariante `Presentes = Reservados + ProntaEntrega`.
- `packages/core/src/index.ts` -- Exportações de tipos e entidades de estoque.
- `packages/server/prisma/schema.prisma` -- Models `EstoqueItem` e `MovimentacaoEstoque` com índices compostos por `[operacao_id, produto_id]`.
- `packages/server/src/routes/estoque.ts` -- Rotas REST (`POST /api/estoque/inicial`, `GET /api/estoque/:produtoId`, `GET /api/estoque`) com auditoria nominal.
- `packages/server/src/app.ts` -- Registro do plugin de estoque.
- `packages/server/tests/estoque.test.ts` -- Testes de integração automatizados cobrindo lançamento de 5 unidades, rejeição de -2 e 1.5, extrato sem compras e isolamento multi-inquilino.
- `packages/web/src/types/estoque.ts` -- Tipos TypeScript DTO de Estoque e Movimentação.
- `packages/web/src/components/EstoqueInicialModal.tsx` -- Modal com controles de incremento (+/- 48px) e explicação acolhedora para contagem de estante física.
- `packages/web/src/components/ProdutosView.tsx` -- Inclusão de pílulas de estoque (Presentes, Pronta-Entrega, Reservados) e gatilho para o modal de estoque inicial nos cartões de produto.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/domain/estoque.ts` -- Criar entidades puras `EstoqueItem` e `MovimentacaoEstoque` com a invariante `Presentes = Reservados + ProntaEntrega` -- Garantir conservação de estoque no core.
- [x] `packages/server/prisma/schema.prisma` -- Modelar tabelas `itens_estoque` e `movimentacoes_estoque` e aplicar `prisma db push` -- Persistência relacional SQLite.
- [x] `packages/server/src/routes/estoque.ts` -- Implementar endpoints REST `/api/estoque/inicial` e consultas de extrato com auditoria nominal -- API de estoque protegida.
- [x] `packages/server/tests/estoque.test.ts` -- Escrever suíte de testes cobrindo lançamento válido (5 unidades), rejeição de -2 e 1.5, e isolamento multi-inquilino -- Verificação automatizada.
- [x] `packages/web/src/components/EstoqueInicialModal.tsx` -- Criar componente de contagem física com controles numéricos acessíveis -- Atender ergonomia 40+.
- [x] `packages/web/src/components/ProdutosView.tsx` -- Integrar pílulas de contagem e botão de estoque inicial aos cartões de produto -- Experiência do usuário (UX-DR3).

**Acceptance Criteria:**
- Given um produto cadastrado no catálogo (com ou sem custo definido), when a revendedora informa a quantidade inicial física presente (ex: 5 unidades) e confirma o lançamento inicial, then o estoque físico registra 5 unidades como Presentes e 5 unidades como Pronta-Entrega (Reservadas = 0), satisfazendo a invariante Presentes = Reservados + ProntaEntrega (FR-013, AD-3).
- Given um lançamento de estoque inicial confirmado, when a revendedora consulta o extrato ou movimentações do produto, then a movimentação identifica tipo ESTOQUE_INICIAL, operador que confirmou e data UTC, sem gerar vínculo com pedido de compra à fábrica (FR-013, NFR-003).
- Given uma tentativa de lançar quantidade inicial negativa ou não inteira (ex: -2 ou 1.5), when a confirmação for submetida, then o sistema rejeita a operação com validação explícita de quantidade inteira positiva (NFR-001).

## Implementation Notes

- Implementadas entidades `EstoqueItem` e `MovimentacaoEstoque` em `@consultorasync/core/domain/estoque.ts` com validação estrita da regra de conservação de estoque `Presentes = Reservados + ProntaEntrega` (AD-3).
- Modeladas tabelas `itens_estoque` e `movimentacoes_estoque` no Prisma schema com índices por `[operacao_id, produto_id]` e unicidade por `[operacao_id, produto_id]`.
- Adicionada validação compulsória da invariante no middleware do repositório `tenant-prisma.ts`.
- Criados endpoints `POST /api/estoque/inicial`, `GET /api/estoque/:produtoId`, `GET /api/estoque/:produtoId/extrato` e `GET /api/estoque` com isolamento multi-inquilino, auditoria nominal (`LANCAR_ESTOQUE_INICIAL`) e tratamento de erros no padrão RFC 7807.
- Criada suíte de testes em `packages/server/tests/estoque.test.ts` cobrindo lançamento de 5 unidades, rejeição de -2 e 1.5, isolamento multi-inquilino, listagem de extrato sem compras e atualização de contagem.
- Desenvolvido modal ergonômico 48px `EstoqueInicialModal.tsx` com linguagem acolhedora e pílulas de estoque integradas em `ProdutosView.tsx`.

## Spec Change Log

## Review Triage Log

## Design Notes

A invariante `Presentes = Reservados + ProntaEntrega` é verificada tanto no construtor da entidade de domínio quanto no middleware do repositório antes de persistir, assegurando que nenhum fluxo de estoque possa quebrar a integridade física das unidades na estante da revendedora.
