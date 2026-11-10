# Epic 1 Context: Fundação Operacional, Clientes e Catálogo com Visor de Leitura

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Estabelecer a fundação operacional segura do sistema garantindo acesso multi-inquilino estritamente isolado por operação e rastreabilidade nominal por operador. Permitir o cadastro ágil de clientes (com gaveta rápida sem perda de fluxo), gestão de catálogo com produtos/variantes, precificação, cálculo de custo por marca e proveniência preservada, estoque inicial e infraestrutura de leitura de código de barras (câmera com auto-start e pareamento efêmero via WebSocket celular-computador).

## Stories

- Story 1.1: Inicialização do Monorepo, Sessão Operacional e Isolamento Multi-inquilino
- Story 1.2: Cadastro, Edição e Ficha de Clientes com Gaveta Rápida
- Story 1.3: Catálogo de Produtos, Variantes, Preço de Venda e Custo por Marca
- Story 1.4: Lançamento de Estoque Inicial por Produto
- Story 1.5: Visor de Leitura Híbrido com Câmera Contínua e Filtro Anti-Duplicação
- Story 1.6: Pareamento Efêmero Celular-Computador com WebSocket e Feedback Visual

## Requirements & Constraints

- **Isolamento de Dados (FR-002, NFR-002):** Toda e qualquer entidade e operação no banco de dados deve ser restrita e filtrada estritamente por `operacao_id`. Nenhuma sessão ou consulta pode acessar ou alterar dados de outra operação, mesmo conhecendo identificadores externos.
- **Rastreabilidade Nominal (FR-001, NFR-003):** Cada transação e mutação persistida deve registrar o `operador_id`, `operador_nome` e timestamp ISO-8601 UTC de quem confirmou a ação.
- **Precisão Financeira (NFR-010):** Todos os valores monetários (preços de venda, custos, créditos) devem ser armazenados estritamente em centavos inteiros (`INTEGER`). Custos ausentes devem ser gravados como `NULL` e exibidos como "Desconhecido", sendo proibido gravar `0,00`.
- **Identificadores Únicos (AD-7):** Todas as entidades utilizam `UUID v7` como chave primária e requisições de mutação aceitam `idempotency_key` (UUID v4) para evitar operações duplicadas.
- **Desempenho Local (NFR-006):** Consultas locais de clientes e produtos com tempo de resposta inferior a 2 segundos (p95) em massa de até 1.000 produtos e 500 clientes.
- **Acessibilidade e Usabilidade (NFR-004, NFR-005):** Interface mobile-first (a partir de 360px) e desktop (1280px+), contrastes de alto nível (>= 10:1), tamanho de fonte legível (>= 15px/17px) e alvos de toque de no mínimo 48x48px.

## Technical Decisions

- **Arquitetura Modular Monolith (Clean/Hexagonal Architecture):**
  - `packages/core`: Entidades puras, regras de negócio invariantes, value objects (`Centavos`, `StatusEstoque`) sem dependência de frameworks.
  - `packages/server`: Backend Node.js com Fastify 5, repositórios Prisma com SQLite (`better-sqlite3`), middleware/extensão de isolamento por `operacao_id`, hub WebSocket para pareamento de leitor.
  - `packages/web`: Frontend React 19 + Vite com Tailwind CSS (tokens do `DESIGN.md`), PWA responsivo.
- **Isolamento no Banco:** Extensão do Prisma Client que injeta obrigatoriamente cláusula `where: { operacao_id }` em consultas e associa `operacao_id` em criações.
- **Autenticação e Sessão Operacional:** Sessão simples local com seleção/login de operador, gerando cookie/token de sessão contendo `operacao_id`, `operador_id` e `operador_nome`.
- **Pareamento WebSocket Efêmero (AD-6, NFR-011):** Comunicação celular-computador por canal WebSocket com código de pareamento temporário (TTL 10 min), sem expor rotas do banco de dados na URL de pareamento.

## UX & Interaction Patterns

- **Design Tokens (UX-DR1):** Paleta de superfícies acolhedoras (`surface-base: #FBF9F6`, `surface-raised: #FFFFFF`), tintas legíveis (`ink-primary: #1F1E1C`), marca (`brand-primary: #BD5338`), status semânticos e tipografia `Plus Jakarta Sans`.
- **Gaveta Rápida de Cliente (UX-DR4):** Slide-over acionável em qualquer ponto com apenas 2 campos (Nome obrigatório e Telefone opcional), sem perda de contexto ou reset do fluxo em andamento.
- **Visor Híbrido Zero Cliques (UX-DR2):** Câmera auto-iniciada com áudio de confirmação suave (*bip*), fallback manual imediato por digitação e debounce de 1,5s anti-duplicação.
- **Sticky Actions (UX-DR7):** Barra de ação principal fixada na base inferior da viewport móvel com 48px de altura de toque.

## Cross-Story Dependencies

- Story 1.1 é o alicerce fundamental de infraestrutura e isolamento (`operacao_id`, sessão e estrutura de monorepo); todas as histórias subsequentes (1.2 a 1.6 e épicos 2 a 5) dependem diretamente dela.
- Story 1.2 (Clientes) e Story 1.3 (Catálogo) fornecem as entidades básicas para o estoque inicial (Story 1.4) e as rotinas de conferência e venda dos Épicos 2, 3 e 4.
