# Spec 3.3: Recebimento Parcial e Tratamento de Falta da Fábrica com Ajuste Contábil

## Frontmatter
- **Story:** 3.3
- **Epic:** 3 - Conferência de Caixa da Fábrica, Destinação Obrigatória e Conservação do Estoque
- **FRs:** FR-021 (Recebimento Parcial), FR-024 (Tratamento de Falta da Fábrica e Emissão de Obrigação Contábil)
- **Invariantes e Diretrizes:** AD-3 (Conservação de Estoque: frasco que não chegou não entra em estoque e não sofre baixa), AD-5 (Ajuste de Conta e Tratamento de Excedente), AD-7 (Idempotência Mandatória com UUID v4), NFR-001, NFR-003, NFR-010.

---

## 1. Contexto e Problema
Na rotina de vendas diretas, é comum que caixas de encomendas venham da fábrica com faltas (rupturas de estoque da marca, produtos esgotados no ciclo).
A revendedora precisa:
1. Conferir entregas parciais mantendo os saldos restantes aguardando faturamento futuro.
2. Quando a marca comunica que determinado frasco não será mais entregue (falta definitiva), cancelar a pendência da fábrica sem dar falsa baixa em estoque físico (já que o frasco nunca existiu na estante).
3. Ajustar a conta da cliente que encomendou aquele frasco (`ItemConta` cancelado por falta da fábrica), reduzindo o saldo a pagar da conta.
4. Caso a conta já tenha sido total ou parcialmente quitada, registrar obrigação contábil de estorno ou geração de crédito (AD-5, FR-024).

---

## 2. Critérios de Aceitação
1. **Recebimento Parcial Confiável (FR-021):**
   - Ao receber 2 de 3 unidades, o estoque físico computa exatamente 2 unidades (`Presentes = Reservados + ProntaEntrega`), e o pedido permanece em `CONFERENCIA_EM_ANDAMENTO` com 1 pendente.
   - Posterior conferência de 1 unidade conclui a conferência (`CONFERIDA`) sem duplicar as 2 anteriores.
2. **Cancelamento por Falta da Fábrica (FR-024):**
   - Rota `POST /api/compras-marca/:id/falta-fabrica`:
     - Recebe `item_compra_id`, `quantidade_em_falta`, `motivo`, e `idempotency_key`.
     - Rejeita quantidade de falta superior à pendência atual do item.
     - Ajusta a pendência do item de compra registrando a falta definitiva.
     - Se o item era de cliente, atualiza `ItemConta.status_entrega = 'CANCELADO_FALTA'` e deduz o valor do item no total da conta da cliente.
     - Se o valor pago da conta ultrapassar o novo valor total, calcula o excedente e emite obrigação contábil auditada.
     - Se todos os itens da compra forem recebidos ou cancelados por falta, atualiza a compra para `CONFERIDA`.
3. **Idempotência (AD-7):**
   - Mesma chave de idempotência retransmitida não duplica cancelamentos nem recalcula contas novamente.

---

## 3. Plano de Implementação
1. **Backend (`packages/server/src/routes/compras.ts`):**
   - Implementar rota `POST /api/compras-marca/:id/falta-fabrica`.
2. **Testes de Integração (`packages/server/tests/conferencia-caixa.test.ts`):**
   - Adicionar cenários completos de falta da fábrica, ajuste de conta de cliente e emissão de obrigação contábil.
3. **Frontend (`packages/web/src/components/ConferenciaCaixaModal.tsx`):**
   - Adicionar botão de registrar falta da fábrica em itens pendentes com modal de confirmação.
