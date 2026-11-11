---
title: 'Story 3.1: Abertura da Conferência de Caixa e Leitura com Idempotência'
type: 'feature'
created: '2026-11-11'
status: 'ready-for-dev'
baseline_commit: '20e0b6d'
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

**Problem:** Quando a caixa de papelão da fabricante chega pelo correio/transportadora, a revendedora precisa abrir e conferir os produtos recebidos na sua mesa de trabalho. Essa operação é sujeita a quedas de Wi-Fi ou instabilidades de dados móveis no celular. Se uma requisição de conferência for retransmitida pela rede após uma desconexão temporária, um sistema sem idempotência computaria as quantidades em duplicidade, inflando falsamente o estoque físico da revendedora e violando a contabilidade (FR-020, AD-7, NFR-001, NFR-008). Além disso, o sistema deve impedir a confirmação de quantidades negativas ou excedentes ao que foi pedido sem ajuste prévio.

**Approach:** Criar o fluxo de conferência de caixa para compras à marca (`CompraMarca`). Ao abrir a conferência (tela S5), o sistema exibe o visor de leitura na metade superior e a lista de itens esperados e quantidades editáveis na metade inferior (FR-020, UX-DR2). O envio da confirmação de conferência (`POST /api/compras-marca/:id/conferencia`) exige obrigatoriamente uma chave `idempotency_key` (UUID v4) gerada pelo cliente no cabeçalho `Idempotency-Key` ou no corpo da requisição. Caso uma mesma chave seja retransmitida para a mesma operação, o backend intercepta e retorna a resposta original previamente persistida em `registros_idempotencia`, sem reprocessar mutações nem duplicar entradas de estoque (AD-7). Validações rígidas impedem quantidades negativas ou excedentes à quantidade comprada.

## Boundaries & Constraints

- `AD-7`: Idempotência estrita por `operacao_id` + `idempotency_key`. Retransmissões retornam o resultado original idempotente.
- `AD-3`: Conservação de estoque físico ($Presentes = Reservados + ProntaEntrega$). A entrada física ocorre no ato da conferência confirmada.
- `AD-1 & NFR-002`: Isolamento multi-inquilino compulsoriamente garantido via `TenantPrismaClient`.
- `NFR-003`: Registro de auditoria nominal com `operador_id`, `operador_nome` e timestamp ISO-8601 UTC.
- `FR-020`: Rejeição imediata de quantidades negativas ou superiores ao saldo pendente de entrega do pedido (retornando erro RFC 7807 `EXCEDENTE_NAO_PERMITIDO` ou `QUANTIDADE_INVALIDA`).

## Verification Scenarios

1. **Abertura de Conferência de Caixa (FR-020, UX-DR2):**
   - Consulta `GET /api/compras-marca/:id/conferencia` para compra em status `PEDIDO_REGISTRADO`.
   - Retorna lista de itens esperados, produtos, código de barras e quantidades pendentes.
2. **Confirmação de Conferência e Entrada Física no Estoque (AD-3, FR-020):**
   - Envia conferência com `idempotency_key` válida.
   - Incrementa `quantidade_recebida` no item da compra.
   - Incrementa estoque físico (`presentes++`, `pronta_entrega++` para itens de pronta-entrega) satisfazendo $Presentes = Reservados + ProntaEntrega$.
   - Registra movimentação de estoque `ENTRADA_COMPRA_MARCA`.
   - Registra auditoria nominal `CONFERIR_COMPRA_MARCA`.
3. **Idempotência em Retransmissão de Rede (AD-7, NFR-001):**
   - Reenvia a exata mesma requisição com a mesma `idempotency_key`.
   - O servidor retorna status 200/201 com o mesmo payload da resposta anterior.
   - O estoque NÃO é incrementado uma segunda vez (valores permanecem inalterados).
   - Nenhuma movimentação duplicada é gerada.
4. **Rejeição de Quantidades Negativas ou Excedentes (FR-020):**
   - Tentar conferir quantidade negativa retorna 400 `QUANTIDADE_INVALIDA`.
   - Tentar conferir quantidade maior que a pedida sem ajuste retorna 400 `EXCEDENTE_NAO_PERMITIDO`.
5. **Isolamento Multi-inquilino (AD-1):**
   - Operação B não pode conferir compras da Operação A.

</frozen-after-approval>
