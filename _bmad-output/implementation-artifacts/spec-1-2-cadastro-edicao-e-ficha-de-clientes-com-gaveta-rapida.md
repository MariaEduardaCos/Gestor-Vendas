---
title: 'Story 1.2: Cadastro, Edição e Ficha de Clientes com Gaveta Rápida'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '06d4d6a074b8d37e297054b4d0478db9a4e17590'
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

**Problem:** A revendedora precisa registrar e consultar clientes de forma instantânea sem perder o contexto operacional de vendas ou encomendas, permitindo cadastros mínimos rápidos (apenas nome e telefone) e mantendo a diferenciação clara de homônimos e o isolamento entre operações.

**Approach:** Implementar a entidade de domínio `Cliente` no `@consultorasync/core`, a persistência no SQLite via Prisma e endpoints REST no `@consultorasync/server` com busca rápida por nome/telefone e proteção multi-inquilino, e a interface no `@consultorasync/web` composta pela Lista/Ficha de Clientes (S2) e o componente de Gaveta Rápida slide-over (S3) com autofocus e preservação de fluxo.

## Boundaries & Constraints

**Always:**
- Todo cliente cadastrado, consultado ou editado é estritamente vinculado à `operacao_id` ativa da sessão.
- Nome do cliente é obrigatório e não vazio (com trim). Telefone e endereço são opcionais.
- Homônimos com mesmo nome recebem identificadores UUID v7 distintos e exibem telefone/endereço para diferenciação visual.
- A busca instantânea por nome ou telefone deve responder em menos de 2 segundos (NFR-006).
- A gaveta rápida (S3) deve conter apenas Nome e Telefone, auto-focus no Nome e fechar selecionando o cliente recém-criado sem reiniciar o fluxo hospedeiro (UX-DR4).
- Toda criação e edição registra auditoria com `operador_id`, `operador_nome` e timestamp ISO-8601 UTC (NFR-003).

**Never:**
- Não permitir excluir cliente que possua vendas, encomendas ou contas vinculadas (rejeitar com 400 Bad Request / 409 Conflict).
- Não permitir que uma operação consulte, edite ou exclua clientes de outra operação (retornar 404).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Cadastro rápido via gaveta | Nome preenchido ("Carla Vizinha"), telefone opcional | Cliente criado com UUID v7, vinculado a `operacao_id`, gaveta fecha e emite evento de seleção | Erro 400 se nome estiver vazio |
| Cadastro completo via formulário | Nome, Telefone com máscara e Endereço | Cliente persistido no banco com todos os campos e auditoria nominal gravada | Retorna RFC 7807 em campos inválidos |
| Busca instantânea por prefixo/telefone | Termo de busca "ana" ou "99876" | Lista filtrada de clientes contendo o termo no nome ou telefone em tempo de resposta < 2s | Retorna lista vazia `[]` se não houver match |
| Clientes homônimos | Dois cadastros com mesmo nome "Maria Silva" | Ambos os clientes salvos com UUIDs v7 distintos e exibidos separadamente na lista/ficha com seus telefones | N/A |
| Tentativa de exclusão de cliente com vínculos | Solicitação DELETE para cliente com contas/vendas | Operação recusada mantendo integridade dos dados históricos | 400 Bad Request com mensagem explicativa |
| Tentativa de acesso cruzado a cliente de outro tenant | GET/PUT/DELETE em `/api/clientes/:id` pertencente à Operação B | 404 Not Found sem expor existência ou dados do cliente | RFC 7807 404 Not Found |

</frozen-after-approval>

## Code Map

