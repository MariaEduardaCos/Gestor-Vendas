---
title: 'Story 2.1: Registro de Encomenda Individual por Cliente e Criação da Conta'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '5fc8aee'
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

**Problem:** A revendedora anota pedidos de clientes antes de fechar a compra na revista ou no site da marca (ex: Natura, Avon, Boticário). Ao anotar no papel de rascunho ou em sistemas genéricos de estoque, dois erros graves acontecem: ou o sistema inflaciona o estoque físico presente como se os produtos já estivessem na estante, ou o valor da encomenda é cobrado antecipadamente como dívida vencida antes da chegada da caixa.

**Approach:** Criar o fluxo de registro de Encomenda Individual por Cliente associado a uma Conta individual (`ContaCliente`) com itens em status `AGUARDANDO_FABRICA`. O estoque físico (`Presentes` e `ProntaEntrega`) permanece estritamente inalterado (invariante AD-3: entrada física ocorre apenas na conferência da caixa). O preço de venda unitário e o custo unitário (calculado pela margem da marca ou custo manual) são congelados de forma imutável nos itens da conta (AD-2, FR-019). A conta nasce com total devido, mas com saldo cobrável imediato R$ 0,00 na "Visão Sem Itens Aguardados" (AD-4). Rascunhos cancelados são descartados sem gerar movimentação (FR-015, FR-016).

## Boundaries & Constraints

**Always:**
- Toda encomenda é vinculada compulsoriamente a um `cliente_id` válido e à `operacao_id` ativa da sessão operacional (AD-1, FR-015).
- Todos os itens da encomenda iniciam estritamente com `status_entrega: 'AGUARDANDO_FABRICA'` (FR-015, AD-3).
- O estoque físico de `Presentes`, `Reservados` e `ProntaEntrega` permanece inalterado no registro de encomenda (AD-3).
- Os valores de `preco_unitario_centavos` e `custo_unitario_centavos` (com `origem_custo`) são congelados imutavelmente na criação de cada `ItemConta` (AD-2, FR-019).
- A transação cria atomicamente o registro de `Encomenda` e a respectiva `Conta` com seus itens em `$transaction` (NFR-001).
- Toda criação de encomenda registra a auditoria nominal do operador (`operador_id`, `operador_nome`, timestamp ISO-8601 UTC) (NFR-003).

**Never:**
- Nunca incrementar frascos em `Presentes` ou `ProntaEntrega` na anotação de encomenda (AD-3).
- Nunca cobrar adiantado ou tratar itens `AGUARDANDO_FABRICA` como débito vencido na projeção "Sem Aguardados" (AD-4).
- Nunca permitir criação de encomenda com quantidade menor ou igual a zero ou produtos inexistentes (FR-015).
- Nunca gravar ou persistir contas para rascunhos cancelados ou não confirmados (FR-016).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Registro válido de encomenda | Cliente selecionada, 2 unidades do Produto A (R$ 50 cada) | Cria Encomenda e Conta com total R$ 100,00 (10000 centavos), itens com status `AGUARDANDO_FABRICA`, estoque físico intacto | Valida campos obrigatórios e tenant |
| Consulta da ficha da cliente após encomenda | Cliente com encomenda recente | Ficha exibe a encomenda na aba de Encomendas e a Conta associada; Saldo Cobrável Hoje projeta R$ 0,00 se todos os itens estão aguardando | N/A |
| Tentativa de encomendar com quantidade zero ou negativa | Quantidade = 0 ou -1 | Rejeita a operação com erro RFC 7807 400 (`QUANTIDADE_INVALIDA`) | Retorna mensagem acolhedora sem persistir nada |
| Produto sem percentual de marca e sem custo manual | Produto com custo `NULL` encomendado | Item da conta grava `custo_unitario_centavos: null` e `origem_custo: 'DESCONHECIDO'` (AD-2) sem presumir zero | Respeita regra de custo desconhecido |
| Cancelamento do modal de encomenda | Revendedora fecha o formulário antes de salvar | Nenhuma conta ou encomenda é salva no banco; formulário limpo | Descarte de rascunho sem efeitos colaterais |
| Isolamento multi-inquilino | Operador B tenta criar encomenda para cliente da Operação A | Retorna erro 404 (`CLIENTE_NAO_ENCONTRADA`) pelo filtro de tenant | TenantPrismaClient bloqueia acesso cruzado |

</frozen-after-approval>

## Code Map

- `packages/core/src/domain/encomenda.ts` -- Entidades de domínio `Encomenda`, `ItemConta`, `ContaCliente` e tipos de status de entrega (`AGUARDANDO_FABRICA`, `RESERVADO_PRESENTE`, `ENTREGUE`, `CANCELADO`).
- `packages/core/src/index.ts` -- Re-exportação dos tipos e regras de encomenda.
- `packages/core/tests/encomenda.test.ts` -- Testes unitários de domínio puro validando cálculo de total, congelamento de preço/custo e projeção "sem aguardados".
- `packages/server/prisma/schema.prisma` -- Modelos `ItemConta`, atualizações de relações em `Conta`, `Encomenda` e `Cliente`.
- `packages/server/src/routes/encomendas.ts` -- Endpoints HTTP (`POST /api/encomendas`, `GET /api/encomendas`, `GET /api/encomendas/:id`).
- `packages/server/tests/encomendas.test.ts` -- Testes de integração validando criação atômica de encomenda e conta, congelamento de preço, não-alteração do estoque físico e isolamento multi-inquilino.
- `packages/web/src/components/EncomendaModal.tsx` -- Modal acolhedor de anotação de encomenda com seleção rápida de produtos do catálogo, ajuste de quantidades (alvos $\ge 48\text{px}$) e cálculo prévio do total.
- `packages/web/src/components/ClienteFichaModal.tsx` -- Atualização da Ficha da Cliente para exibir encomendas ativas, itens aguardados da fábrica e botão direto `+ Anotar Encomenda`.
- `packages/web/src/App.tsx` -- Integração dos atalhos operacionais e comunicação entre gaveta/ficha e modal de encomenda.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/domain/encomenda.ts` e testes -- Criar modelos de domínio puro para `Encomenda`, `ItemConta`, `ContaCliente` e cálculo da Visão Sem Aguardados (AD-3, AD-4).
- [x] `packages/server/prisma/schema.prisma` -- Modelar `ItemConta` e relacionamentos em `Conta` e `Encomenda` com migração `prisma db push`.
- [x] `packages/server/src/routes/encomendas.ts` -- Implementar endpoints REST para criação atômica de encomenda e conta com congelamento de valores (FR-015, FR-016, AD-2).
- [x] `packages/server/tests/encomendas.test.ts` -- Criar testes de integração cobrindo criação, invariante de estoque zerada, auditoria e isolamento multi-inquilino.
- [x] `packages/web/src/components/EncomendaModal.tsx` -- Criar modal acolhedor com alvos de toque $\ge 48\text{px}$, pesquisa de produtos e cálculo visual de totais.
- [x] `packages/web/src/components/ClienteFichaModal.tsx` e `App.tsx` -- Integrar histórico de encomendas e criação rápida a partir da ficha da cliente.

**Acceptance Criteria:**
- Given uma cliente selecionada e produtos escolhidos do catálogo, when a revendedora informa quantidades positivas e confirma a encomenda, then os itens são gravados com status de entrega `AGUARDANDO_FABRICA`, and nenhuma unidade é adicionada ao estoque de `Presentes` ou `ProntaEntrega` (FR-015, AD-3).
- Given a confirmação da encomenda, when a transação é concluída, then uma conta individual (`ContaCliente`) é criada contendo os itens encomendados e o valor total devido, and rascunhos não finalizados são descartados sem gerar contas ou saldos a receber (FR-016, NFR-003).
- Given um produto encomendado, when a encomenda for confirmada, then o preço de venda unitário e o custo unitário (ou `NULL` se desconhecido) são gravados de forma imutável nos itens da conta (AD-2, FR-019).

## Implementation Notes

- Modelos de domínio puro criados em `packages/core/src/domain/encomenda.ts`: `ItemConta`, `ContaCliente` e `Encomenda`, com invariantes rigorosas de quantidade positiva, congelamento de preço/custo e cálculo projetado de saldo cobrável hoje (R$ 0,00 quando todos os itens estão aguardando fábrica, conforme AD-4).
- Modelagem no banco via Prisma com `ItemConta` associado a `Conta` e `Encomenda`, sincronizado via `prisma db push`.
- Rotas REST `POST /api/encomendas`, `GET /api/encomendas`, `GET /api/encomendas/:id` e enriquecimento de `GET /api/clientes/:id` implementados no servidor Fastify com transação atômica `$transaction` e auditoria nominal (NFR-003).
- Suíte de 11 testes de integração em `packages/server/tests/encomendas.test.ts` cobrindo criação atômica, invariante física de estoque intacta (AD-3), isolamento de tenant (FR-002), contrato DTO e conformidade RFC 7807 (`QUANTIDADE_INVALIDA`, `CLIENTE_NAO_ENCONTRADA`).
- Interface do usuário React construída em `packages/web/src/components/EncomendaModal.tsx` com alvos de toque $\ge 48\text{px}$, busca no catálogo, ajuste de quantidades e resumo em tempo real. Integrada com `ClienteFichaModal.tsx` e tela principal `App.tsx`.

## Spec Change Log

- Adicionada propriedade `refreshKey` em `ClienteFichaModal` para recarregamento reativo instantâneo quando uma encomenda for gerada a partir da ficha aberta.
- Adicionado guard contra duplo clique e suporte a fechamento por tecla `Escape` e backdrop no modal de encomenda.

## Review Triage Log

- **Imutabilidade e congelamento de preço/custo (AD-2, FR-019)**: Modificado `precoUnitarioCentavos`, `custoUnitarioCentavos` e `origemCusto` para `readonly` em `ItemConta` (`packages/core/src/domain/encomenda.ts`).
- **Cálculo da Encomenda ignorando cancelados**: Métodos `quantidadeTotalItens` e `valorTotalCentavos` agora filtram itens com `statusEntrega !== 'CANCELADO'` para paridade com `ContaCliente`. Teste unitário adicionado em `encomenda.test.ts`.
- **Validação defensiva de entrada no servidor**: `POST /api/encomendas` valida tipo da `descricao` e verifica se elementos de `itens` são objetos não-nulos com `produto_id` string válida, prevenindo erro 500 e retornando 400 Bad Request RFC 7807.
- **Proteção contra conflito de integridade referencial**: Adicionada verificação prévia de `itemConta.count` em `DELETE /api/produtos/:id` retornando 409 CONFLICT em vez de crash do banco de dados.
- **Contas sem itens no cálculo cobrável hoje**: Em `routes/clientes.ts`, contas legadas ou manuais sem itens usam `c.valor_total` para não projetar saldo cobrável zerado indevidamente.
- **Contrato DTO unificado**: Formatadores monetários (`preco_unitario_formatado`, `subtotal_centavos`, `subtotal_formatado`) adicionados em `GET /api/encomendas` e `GET /api/encomendas/:id`.
- **Acessibilidade e usabilidade no modal**: `EncomendaModal.tsx` recebeu tecla `Escape`, clique no backdrop, busca incluindo código de barras e guard contra duplo clique no envio.
- **Sincronização em tempo real da ficha aberta**: `App.tsx` e `ClienteFichaModal.tsx` integrados com `refreshKey` para atualizar instantaneamente a lista de contas e encomendas da cliente sem fechar o modal.
- **Badges de status de encomenda corrigidos**: Mapeamento dinâmico atualizado para os valores reais do domínio (`AGUARDANDO_FABRICA`, `PARCIALMENTE_RECEBIDO`, `RECEBIDO`, `CANCELADO`).
- **Asserções ricas de teste de integração**: Testes em `encomendas.test.ts` expandidos com validação de payload completo em `GET /api/encomendas/:id`, contrato de itens na ficha `GET /api/clientes/:id`, payload malformado e bloqueio de exclusão 409.

## Design Notes

A separação conceitual entre Frasco Físico e Encomenda Lógica é a viga mestra da arquitetura do ConsultoraSync (AD-3 e AD-4). Registrar uma encomenda cria a expectativa contábil e a linha de pedido, mas o estoque físico só se altera no momento em que a caixa da fábrica é aberta na conferência. Isso impede o erro comum em que o sistema aponta que há 5 frascos na casa da revendedora quando eles ainda estão viajando na transportadora.
