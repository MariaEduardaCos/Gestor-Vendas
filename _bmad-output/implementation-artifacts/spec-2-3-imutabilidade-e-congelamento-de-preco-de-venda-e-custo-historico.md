---
title: 'Story 2.3: Imutabilidade e Congelamento de Preço de Venda e Custo Histórico'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '26dda98'
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

**Problem:** Revendedoras de cosméticos lidam com frequentes reajustes de preço de catálogo de ciclo para ciclo e variações na comissão/desconto concedido pela marca (ex: um hidratante vendido a R$ 60,00 no Ciclo 1 passa a custar R$ 75,00 no Ciclo 2; ou a marca concede 30% em um mês e 35% no outro). Se o sistema recalculasse o valor de contas a receber ou custos passados a partir das tabelas vivas de produtos ou marcas, valores acordados com clientes seriam alterados retroativamente, corrompendo a contabilidade e a confiança da revendedora (FR-010, FR-019, AD-2).

**Approach:** Assegurar a invariante de imutabilidade histórica (AD-2, FR-019). No exato instante da confirmação de uma encomenda/conta (`ItemConta`) ou da criação de um registro de compra à marca (`ItemCompraMarca`), os valores de `preco_unitario_centavos`, `custo_unitario_centavos` e `origem_custo` são capturados como instantâneos (snapshots) imutáveis e persistidos diretamente nas linhas de transação. Atualizações subsequentes no catálogo de produtos (`PUT /api/produtos/:id`) ou nos parâmetros da marca (`PUT /api/marcas/:id`) não podem, sob nenhuma hipótese, alterar registros pretéritos, aplicando-se única e exclusivamente a transações futuras.

## Boundaries & Constraints

- `AD-2 & FR-019`: Congelamento estrito de preço e custo. Itens gravados em `itens_conta` e `itens_compra_marca` retêm os valores acordados no momento da criação.
- `AD-1 & NFR-002`: Isolamento multi-inquilino compulsoriamente preservado.
- `FR-010 & FR-011`: Alterações no catálogo de produtos afetam apenas itens novos.
- Imutabilidade comprovada por testes de regressão temporal e integridade de dados.

## Verification Scenarios

1. **Congelamento em Encomenda / Conta Cliente (FR-019, AD-2):**
   - Cria produto com preço de venda R$ 100,00 e custo estimado R$ 70,00 (marca com 30%).
   - Cria encomenda e conta para cliente com 2 unidades (total R$ 200,00, custo R$ 140,00).
   - Atualiza produto no catálogo para R$ 130,00 e percentual da marca para 40%.
   - Consulta a conta/encomenda anterior e verifica que o valor continua rigorosamente R$ 200,00, preço unitário R$ 100,00 e custo unitário R$ 70,00.
2. **Novas Transações Refletem Novo Preço:**
   - Cria nova encomenda para o mesmo produto após a alteração.
   - Verifica que a nova conta reflete o preço novo de R$ 130,00.
3. **Congelamento em Compras à Marca (FR-019):**
   - Cria compra à marca com itens calculados pelo custo da época.
   - Modifica desconto da marca.
   - Verifica que os itens da compra anterior e seus custos unitários permanecem inalterados.

</frozen-after-approval>
