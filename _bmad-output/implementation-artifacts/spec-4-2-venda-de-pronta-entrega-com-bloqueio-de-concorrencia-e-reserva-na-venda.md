# Spec 4.2: Venda de Pronta-Entrega com Bloqueio de Concorrência e Reserva na Venda

**Epic:** Epic 4 - Atendimento de Vendas, Reservas e Saída Física na Entrega  
**Story:** 4.2  
**Status:** In-Progress  
**Author:** AI Agent (Pair Programming)  
**Date:** 2026-11-11  

---

## 1. Contexto e Objetivos

A revendedora atende suas clientes no balcão físico ou via mensagens (WhatsApp/Instagram). Muitas clientes solicitam produtos que estão disponíveis a pronta-entrega, podendo retirá-los imediatamente ou agendar a retirada para momento posterior.  

Para evitar o problema crônico de "prometer o que não tem" ou vender o mesmo frasco físico simultaneamente para duas pessoas diferentes, a confirmação de venda de pronta-entrega com retirada posterior deve reservar imediatamente as unidades (`pronta_entrega -= qtd`, `reservados += qtd`), conservando a quantidade física em mãos (`presentes` inalterado, satisfazendo a invariante $Presentes = Reservados + ProntaEntrega$).  

Caso a cliente já leve o item no ato ("Entrega Imediata"), o sistema efetua atômica e simultaneamente a baixa física e de pronta-entrega (`pronta_entrega -= qtd`, `presentes -= qtd`), registrando o item na conta como `ENTREGUE`.  

Se o estoque disponível em pronta-entrega for insuficiente para atender a quantidade solicitada, o sistema deve recusar a operação atomicamente no nível da transação com status HTTP 400 (RFC 7807) e mensagem amigável: *"Você tem apenas X unidade(s) na pronta-entrega que acabou de ser reservada"*, garantindo que nenhuma conta órfã seja criada.

---

## 2. Requisitos Funcionais e Não-Funcionais

- **FR-026:** Registro de venda de pronta-entrega com reserva imediata na opção de retirada posterior e bloqueio de concorrência atômico para estoque insuficiente.
- **FR-027 / AD-3:** Suporte a "Entrega Imediata", onde a saída física ocorre em transação atômica única coerente ($Presentes = Reservados + ProntaEntrega$).
- **AD-7:** Proteção de concorrência e idempotência via `idempotency_key` (UUID v4).
- **NFR-001:** Atomicidade transacional em SQLite via `$transaction` Prisma com isolamento por sessão.
- **NFR-003:** Auditoria nominal com `operador_id`, `operador_nome` e timestamp UTC.
- **NFR-004:** Consistência imediata entre celulares e computadores conectados.
- **Superfície S8 & UX-DR3:** Modal de Nova Venda com indicação clara do estoque disponível e feedback imediato de erro em caso de concorrência.

---

## 3. Critérios de Aceitação

1. **Venda de Pronta-Entrega com Retirada Posterior:**
   - Seleção de produtos com `pronta_entrega >= qtd`.
   - Ao confirmar com `entrega_imediata = false`:
     - `EstoqueItem.pronta_entrega` diminui em `qtd`.
     - `EstoqueItem.reservados` aumenta em `qtd`.
     - `EstoqueItem.presentes` permanece rigorosamente inalterado ($Presentes = Reservados + ProntaEntrega$).
     - Gera registro em `MovimentacaoEstoque` com tipo `RESERVA`.
     - Cria `Conta` e `ItemConta` com `status_entrega = 'RESERVADO_PRESENTE'`.

2. **Venda com Entrega Imediata:**
   - Ao confirmar com `entrega_imediata = true`:
     - `EstoqueItem.pronta_entrega` diminui em `qtd`.
     - `EstoqueItem.presentes` diminui em `qtd`.
     - `EstoqueItem.reservados` permanece inalterado ($Presentes = Reservados + ProntaEntrega$).
     - Gera registro em `MovimentacaoEstoque` com tipo `SAIDA_VENDA`.
     - Cria `Conta` e `ItemConta` com `status_entrega = 'ENTREGUE'`.

3. **Bloqueio Atômico de Concorrência e Estoque Insuficiente:**
   - Se duas requisições tentarem vender a mesma última unidade de pronta-entrega simultaneamente, apenas uma obtém sucesso. A requisição concorrente falha com HTTP 400 (`ESTOQUE_INSUFICIENTE_PRONTA_ENTREGA`) e mensagem amigável, sem criar contas ou itens órfãos.

4. **Idempotência:**
   - Reenvio de requisição com a mesma `idempotency_key` retorna a venda já confirmada sem decrementar o estoque novamente ou duplicar a conta.

---

## 4. Plano de Implementação

1. **Core Domain (`packages/core/src/domain/estoque.ts`):**
   - Implementar métodos de negócio no `EstoqueItem`:
     - `reservarProntaEntrega(quantidade: number)`
     - `efetuarSaidaImediata(quantidade: number)`
     - `confirmarEntregaFisica(quantidade: number)`
     - `cancelarReserva(quantidade: number)`
     - `ajustarContagemFisica(novaContagem: number, justificativa: string)`

2. **Server API (`packages/server/src/routes/vendas.ts`):**
   - Criar rota `POST /api/vendas` atendendo à especificação.
   - Registrar no Fastify Server (`packages/server/src/server.ts`).

3. **Testes de Integração (`packages/server/tests/vendas-pronta-entrega.test.ts`):**
   - 6 testes cobrindo retirada posterior, entrega imediata, recusa atômica por concorrência/falta, idempotência e isolamento multi-inquilino.

4. **Frontend (`packages/web/src/components/VendaModal.tsx` e `App.tsx`):**
   - Modal de Nova Venda com seleção de cliente, busca rápida de produto, validação em tempo real de pronta-entrega, checkbox de entrega imediata e feedback de erro amigável.
