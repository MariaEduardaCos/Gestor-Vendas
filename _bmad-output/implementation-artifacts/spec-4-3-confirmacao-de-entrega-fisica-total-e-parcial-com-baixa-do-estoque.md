# Spec 4.3: Confirmação de Entrega Física (Total e Parcial) com Baixa do Estoque

**Epic:** Epic 4 - Atendimento de Vendas, Reservas e Saída Física na Entrega  
**Story:** 4.3  
**Status:** In-Progress  
**Author:** AI Agent (Pair Programming)  
**Date:** 2026-11-11  

---

## 1. Contexto e Objetivos

No comércio direto, a revendedora frequentemente separa os produtos encomendados ou vendidos de pronta-entrega em sacolas identificadas com o nome de cada cliente enquanto aguarda a retirada ou realiza a visita de entrega.  

Durante o período em que os produtos estão na sacola aguardando a cliente, eles estão **fisicamente presentes** na casa da revendedora e **reservados**. O estoque não pode sofrer baixa física antecipada, pois se a cliente cancelar ou se a entrega ainda não tiver ocorrido, os frascos ainda estão lá.  

A baixa física do estoque (`presentes -= qtd`, `reservados -= qtd`) deve ocorrer **apenas e exclusivamente no momento em que a sacola é entregue na mão da cliente**.  
Além disso, quando uma cliente encomendou vários produtos e apenas alguns chegaram da fábrica (ou estão disponíveis), a revendedora deve poder entregar parcialmente os produtos disponíveis, mantendo os demais como `AGUARDANDO_FABRICA` e a conta no status `PARCIALMENTE_ENTREGUE` (FR-028, FR-031).  

---

## 2. Requisitos Funcionais e Diretrizes

- **FR-027 & AD-3:** Confirmação de entrega física ao cliente com baixa real de produtos presentes e liquidação da reserva nominal (`presentes -= qtd`, `reservados -= qtd`, `pronta_entrega` inalterado, satisfazendo $Presentes = Reservados + ProntaEntrega$).
- **FR-028 & FR-031:** Suporte a entregas parciais de itens disponíveis, mantendo os itens pendentes como `AGUARDANDO_FABRICA` e a situação da conta como `PARCIALMENTE_ENTREGUE`.
- **NFR-001:** Atomicidade transacional via Prisma `$transaction`.
- **NFR-003:** Auditoria com operador nominal (`operador_id`, `operador_nome`) e timestamp UTC.
- **UX-DR3 & UX-DR9:** Alvos de toque $\ge 48\text{px}$ na Ficha da Cliente (S2) e feedback imediato de entrega confirmada.

---

## 3. Critérios de Aceitação

1. **Entrega Física Total de Conta:**
   - **Given** uma conta com itens reservados (`Presentes: 2, Reservados: 2`),
   - **When** a revendedora confirma a entrega da conta,
   - **Then** o sistema debita os produtos presentes (`Presentes: 0, Reservados: 0`),
   - **And** o status de entrega de cada item passa a ser `ENTREGUE` e o status consolidado de entrega da conta passa a ser `ENTREGUE`, sem gerar saída física duplicada.

2. **Entrega Parcial de Itens Disponíveis:**
   - **Given** uma conta com 2 itens: Item 1 reservado (`RESERVADO_PRESENTE`) e Item 2 aguardando fábrica (`AGUARDANDO_FABRICA`),
   - **When** a revendedora confirma a entrega do Item 1,
   - **Then** o Item 1 tem seu estoque baixado (`presentes -= 1`, `reservados -= 1`) e status alterado para `ENTREGUE`,
   - **And** o Item 2 permanece rigorosamente como `AGUARDANDO_FABRICA`,
   - **And** a conta passa a exibir o status de entrega `PARCIALMENTE_ENTREGUE`.

3. **Proteção contra Baixa Duplicada:**
   - **Given** um item que já foi entregue (`status_entrega == 'ENTREGUE'`),
   - **When** houver nova tentativa de confirmar entrega para ele,
   - **Then** o sistema recusa a operação com HTTP 400 (`ITEM_JA_ENTREGUE`), sem debitar o estoque físico novamente.

4. **Proteção contra Entrega de Item que Não Chegou:**
   - **Given** um item com status `AGUARDANDO_FABRICA`,
   - **When** houver tentativa de entrega sem conferência de caixa prévia,
   - **Then** a requisição é recusada com HTTP 400 (`ITEM_NAO_DISPONIVEL_PARA_ENTREGA`).

---

## 4. Plano de Implementação

1. **Server Routes (`packages/server/src/routes/contas-entrega.ts` ou em `vendas.ts`):**
   - Rota `POST /api/contas/:id/itens/:itemId/entregar`
   - Rota `POST /api/contas/:id/entregar-disponiveis`
   - Rota `GET /api/contas/:id` (detalhes da conta com status de entrega consolidado)
2. **Testes de Integração (`packages/server/tests/entrega-fisica.test.ts`):**
   - Validação de entrega total, entrega parcial, recusa de baixa duplicada e conservação estrita de estoque (AD-3).
3. **Frontend (`ClienteFichaModal.tsx`):**
   - Exibir botões "Entregar Item" e "Entregar Disponíveis" com feedback visual e atualização imediata.