- `packages/core/src/domain/cliente.ts` -- Entidade pura de domínio `Cliente` com validação de nome, máscara/formato e invariantes.
- `packages/core/src/index.ts` -- Re-exportação de `Cliente`.
- `packages/server/prisma/schema.prisma` -- Model `Cliente` no SQLite com índices para busca por nome/telefone e `operacao_id`.
- `packages/server/src/routes/clientes.ts` -- Endpoints REST (`POST`, `GET`, `GET /:id`, `PUT /:id`, `DELETE /:id`) com autorização de sessão e auditoria nominal.
- `packages/server/src/app.ts` -- Registro do plugin de rotas `/api/clientes`.
- `packages/server/tests/clientes.test.ts` -- Testes de integração cobrindo criação rápida, busca instantânea, homônimos e isolamento entre tenants.
- `packages/web/src/components/ClienteDrawer.tsx` -- Componente de gaveta rápida (S3) com autofocus, máscara de telefone e callback de seleção.
- `packages/web/src/components/ClientesView.tsx` -- Tela de clientes (S2) com busca rápida, lista com pílulas informativas e botão `+ Nova Cliente`.
- `packages/web/src/components/ClienteFichaModal.tsx` -- Modal ou visualização detalhada da ficha da cliente com histórico e saldo de crédito.
- `packages/web/src/App.tsx` -- Integração das visualizações de Clientes e Gaveta com a barra de navegação/sessão da Dona Sônia.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/domain/cliente.ts` -- Criar entidade de domínio `Cliente` com validações puras -- Garantir regras de negócio no core.
- [x] `packages/server/prisma/schema.prisma` -- Modelar tabela `clientes` com `operacao_id` e aplicar `prisma db push` -- Persistência relacional no SQLite.
- [x] `packages/server/src/routes/clientes.ts` -- Implementar rotas CRUD e busca com auditoria nominal -- API REST isolada por tenant.
- [x] `packages/server/tests/clientes.test.ts` -- Testar busca rápida, cadastro rápido, homônimos e bloqueio de exclusão com contas -- Verificação automatizada.
- [x] `packages/web/src/components/ClienteDrawer.tsx` -- Criar gaveta rápida slide-over (S3) com design tokens e autofocus -- Atender UX-DR4.
- [x] `packages/web/src/components/ClientesView.tsx` e `ClienteFichaModal.tsx` -- Implementar tela de clientes (S2) e ficha detalhada -- Atender FR-003 e FR-004.
- [x] `packages/web/src/App.tsx` -- Integrar tela de clientes e gatilho da gaveta rápida na interface principal -- Experiência completa do usuário.

**Acceptance Criteria:**
- Given que a revendedora está na tela de Clientes (S2), when ela cadastra um cliente com Nome (obrigatório), Telefone (opcional com máscara) e Endereço (opcional), then o cliente é salvo com identificador único UUID v7, and a busca instantânea localiza o cliente por nome ou telefone em menos de 2 segundos (FR-003, NFR-006).
- Given que a revendedora está em qualquer fluxo operacional (como venda ou encomenda), when ela toca no botão `+ Nova Cliente`, then uma gaveta lateral/inferior (S3) se abre com foco no Nome e campo de Telefone, and ao salvar, a gaveta fecha, o cliente recém-criado é selecionado automaticamente e o fluxo em andamento não é reiniciado (UX-DR4).
- Given dois clientes cadastrados com o mesmo nome ("Maria Silva"), when a revendedora consulta a lista ou ficha, then cada registro mantém identificador interno distinto e exibe telefone/endereço para diferenciação, and a ficha exibe histórico de contas, itens encomendados, entregues e saldo da carteira de crédito (FR-003, FR-004).

## Implementation Notes

- Implementada a entidade pura `Cliente` em `@consultorasync/core` com validação de nome obrigatório, formatação/sanitização de telefone brasileiro e controle de saldo de crédito em centavos inteiros.
- Adicionados modelos `Cliente`, `Conta` e `Encomenda` ao `schema.prisma` com chaves estrangeiras restritas (`onDelete: Restrict`) para impedir perda acidental de histórico financeiro e relacional.
- Criadas rotas REST `/api/clientes` (`POST`, `GET`, `GET /:id`, `PUT /:id`, `DELETE /:id`) com autorização compulsória por sessão, busca rápida indexada por nome e telefone, bloqueio de deleção de clientes com contas/encomendas vinculadas e auditoria nominal (`CADASTRAR_CLIENTE`, `EDITAR_CLIENTE`, `EXCLUIR_CLIENTE`) gravada com `operador_id` e timestamp UTC.
- Implementados componentes no `@consultorasync/web`: `ClienteDrawer` (gaveta rápida S3 com autofocus no Nome e máscara de telefone), `ClientesView` (S2 com busca rápida, lista com pílulas e diferenciação visual de homônimos) e `ClienteFichaModal` (ficha detalhada com histórico de compras/contas, encomendas e carteira de crédito).
- Configurado `vitest.config.ts` no servidor com execução sequencial para isolamento absoluto das operações SQLite nos testes automatizados.

## Spec Change Log

## Review Triage Log

## Design Notes

A busca rápida no SQLite utilizará `LIKE %termo%` indexado por `operacao_id` e `nome`/`telefone`, respondendo na casa dos milissegundos localmente. A gaveta rápida (S3) é desacoplada e aceita uma prop `onClienteCriado(cliente: Cliente)` para que qualquer tela (como vendas ou encomendas futuras) possa invocá-la sem perder o estado local.
