---
title: 'Story 2.2: Consolidação da Compra à Marca e Separação entre Clientes e Pronta-Entrega'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '346bbb5'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-consultorasync-2026-11-10/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-consultorasync-2026-11-10/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-consultorasync-2026-11-10/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A revendedora multimarcas anota encomendas de várias clientes ao longo do ciclo (ex: Ana pediu 1 Hidratante Tododia Algodão, Bia pediu 1 Hidratante Tododia Algodão). No momento de passar o pedido no site ou aplicativo da marca (ex: Natura), ela precisa digitar as quantidades consolidadas (2 hidratantes) e frequentemente deseja adicionar unidades extras para sua pronta-entrega (ex: +1 hidratante para ter no armário). Sem uma ferramenta de consolidação, a revendedora soma no rascunho de papel e perde a informação de a quem pertencia cada unidade quando a caixa chega, correndo o risco de vender itens encomendados como se fossem pronta-entrega.

**Approach:** Criar a entidade e o fluxo de `CompraMarca` que agrupa itens de encomendas pendentes de envio (`AGUARDANDO_FABRICA`) de diferentes clientes junto com itens adicionais para pronta-entrega. O sistema gera automaticamente o **Espelho do Pedido da Marca** (quantidade total de cada produto para digitação no site da marca) e, ao mesmo tempo, preserva o **Vínculo Nominal Estrito** de cada unidade (ex: 1 Ana, 1 Bia, 1 Pronta-Entrega) para conferência posterior na chegada da caixa (FR-015, FR-017, FR-018, AD-3). O status inicial é `PEDIDO_REGISTRADO`, deixando explícito na interface que o sistema local não transmite dados para o portal da fábrica.

## Boundaries & Constraints

**Always:**
- Toda `CompraMarca` pertence compulsoriamente a uma `operacao_id` e a uma `marca_id` válida (AD-1, FR-017).
- Cada item da compra registra sua destinação explícita: `CLIENTE` (vinculado a `cliente_id`, `encomenda_id`, `item_conta_id`) ou `PRONTA_ENTREGA` (FR-018).
- O sistema gera a visão consolidada do espelho do pedido somando as quantidades por `produto_id` para conferência com a revista/site (FR-017).
- A criação da compra recebe o status inicial `PEDIDO_REGISTRADO` e grava auditoria nominal do operador (`operador_id`, `operador_nome`, timestamp ISO-8601 UTC) (NFR-003).
- O estoque físico de `Presentes` e `ProntaEntrega` permanece inalterado na criação do pedido (AD-3: entrada física ocorre somente na conferência da caixa).

**Never:**
- Nunca misturar itens de marcas diferentes na mesma compra (uma compra à Natura consolida apenas produtos Natura) (FR-017).
- Nunca afirmar ou induzir a usuária a acreditar que o registro no ConsultoraSync envia automaticamente o pedido para a fábrica (FR-017).
- Nunca perder o vínculo nominal do cliente que encomendou ao consolidar a soma dos itens (FR-018).
- Nunca adicionar unidades a `Presentes` ou `ProntaEntrega` no momento do registro da compra (AD-3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Consolidação de encomendas + pronta-entrega | Encomenda da Ana (1 un Prod A), Encomenda da Bia (1 un Prod A) + 1 un Prod A para pronta-entrega | Cria CompraMarca com 3 unidades no total do espelho do Prod A, com 3 vínculos nominais detalhados (Ana, Bia, Pronta-Entrega) | Valida que todos os produtos pertencem à marca da compra |
| Compra exclusivamente para pronta-entrega | Revendedora pede 5 batons apenas para estoque sem clientes associadas | Cria CompraMarca onde todos os itens possuem destinação `PRONTA_ENTREGA` | Valida quantidades positivas inteiras |
| Compra exclusivamente de encomendas | Revendedora agrupa apenas pedidos de clientes sem itens extras | Cria CompraMarca com destinações nominais `CLIENTE`, status `PEDIDO_REGISTRADO` | Rejeita se nenhuma encomenda/item for selecionado |
| Tentativa de misturar produtos de outra marca | Compra da marca "Natura" incluindo produto da "Avon" | Rejeita a operação com erro RFC 7807 400 (`MARCA_INCOMPATIVEL`) | Retorna mensagem clara de produto de outra marca |
| Isolamento multi-inquilino | Operador B tenta incluir encomenda ou produto da Operação A | Retorna erro 404 (`NAO_ENCONTRADO`) via TenantPrismaClient | Garante isolamento estrito entre operações |

</frozen-after-approval>

## Code Map

- `packages/core/src/domain/compra-marca.ts` -- Entidades de domínio puro `CompraMarca`, `ItemCompraMarca`, DTO do espelho consolidado e regras de agrupamento por produto.
- `packages/core/src/index.ts` -- Re-exportação dos tipos e regras de CompraMarca.
- `packages/core/tests/compra-marca.test.ts` -- Testes unitários validando cálculo do espelho, preservação de vínculos nominais e rejeição de itens inválidos.
- `packages/server/prisma/schema.prisma` -- Modelos `CompraMarca` e `ItemCompraMarca` com relacionamentos com `Operacao`, `Marca`, `Produto`, `Cliente`, `Encomenda` e `ItemConta`.
- `packages/server/src/routes/compras.ts` -- Endpoints HTTP (`POST /api/compras-marca`, `GET /api/compras-marca`, `GET /api/compras-marca/:id`, `GET /api/compras-marca/pendencias`).
- `packages/server/tests/compras-marca.test.ts` -- Testes de integração cobrindo criação consolidada, geração do espelho, vínculos nominais, auditoria nominal e isolamento de tenant.
- `packages/web/src/components/CompraMarcaModal.tsx` -- Modal de criação e consolidação do pedido à marca com seleção de marca, importação de encomendas pendentes e inclusão de pronta-entrega.
- `packages/web/src/components/ComprasView.tsx` -- Visualização das compras registradas e espelho do pedido.
- `packages/web/src/App.tsx` -- Integração da navegação e atalhos operacionais de Compras à Marca.

## Tasks & Acceptance

**Execution:**
- [ ] `packages/core/src/domain/compra-marca.ts` e testes -- Criar modelos de domínio puro para `CompraMarca`, `ItemCompraMarca` e consolidação de espelho por produto (FR-017, FR-018).
- [ ] `packages/server/prisma/schema.prisma` -- Modelar `CompraMarca` e `ItemCompraMarca` com migração `prisma db push`.
- [ ] `packages/server/src/routes/compras.ts` -- Implementar endpoints REST para registro da compra consolidada, espelho e consulta de encomendas pendentes.
- [ ] `packages/server/tests/compras-marca.test.ts` -- Criar testes de integração validando consolidação, espelho, vínculos nominais, auditoria e isolamento multi-inquilino.
- [ ] `packages/web/src/components/CompraMarcaModal.tsx` -- Desenvolver interface acolhedora para consolidação com alvos $\ge 48\text{px}$ e aviso explícito de registro local.
- [ ] `packages/web/src/App.tsx` -- Conectar o fluxo no frontend.

**Acceptance Criteria:**
- Given que existem encomendas pendentes de envio de diferentes clientes, when a revendedora cria uma `CompraMarca` e adiciona itens extras para pronta-entrega, then o sistema gera o espelho do pedido da marca consolidado por produto, and preserva o vínculo nominal estrito de cada item (FR-015, FR-017, FR-018).
- Given a compra registrada no sistema, when a revendedora salva o registro, then a compra recebe o status `PEDIDO_REGISTRADO`, and a interface deixa explícito que o registro local não envia à fábrica (FR-017).

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes
