---
title: 'Story 1.3: Catálogo de Produtos, Variantes, Preço de Venda e Custo por Marca'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: 'a242aa5c237b315f8134c3e37e7550227dfe3db0'
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

**Problem:** A revendedora trabalha com múltiplas marcas (Natura, Avon, Boticário) e precisa cadastrar produtos e suas variantes, manter preços de venda fixos em centavos, e obter o custo estimado automaticamente a partir do percentual de desconto da marca ou por informação manual, mantendo a proveniência auditada e sem inventar margens fictícias quando o percentual for desconhecido.

**Approach:** Criar as entidades de domínio `Marca` e `Produto` no `@consultorasync/core` com política de proveniência de custo e manipulação estrita em `Centavos`, implementar as tabelas no SQLite com Prisma e endpoints REST no `@consultorasync/server` com busca por nome/código/marca e auditoria nominal, e disponibilizar a interface de Catálogo de Produtos e Gestão de Marcas no `@consultorasync/web`.

## Boundaries & Constraints

**Always:**
- Todo produto e marca pertencem estritamente à `operacao_id` ativa da sessão.
- Preços de venda e custos são obrigatoriamente armazenados em **centavos inteiros** (`INTEGER`), proibindo ponto flutuante (NFR-010).
- Identificador primário do produto é sempre um UUID v7 gerado internamente, independente da presença ou valor do código de barras (FR-006).
- Variantes distintas de um mesmo produto (ex: "Algodão 400ml" vs "Algodão Refil") são mantidas como registros separados e nunca agrupadas silenciosamente (FR-006).
- Se a marca possui percentual cadastrado e o produto não tem custo manual, o custo é calculado como `PrecoVenda * (1 - Percentual / 100)` e gravado com proveniência `ESTIMADO_PERCENTUAL` (FR-011, D-01).
- Se não houver percentual nem custo manual informado, o custo é gravado como `NULL` e exibido como "Desconhecido", sendo terminantemente proibido gravar 0,00 ou deduzir percentuais fictícios (FR-012, AD-2).
- Toda criação ou edição registra auditoria com `operador_id`, `operador_nome` e timestamp ISO-8601 UTC (NFR-003).

**Never:**
- Não permitir preço de venda menor ou igual a zero.
- Não presumir custo de 0,00 quando ausente.
- Não permitir que uma operação consulte ou altere produtos ou marcas de outra operação (retornar 404).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Cadastro de produto com percentual de marca | Marca com 30% de desconto, Preço R$ 100,00 (10000 centavos) | Produto salvo com `preco_venda_centavos: 10000`, `custo_centavos: 7000`, `proveniencia_custo: 'ESTIMADO_PERCENTUAL'` | N/A |
| Cadastro de produto com custo manual informado | Custo manual informado R$ 65,00 (6500 centavos), Preço R$ 100,00 | Produto salvo com `custo_centavos: 6500`, `proveniencia_custo: 'INFORMADO_MANUAL'` | Rejeita se custo informado for negativo |
| Cadastro de produto sem custo e sem percentual de marca | Marca sem percentual definido, nenhum custo informado | Produto salvo com `custo_centavos: null`, `proveniencia_custo: 'DESCONHECIDO'`, exibido como "Desconhecido" | Proibido gravar 0,00 |
| Variantes do mesmo produto | Mesmo nome "Hidratante Tododia", variantes "Algodão" e "Macadâmia" | Dois registros criados com UUIDs v7 distintos e variantes preservadas | N/A |
| Busca por código de barras ou nome | Consulta GET por código EAN ("7891234567890") ou nome ("Algodão") | Retorna produto correspondente em tempo de resposta < 2s | Retorna 404/vazio se não encontrado |
| Isolamento entre tenants em produtos | Operação B tenta consultar produto da Operação A por ID ou código | 404 Not Found sem expor catálogo da outra operação | RFC 7807 404 Not Found |

</frozen-after-approval>

## Code Map

- `packages/core/src/domain/marca.ts` -- Entidade `Marca` com validação de percentual (0 a 100).
- `packages/core/src/domain/produto.ts` -- Entidade `Produto` com regras de variantes, cálculo de custo e enum de proveniência (`INFORMADO_MANUAL`, `ESTIMADO_PERCENTUAL`, `DESCONHECIDO`).
- `packages/core/src/index.ts` -- Re-exportação de `Marca`, `Produto` e tipos relacionados.
- `packages/server/prisma/schema.prisma` -- Models `Marca` e `Produto` com índices em `[operacao_id, codigo_barras]` e `[operacao_id, nome]`.
- `packages/server/src/routes/marcas.ts` -- Rotas REST para gestão de marcas e percentuais (`/api/marcas`).
- `packages/server/src/routes/produtos.ts` -- Rotas REST para catálogo, busca por código e precificação (`/api/produtos`).
- `packages/server/src/app.ts` -- Registro das rotas de marcas e produtos.
- `packages/server/tests/produtos.test.ts` -- Testes de integração cobrindo cálculo de custo, variantes, proveniência e isolamento.
- `packages/web/src/types/produto.ts` -- Tipos TypeScript DTO para Marca e Produto.
- `packages/web/src/components/MarcasModal.tsx` -- Modal para gerenciar marcas e percentuais padrão.
- `packages/web/src/components/ProdutoModal.tsx` -- Modal/Formulário para cadastrar e editar produto/variante com cálculo dinâmico de custo.
- `packages/web/src/components/ProdutosView.tsx` -- Tela de Catálogo (S4) com busca, badges de proveniência e lista de produtos.
- `packages/web/src/App.tsx` -- Integração da navegação com a nova tela de Catálogo.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/domain/marca.ts` e `produto.ts` -- Implementar entidades com cálculo de custo e proveniência pura -- Garantir invariantes no domínio.
- [x] `packages/server/prisma/schema.prisma` -- Modelar tabelas `marcas` e `produtos` e sincronizar SQLite -- Persistência relacional.
- [x] `packages/server/src/routes/marcas.ts` e `produtos.ts` -- Implementar endpoints REST com auditoria nominal e busca por código -- API protegida.
- [x] `packages/server/tests/produtos.test.ts` -- Escrever testes automatizados cobrindo cálculo de 30% em R$ 100, custo nulo e variantes -- Verificação da história.
- [x] `packages/web/src/components/MarcasModal.tsx` e `ProdutoModal.tsx` -- Criar componentes de cadastro de marca e produto com design tokens -- Interface acolhedora.
- [x] `packages/web/src/components/ProdutosView.tsx` e `App.tsx` -- Integrar tela de catálogo na navegação móvel com busca instantânea -- Experiência completa do usuário.

**Acceptance Criteria:**
- Given que a revendedora cadastra um produto com Marca, Nome, Preço de Venda (em centavos inteiros), Código de Barras EAN (opcional) e Variante (ex: "Algodão 400ml"), when o produto é salvo, then ele recebe um ID interno independente do código de barras e variantes distintas não são agrupadas (FR-006, NFR-010).
- Given um produto cadastrado com preço de venda R$ 100,00 e uma marca cadastrada com percentual de lucro de 30%, when o custo estimado for calculado, then o sistema registra custo estimado de R$ 70,00 com proveniência ESTIMADO_PERCENTUAL (FR-011, D-01).
- Given um produto cadastrado sem percentual de marca associado e sem custo manual informado, when a consulta do produto for realizada, then o campo de custo é armazenado como NULL e exibido como "Desconhecido", sendo terminantemente proibido gravar 0,00 ou presumir percentuais (FR-012, AD-2).

## Implementation Notes

- Implementadas entidades de domínio puras `Marca` e `Produto` com cálculo dinâmico de custo e proveniência (`ESTIMADO_PERCENTUAL`, `INFORMADO_MANUAL`, `DESCONHECIDO`), assegurando manipulação estrita em `Centavos` e impedindo gravação de 0,00 quando ausente.
- Modeladas tabelas `marcas` e `produtos` no Prisma com índices em `[operacao_id, codigo_barras]` e `[operacao_id, nome]`, integrando com a extensão multi-inquilino `TenantPrismaClient`.
- Implementadas rotas REST `/api/marcas` e `/api/produtos` com auditoria nominal UTC (`operador_id`, `operador_nome`), busca por código EAN (`/api/produtos/codigo/:codigo`) e busca instantânea.
- Criadas telas e modais web: `MarcasModal`, `ProdutoModal` e `ProdutosView` com navegação na barra inferior, design tokens do `DESIGN.md` e badges de proveniência de custo.
- Cobertura completa de testes automatizados unitários e de integração (50 testes aprovados em todo o monorepo).


## Spec Change Log

## Review Triage Log

## Design Notes

A tabela de produtos incluirá índice em `[operacao_id, codigo_barras]` para garantir que o leitor de código de barras (implementado na Story 1.5 e usado nos Épicos 3 e 4) responda instantaneamente em milissegundos.
