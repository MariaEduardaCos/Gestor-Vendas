# Spec 4.4: Cancelamento com Liberação de Reserva e Ajuste Justificado de Inventário

**Epic:** Epic 4 - Atendimento de Vendas, Reservas e Saída Física na Entrega  
**Story:** 4.4  
**Status:** In-Progress  
**Author:** AI Agent (Pair Programming)  
**Date:** 2026-11-11  

---

## 1. Contexto e Objetivos

Mudanças de planos ocorrem com frequência na rotina de revenda: clientes podem desistir de produtos já reservados ou a revendedora pode encontrar divergências físicas no armário (avaria, quebra, doação, perda ou recontagem).  

Dois mecanismos essenciais são requeridos para garantir a fidelidade do estoque e proteger compromissos já assumidos:
1. **Cancelamento de item reservado:** Se a cliente desistir de um produto que estava reservado na estante, a reserva é liquidada e a unidade é transferida imediatamente para a `ProntaEntrega` disponível, mantendo o total de produtos físicos em casa (`presentes`) rigorosamente inalterado ($Presentes = Reservados + ProntaEntrega$). O valor da conta é reajustado.
2. **Ajuste de inventário com trava de segurança:** A revendedora pode corrigir a contagem física do armário informando uma justificativa obrigatória. Contudo, o sistema proíbe categoricamente reduzir o número de itens presentes para um valor inferior às reservas nominais ativas de clientes (`nova_contagem < reservados`), impedindo que compromissos assumidos fiquem desprovidos de lastro físico sem desvinculação prévia (FR-030, Refinamento Elicitação, AD-3).

---

## 2. Requisitos Funcionais e Não-Funcionais

- **FR-029 & D-09:** Cancelamento de itens com liberação de reserva física para pronta-entrega e conservação de presentes.
- **FR-030:** Ajuste justificado de contagem física com trava impeditiva de redução abaixo de reservas ativas e histórico preservado.
- **AD-3:** Invariante universal de estoque $Presentes = Reservados + ProntaEntrega$.
- **NFR-001:** Atomicidade transacional em SQLite via `$transaction`.
- **NFR-003:** Auditoria nominal com operador (`operador_id`, `operador_nome`), justificativa e timestamp UTC.

---

## 3. Critérios de Aceitação

1. **Cancelamento com Liberação de Reserva:**
   - **Given** um item reservado para cliente (`status_entrega == 'RESERVADO_PRESENTE'`),
   - **When** a revendedora cancela o item informando o motivo,
   - **Then** `reservados` diminui pelo valor cancelado, `pronta_entrega` aumenta na mesma proporção e `presentes` permanece rigorosamente inalterado,
   - **And** o status do item passa para `CANCELADO`,
   - **And** o valor total da conta é reduzido, gerando evento de auditoria para tratamento financeiro se já houver pagamentos.

2. **Bloqueio de Redução Abaixo de Reservas Ativas:**
   - **Given** um produto com `presentes: 2` e `reservados: 2`,
   - **When** a revendedora tenta ajustar a contagem física para `1` unidade,
   - **Then** o sistema recusa a operação com HTTP 400 (`AJUSTE_ABAIXO_DE_RESERVAS`) e mensagem explicativa clara, sem alterar o estoque.

3. **Ajuste Justificado Válido:**
   - **Given** um produto com `presentes: 4` e `reservados: 1` (`pronta_entrega: 3`),
   - **When** a revendedora ajusta a contagem física para `2` com justificativa "Frascos quebrados no transporte",
   - **Then** a contagem é atualizada para `presentes: 2`, `reservados: 1`, `pronta_entrega: 1`,
   - **And** gera movimentação `AJUSTE_BALANCO` com a justificativa gravada e operador nominal registrado.

---

## 4. Plano de Implementação

1. **Server Routes (`packages/server/src/routes/vendas.ts` e `estoque.ts`):**
   - `POST /api/contas/:id/itens/:itemId/cancelar` (em `vendas.ts`)
   - `POST /api/estoque/:produtoId/ajuste` (em `estoque.ts`)
2. **Testes de Integração (`packages/server/tests/cancelamento-ajuste-estoque.test.ts`):**
   - Cancelamento com liberação de reserva para pronta-entrega.
   - Tentativa bloqueada de redução abaixo de reservas ativas.
   - Ajuste de inventário com justificativa e movimentação de balanço.
   - Isolamento multi-inquilino.
3. **Frontend:**
   - Atualizar `ClienteFichaModal.tsx` com botão de cancelamento de item.
   - Atualizar `EstoqueInicialModal.tsx` / `ProdutosView.tsx` com suporte ao ajuste justificado de inventário.
