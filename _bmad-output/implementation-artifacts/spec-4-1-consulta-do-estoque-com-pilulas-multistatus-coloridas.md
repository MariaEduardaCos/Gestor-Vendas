# Spec 4.1: Consulta do Estoque com Pílulas Multistatus Coloridas

## Frontmatter
- **Story:** 4.1
- **Epic:** 4 - Atendimento de Vendas, Reservas e Saída Física na Entrega
- **FRs:** FR-025 (Consulta de Estoque com 4 Pílulas Multistatus), NFR-004, NFR-005.
- **Invariantes e Diretrizes:** AD-3 (Conservação de Estoque: $Presentes = Reservados + ProntaEntrega$), UX-DR3 (Cartão do Produto com Pílulas Semânticas: Presentes, Reservados, Pronta-Entrega e Aguardados da Fábrica).

---

## 1. Contexto e Problema
A revendedora precisa consultar seu catálogo e estoque em menos de 2 segundos, seja no computador ou no celular, e ter clareza absoluta sobre o estado de cada produto para não cometer o erro clássico de prometer a uma cliente um produto que já está reservado ou vender algo que ainda não chegou da fábrica.
Para isso, o cartão do produto no Catálogo/Estoque (Superfície S4) deve exibir o preço de venda e **4 contadores em pílulas coloridas**:
1. **Presentes (Verde):** total de frascos físicos presentes na estante ($Presentes = Reservados + ProntaEntrega$).
2. **Reservados (Âmbar/Amarelo):** frascos presentes que já pertencem a encomendas nominais de clientes e não podem ser vendidos.
3. **Pronta-Entrega (Verde):** frascos livres para venda e entrega imediata.
4. **Aguardando Fábrica (Azul):** unidades pedidas ou encomendadas que ainda não chegaram da marca.

---

## 2. Critérios de Aceitação
1. **Quatro Pílulas Coloridas no Cartão (FR-025, UX-DR3):**
   - Ao listar ou buscar produtos por código, nome ou marca na tela S4, cada produto exibe:
     - Preço de Venda formatado (em centavos inteiros).
     - Pílula *Presentes* (verde).
     - Pílula *Reservados* (âmbar/status-reserved).
     - Pílula *Pronta-Entrega* (verde/status-available).
     - Pílula *Aguardando Fábrica* (azul/brand-primary ou azul informativo).
2. **Consistência e Centralização de Dados (NFR-004, NFR-005):**
   - No endpoint `GET /api/estoque` e `GET /api/estoque/:produtoId`, o campo `aguardando_fabrica` é calculado e retornado para cada produto.
   - Os valores exibidos no celular e no computador refletem rigorosamente o mesmo banco local SQLite.
3. **Invariante Física AD-3:**
   - A invariante $Presentes = Reservados + ProntaEntrega$ deve ser sempre respeitada na interface e no banco de dados.

---

## 3. Plano de Implementação
1. **Backend (`packages/server/src/routes/estoque.ts`):**
   - Atualizar `GET /api/estoque` e `GET /api/estoque/:produtoId` para calcular `aguardando_fabrica` (soma de `ItemConta.status_entrega == 'AGUARDANDO_FABRICA'` + itens pendentes de pronta-entrega em compras abertas).
2. **Testes do Servidor (`packages/server/tests/estoque.test.ts`):**
   - Adicionar asserções para o campo `aguardando_fabrica` com e sem encomendas e pedidos à marca.
3. **Frontend (`packages/web/src/types/estoque.ts` & `packages/web/src/components/ProdutosView.tsx`):**
   - Atualizar `EstoqueDTO` com `aguardando_fabrica`.
   - Incluir a pílula azul "Aguardando Fábrica" nos cartões de produtos na tela S4.
