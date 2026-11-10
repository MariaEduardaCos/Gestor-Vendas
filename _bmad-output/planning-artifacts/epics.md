---
status: final
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/prd.md
  - _bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/primeiro-teste.md
  - _bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/decisoes.md
  - _bmad-output/planning-artifacts/architecture/architecture-consultorasync-2026-11-10/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/architecture/architecture-consultorasync-2026-11-10/solution-design-tcc.md
  - _bmad-output/planning-artifacts/ux-designs/ux-consultorasync-2026-11-10/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-consultorasync-2026-11-10/EXPERIENCE.md
---

# Prototipo TCC (ConsultoraSync) - Epic Breakdown

## Overview

Este documento fornece a decomposição completa de épicos e histórias de usuário para o **ConsultoraSync** no escopo do **Primeiro Teste Funcional (Etapa T1)**, integrando os requisitos do PRD, as decisões normativas de Arquitetura e os contratos visuais e de interação de UX Design.

---

## Requirements Inventory

### Functional Requirements

- **FR-001**: Identificação de quem opera — Permitir acesso individual da revendedora e de familiares autorizados à mesma operação, distinguindo-os de outras operações; cada venda, recebimento, entrega e pagamento identifica quem confirmou; sem sessão não se consultam contas.
- **FR-002**: Limites por operação — Restringir consultas e alterações à operação autorizada, inclusive em buscas por código e pareamento; sessão de outra operação não acessa dados alheios mesmo conhecendo identificadores.
- **FR-003**: Cadastro de clientes — Cadastrar e editar nome obrigatório, telefone e endereço opcionais; buscar por nome ou telefone; homônimos recebem identificadores distintos; clientes com vendas não são apagados.
- **FR-004**: Perfil do cliente — Mostrar histórico de encomendas, entregas, contas separadas, pagamentos e créditos do cliente; selecionar conta exibe itens e saldo específico.
- **FR-006**: Produto e variante — Cadastrar nome, marca, variante quando aplicável, código de barras opcional e preço de venda definido; manter identificador interno independente do código; variantes distintas não são mescladas.
- **FR-007**: Leitura de código — Localizar produto cadastrado pelo código lido na chegada ou venda e permitir digitação ou busca por nome; falha na câmera não bloqueia fluxo manual; leitura isolada não confirma transação.
- **FR-008**: Código não cadastrado — Oferecer cadastro manual na leitura de código desconhecido; sugestões editáveis antes de salvar; produto não encontrado permite continuar manualmente.
- **FR-009**: Evitar leituras duplicadas — Exigir confirmação de quantidade; repetições da câmera sobre o mesmo código não somam unidades silenciosamente; manter código no enquadramento não cria várias unidades.
- **FR-010**: Preço de venda — Permitir definir preço pela revista, referência conferida ou manual, preservando o valor até alteração explícita; mudança externa não altera preços salvos.
- **FR-011**: Percentual por marca — Cadastrar percentual sobre o preço definido e calcular custo estimado (D-01); percentual ausente mantém custo desconhecido; alteração não altera vendas passadas.
- **FR-012**: Proveniência de custo — Permitir custo informado com fonte declarada ou estimativa por marca; manter desconhecido quando não houver dado; custo estimado identificado no histórico.
- **FR-013**: Estoque inicial — Permitir contagem inicial por produto, confirmando quantidade, preço e origem de custo sem criar compra fictícia à marca.
- **FR-014**: Leitor pareado — Permitir parear celular a uma sessão autorizada no computador para enviar códigos via WebSocket, sem expor dados no endereço de pareamento; expiração e desconexão visíveis.
- **FR-015**: Encomenda por cliente — Registrar cliente, produtos, quantidades positivas, preço unitário e data; vincular itens à futura compra à marca; encomendas separadas mesmo em compra conjunta; quantidade esperada não altera estoque físico.
- **FR-016**: Confirmação da conta — Criar conta ao confirmar encomenda ou venda, preservando valores da transação; rascunho não entra no valor a receber; itens aguardados entram no total da conta sem gerar estoque físico.
- **FR-017**: Compra à marca — Registrar manualmente marca, referência opcional, data, itens para clientes e itens de pronta-entrega; marcar rascunho ou pedido registrado sem afirmar envio automático.
- **FR-018**: Vínculos e recebimentos — Acompanhar quantidades pedidas, recebidas, destinadas, entregues e canceladas sem misturar estados financeiros; não marcar como entregue item não recebido.
- **FR-019**: Preço histórico — Fixar na confirmação os valores e parâmetros de custo da transação; alteração posterior de produto ou percentual afeta apenas novas transações.
- **FR-020**: Conferência de chegada — Abrir conferência por ação própria e apresentar itens pedidos, quantidades esperadas e quantidade recebida editável; confirmação entra no estoque; quantidade negativa ou excedente recusada.
- **FR-021**: Recebimento parcial — Permitir várias chegadas para uma mesma compra, mantendo pendente o que falta sem duplicar chegadas anteriores.
- **FR-022**: Destinação quando falta — Exigir escolha explícita da revendedora entre clientes quando as unidades recebidas não atendem a todas as encomendas; encomendas não atendidas continuam aguardando.
- **FR-023**: Reserva física — Reservar unidades recebidas para encomendas escolhidas, impedindo consumo em outra conta; Presentes = Reservados + ProntaEntrega.
- **FR-024**: Item não entregável — Cancelar quantidade pendente quando a marca confirmar falta definitiva; reduzir o total da conta preservando histórico; se já pago, gerar valor a devolver ou creditar.
- **FR-025**: Consulta do estoque — Buscar produto por código, nome ou marca exibindo preço e quantidades: presentes, reservadas e pronta-entrega (disponíveis); coerência celular/computador.
- **FR-026**: Reserva na venda — Ao confirmar venda de pronta-entrega ainda não retirada, reservar unidades para essa venda; concorrência pela última unidade não confirma ambas.
- **FR-027**: Saída na entrega — Dar saída física apenas na confirmação da entrega ao cliente, consumindo a reserva correspondente sem gerar saída dupla.
- **FR-028**: Entrega parcial — Permitir retirada parcial de encomenda somente quando a chegada estiver incompleta, registrando itens retirados e mantendo pendentes.
- **FR-029**: Cancelamento e reserva — Cancelar quantidades não entregues com motivo; liberação da reserva física para pronta-entrega após confirmação explícita (D-09).
- **FR-030**: Ajuste e correção — Permitir ajuste justificado de contagem de estoque, preservando histórico e impedindo reduzir presentes abaixo das reservas válidas sem resolução prévia.
- **FR-031**: Estado de entrega — Mostrar status: aguardando chegada, disponível para retirada, parcialmente entregue, entregue ou cancelado, independente da situação de pagamento.
- **FR-032**: Saldo por compra — Mostrar total válido da compra, pagamentos confirmados (sem deduzir taxas do saldo do cliente), créditos aplicados e saldo devedor por conta individual (D-04).
- **FR-033**: Visão sem pendentes — Exibir cálculo alternativo para itens já recebidos e saldo projetado (D-05) sem criar segunda conta contábil.
- **FR-034**: Registrar pagamento — Selecionar conta, valor positivo, data, meio (Pix, dinheiro, cartão) e operador; confirmar pagamento parcial ou total com trava de valor excessivo.
- **FR-035**: Cartão e taxa — Registrar valor bruto quitado pelo cliente, taxa da máquina absorvida pela revendedora e valor líquido recebido; taxa maior que o pagamento é recusada.
- **FR-036**: Datas e situação — Conta sem vencimento não mostra atraso; pagamentos registrados na data efetiva; status aberta, parcialmente paga ou quitada.
- **FR-037**: Correção de pagamento — Corrigir por estorno rastreável com responsável/motivo e novo lançamento; recalcular saldo respeitando créditos ou devoluções dependentes.
- **FR-038**: Excedente por cancelamento — Ao cancelar item pago, manter valor pago excedente identificado e pendente de resolução mandatória entre devolução e crédito.
- **FR-039**: Devolução financeira — Registrar valor, data, motivo e responsável por devolver excedente em dinheiro/Pix, consumindo a pendência.
- **FR-040**: Crédito de cliente — Converter excedente em crédito na carteira do cliente; aplicar crédito em compras futuras do mesmo cliente; crédito intransferível entre clientes.
- **FR-041**: Separar venda e recebimento — Consultar valor vendido, recebido, a receber, devolvido e crédito sem misturá-los ou apresentá-los prematuramente como ganho.

---

### NonFunctional Requirements

- **NFR-001 — Consistência e Idempotência**: Confirmar venda, reserva, entrega e pagamento com todos os efeitos ou nenhum; repetição de requisição não duplica fatos através de `idempotency_key` (UUID v4) e bloqueio de concorrência na última unidade.
- **NFR-002 — Privacidade e Isolamento**: Sessão de uma operação não consulta nem altera dados de outra; toda tabela e query filtra obrigatoriamente por `operacao_id`; não expor dados sensíveis em URLs ou consultas externas.
- **NFR-003 — Rastreabilidade Nominal**: Toda alteração confirmada registra `operador_id`, `operador_nome`, data/hora UTC ISO-8601, motivo em correções e vínculo à entidade original. Rascunhos descartados não geram registros contábeis.
- **NFR-004 — Uso em Telas Diferentes**: Interface responsiva operável em celular a partir de 360 px de largura e computador a partir de 1280 px sem corte de botões principais; alternativas manuais completas para câmera e leitor.
- **NFR-005 — Acessibilidade e Legibilidade**: Foco no público 40+ anos: textos com tamanho mínimo de 15px (17px para leitura contínua), contraste superior a 10:1 (`#1F1E1C` sobre `#FBF9F6`), áreas de toque mínimas de 48x48px, campos com rótulos e mensagens associadas, e status nunca baseado unicamente em cor.
- **NFR-006 — Resposta Local**: Busca interna e confirmação de operações em até 2 segundos no percentil 95 para massa de 1.000 produtos e 500 clientes em ambiente local.
- **NFR-007 — Tratamento de Falhas Externas**: Consultas externas possuem timeout estrito (máximo 8s) com fallback manual imediato; erros externos nunca confirmam operações pela metade.
- **NFR-008 — Conectividade e Queda de Rede**: Exigência de conexão no primeiro teste, mas sem envios repetidos; banner claro de perda de conexão; proteção contra submissão duplicada em reconexão.
- **NFR-009 — Preservação e Recuperação Local**: Persistência íntegra em SQLite com Prisma ORM; capacidade de exportação e recuperação de cópia de backup do banco de dados local.
- **NFR-010 — Precisão e Moeda**: Todos os valores monetários armazenados em **centavos inteiros** (`INTEGER`) para evitar erros de ponto flutuante; exibição formatada com 2 casas decimais e R$; estado desconhecido tratado como `NULL` e exibido como "Desconhecido", nunca como 0,00.
- **NFR-011 — Câmera e Pareamento Seguro**: Acesso à câmera sob contexto seguro (HTTPS ou localhost); permissão explícita; canal WebSocket de pareamento com token aleatório efêmero (TTL de 10 minutos) e sem exposição de rotas operacionais.
- **NFR-012 — Custo Zero e Operação Local-First**: Arquitetura monorepo TypeScript executável localmente sem custos de infraestrutura paga (Fastify + SQLite + Vite/React), pronta para execução em testes de bancas e feiras.

---

### Additional Requirements (Architecture)

- **Template Inicial & Greenfield Setup**: Estrutura monorepo monólito modular TypeScript com três pacotes:
  - `packages/core`: Entidades de domínio puras, objetos de valor (`Centavos`, `StatusEstoque`, etc.) e regras invariantes limpas sem dependências externas.
  - `packages/server`: Backend Fastify, rotas REST, repositórios Prisma com SQLite (`better-sqlite3`), hub WebSocket para pareamento de leitor e middleware de isolamento por `operacao_id`.
  - `packages/web`: Frontend React 19 + Vite com Tailwind CSS, PWA responsivo (mobile-first), leitor por câmera com `html5-qrcode`.
- **Invariante de Conservação de Estoque**: `Presentes = Reservados + ProntaEntrega`. Nenhuma operação de estoque pode violar esta igualdade ou permitir estoque presente menor que a quantidade reservada (AD-3).
- **Projeção de Contas**: A "Visão Sem Itens Aguardados" é uma projeção calculada em tempo de consulta (subtrai itens com status `AGUARDANDO_FABRICA` do total da conta), e não uma segunda tabela ou conta contábil (AD-4).
- **Excedente e Carteira de Crédito**: Modelo explícito de `ExcedentePendente` gerado quando cancelamento ocorre em conta com pagamento efetuado; conversão estrita em `DevolucaoFinanceira` ou `CarteiraCredito` do mesmo cliente (AD-5).
- **Identificadores e Idempotência**: Utilização de `UUID v7` como chave primária de todas as entidades e `idempotency_key` (UUID v4) em todas as rotas de mutação (AD-7).

---

### UX Design Requirements

- **UX-DR1 — Tokens de Design e Identidade Visual Acolhedora**: Implementação completa das variáveis de design tokens em Tailwind CSS: paleta de superfícies (`surface-base: #FBF9F6`, `surface-raised: #FFFFFF`, `surface-accent: #FDF2EC`), tintas (`ink-primary: #1F1E1C`, `ink-secondary: #5C5852`), marca (`brand-primary: #BD5338`), status semânticos (Disponível verde `#1B7340`, Reservado âmbar `#B26200`, Aguardado azul `#2C5E8A`, Alerta vermelho `#A32224`) e tipografia `Plus Jakarta Sans`.
- **UX-DR2 — Visor de Leitura Híbrido com Auto-Start (Zero Cliques)**: Componente de câmera na metade superior das telas operacionais (Conferência de Caixa, Venda, Leitor) com abertura automática sem necessidade de clique prévio, modo contínuo de leitura ("passar e bipar"), som de confirmação suave (*bip*), campo inferior imediato para digitação manual/código e debounce anti-duplicação de 1,5s.
- **UX-DR3 — Cartão de Item com Pílulas Coloridas Multistatus**: Componente de exibição de produto com contadores destacados: *Presentes* (verde), *Reservados* (âmbar), *Pronta-Entrega* (verde) e *Aguardados* (azul), acompanhados sempre de texto explicativo e ícone para garantir independência de cores.
- **UX-DR4 — Gaveta Rápida de Cadastro de Cliente (Slide-over)**: Drawer lateral/inferior de cadastro com apenas dois campos: Nome Completo (obrigatório com auto-focus) e Telefone (opcional com máscara de WhatsApp), acionável em qualquer ponto sem perder o fluxo ou dados da venda/conferência em andamento.
- **UX-DR5 — Modal Interativo de Destinação Obrigatória**: Diálogo em destaque acionado imediatamente na leitura de item da caixa que possui encomendas pendentes: exibe botões grandes com nomes das clientes aguardando para alocação direta ou opção de destinar à pronta-entrega.
- **UX-DR6 — Alternador de Visão de Conta (Toggle Simples)**: Controle no topo do extrato da cliente alternando entre `[ Conta Completa: R$ X ]` e `[ Apenas o que Já Chegou: R$ Y ]`, com texto explicativo acolhedor que esclarece a cobrança.
- **UX-DR7 — Sticky Bottom Action Bar e Touch Target 48px**: Barra de ação primária fixa na base da tela móvel ocupando 100% da largura, altura mínima de toque de 48px e espaçamento mínimo de 12px entre ações concorrentes para prevenir toques acidentais.
- **UX-DR8 — Modal de Resolução de Excedente Financeiro**: Interface com escolha direta entre `[ Devolver em Dinheiro / PIX ]` e `[ Deixar como Crédito para Próximas Compras ]`, com cálculo e feedback visual instantâneo do saldo da cliente.
- **UX-DR9 — Tela de Pareamento com QR Code e Página Leve do Leitor**: Interface web para computador exibindo QR Code de pareamento efêmero e página mobile minimalista que abre diretamente em tela cheia na câmera, operando unicamente como leitor sem expor outros dados.

---

### FR Coverage Map

- **FR-001**: Épico 1 — Identificação nominal de quem opera na sessão
- **FR-002**: Épico 1 — Limites e isolamento estrito por operação
- **FR-003**: Épico 1 — Cadastro e edição de clientes (inclusive gaveta rápida)
- **FR-004**: Épico 1 — Ficha e perfil individual da cliente
- **FR-006**: Épico 1 — Cadastro de produtos e variantes com código opcional
- **FR-007**: Épico 1 — Leitura de código de barras com fallback manual
- **FR-008**: Épico 1 — Tratamento de código não cadastrado
- **FR-009**: Épico 1 — Filtro anti-duplicação de leitura (debounce)
- **FR-010**: Épico 1 — Fixação do preço de venda do produto
- **FR-011**: Épico 1 — Percentual padrão por marca e cálculo de custo
- **FR-012**: Épico 1 — Proveniência e preservação de custo imutável
- **FR-013**: Épico 1 — Lançamento e contagem de estoque inicial
- **FR-014**: Épico 1 — Pareamento de leitor de código via WebSocket celular-computador com feedback de conexão transparente
- **FR-015**: Épico 2 — Registro de encomendas por cliente
- **FR-016**: Épico 2 — Confirmação de conta individual da encomenda
- **FR-017**: Épico 2 — Registro de compra à marca (clientes + pronta-entrega)
- **FR-018**: Épico 2 — Rastreio de vínculos de quantidade pedida
- **FR-019**: Épico 2 — Congelamento histórico de preços e custos na transação
- **FR-020**: Épico 3 — Abertura e conferência de caixa da fábrica com proteção idempotente contra queda de rede
- **FR-021**: Épico 3 — Tratamento de recebimento parcial de compras
- **FR-022**: Épico 3 — Pergunta mandatória de destinação quando faltam unidades
- **FR-023**: Épico 3 — Criação de reserva física vinculada ao cliente
- **FR-024**: Épico 3 — Cancelamento de item não entregável pela marca com geração de obrigação contábil
- **FR-025**: Épico 4 — Consulta de estoque com contadores (presentes, reservados, disponíveis)
- **FR-026**: Épico 4 — Reserva de pronta-entrega na venda balcão com bloqueio atômico de concorrência
- **FR-027**: Épico 4 — Saída física apenas na entrega confirmada
- **FR-028**: Épico 4 — Entrega parcial de itens já recebidos
- **FR-029**: Épico 4 — Cancelamento com liberação de reserva para pronta-entrega
- **FR-030**: Épico 4 — Ajuste justificado de contagem com trava obrigatória contra redução abaixo de reservas ativas
- **FR-031**: Épico 4 — Estados explícitos de entrega (aguardando, disponível, entregue)
- **FR-032**: Épico 5 — Saldo por compra individual sem misturar contas
- **FR-033**: Épico 5 — Projeção da "Visão Sem Itens Aguardados"
- **FR-034**: Épico 5 — Registro de pagamentos (Pix, dinheiro, cartão)
- **FR-035**: Épico 5 — Registro de taxa de cartão absorvida sem lesar o saldo do cliente
- **FR-036**: Épico 5 — Situações de conta e datas de pagamento
- **FR-037**: Épico 5 — Estorno auditado de pagamento com recalculo de saldo
- **FR-038**: Épico 5 — Identificação de excedente por cancelamento de compra paga
- **FR-039**: Épico 5 — Devolução financeira do excedente em dinheiro/Pix
- **FR-040**: Épico 5 — Conversão de excedente em crédito e uso na carteira do cliente
- **FR-041**: Épico 5 — Segregação de indicadores de venda, recebimento e ganho

---

## Epic List

### Epic 1: Fundação Operacional, Clientes e Catálogo com Visor de Leitura
A revendedora acessa sua operação com sessão isolada, cadastra e localiza clientes com rapidez (inclusive via gaveta rápida), organiza produtos e variantes com preços e percentuais de marca, estabelece estoque inicial e conta com o visor de leitura de código de barras (com auto-start, debounce anti-duplicação e leitor pareado no computador com status de conexão transparente).
- **FRs cobertos:** FR-001, FR-002, FR-003, FR-004, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014 (13 FRs).
- **Invariantes e Diretrizes:** AD-1 (isolamento e operador), AD-2 (imutabilidade de custo e custo desconhecido), AD-6 (pareamento efêmero sem login), NFR-002, NFR-004, NFR-005, NFR-010, NFR-011; UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR9.

### Epic 2: Encomendas de Clientes e Registro de Compra à Marca
A revendedora anota encomendas solicitadas por clientes específicos, gera suas respectivas contas sem criar falso estoque físico, e consolida os pedidos em uma compra da marca (separando o que é de cada cliente e o que é para pronta-entrega), com congelamento imutável de preço e custo histórico.
- **FRs cobertos:** FR-015, FR-016, FR-017, FR-018, FR-019 (5 FRs).
- **Invariantes e Diretrizes:** AD-2 (congelamento histórico no ato da confirmação), NFR-001, NFR-003, NFR-010; Superfície S7.

### Epic 3: Conferência de Caixa da Fábrica, Destinação Obrigatória e Conservação do Estoque
A revendedora confere a caixa de papelão da marca recebida via câmera contínua (*passar e bipar*) com proteção de idempotência contra instabilidades de rede. O sistema exige a destinação mandatória de cada item recebido para a cliente que encomendou (criando reserva nominal) ou para a pronta-entrega, suporta recebimentos parciais, trata faltas comunicadas pela fábrica com ajuste do pedido e emissão de evento de obrigação contábil, e assegura a invariante física: `Presentes = Reservados + ProntaEntrega`.
- **FRs cobertos:** FR-020, FR-021, FR-022, FR-023, FR-024 (5 FRs).
- **Invariantes e Diretrizes:** AD-3 (conservação de estoque), AD-7 (idempotência), NFR-001, NFR-008; UX-DR5 (modal interativo de destinação imediata), Jornada 1 do UX.

### Epic 4: Atendimento de Vendas, Reservas e Saída Física na Entrega
A revendedora consulta o catálogo com marcadores visuais de presentes/reservados/pronta-entrega, realiza vendas de pronta-entrega (com reserva concorrente e bloqueio atômico de estoque insuficiente), efetua entregas parciais ou totais (com baixa física dos produtos presentes apenas na confirmação da entrega), cancela itens com liberação de reserva para pronta-entrega e realiza ajustes justificados de inventário (com trava impeditiva de redução abaixo de reservas ativas).
- **FRs cobertos:** FR-025, FR-026, FR-027, FR-028, FR-029, FR-030, FR-031 (7 FRs).
- **Invariantes e Diretrizes:** AD-3 (conservação estrita e saída apenas na entrega), AD-7 (bloqueio de concorrência), NFR-001, NFR-004; Superfície S8, Jornada 3 do UX.

### Epic 5: Gestão de Contas, Cobrança Transparente, Pagamentos e Resolução de Excedentes
A revendedora acompanha o saldo de cada compra individualmente, utiliza a "Visão Sem Itens Aguardados" para cobrar apenas o que a cliente já pode levar para casa, registra pagamentos em dinheiro/Pix/cartão (absorvendo taxas da máquina sem penalizar o saldo da cliente), realiza estornos auditados e resolve com transparência cancelamentos de compras quitadas, permitindo devolver o dinheiro em centavos exatos ou converter em crédito intransferível na carteira do cliente.
- **FRs cobertos:** FR-032, FR-033, FR-034, FR-035, FR-036, FR-037, FR-038, FR-039, FR-040, FR-041 (11 FRs).
- **Invariantes e Diretrizes:** AD-4 (projeção em tempo de consulta sem duplicação de conta), AD-5 (excedente pendente e carteira de crédito), NFR-001, NFR-003, NFR-010 (centavos inteiros); UX-DR6 (toggle de visão de conta), UX-DR8 (modal de resolução de excedente), Jornada 4 do UX.



---

## Epic 1: Fundação Operacional, Clientes e Catálogo com Visor de Leitura

A revendedora acessa sua operação com sessão isolada, cadastra e localiza clientes com rapidez (inclusive via gaveta rápida), organiza produtos e variantes com preços e percentuais de marca, estabelece estoque inicial e conta com o visor de leitura de código de barras (com auto-start, debounce anti-duplicação e leitor pareado no computador com status de conexão transparente).

### Story 1.1: Inicialização do Monorepo, Sessão Operacional e Isolamento Multi-inquilino

As a revendedora ou familiar autorizado,
I want acessar minha operação com login individual identificado pelo meu nome,
So that todas as minhas ações sejam registradas com meu nome e nenhuma outra operação acesse meus clientes ou estoque.

**Acceptance Criteria:**

**Given** o monorepo TypeScript inicializado (`packages/core`, `packages/server` com Fastify e Prisma/SQLite, `packages/web` com Vite/React/Tailwind e tokens de `DESIGN.md`),
**When** um usuário realiza login com suas credenciais de operador,
**Then** uma sessão segura com `operacao_id`, `operador_id` e `operador_nome` é estabelecida,
**And** todas as consultas e mutações ao banco aplicam filtro estrito por `operacao_id`, impedindo acesso a dados de outra operação mesmo que os IDs sejam conhecidos (FR-001, FR-002, AD-1, NFR-002).

**Given** uma usuária autenticada como "Dona Sônia",
**When** qualquer registro ou transação for confirmado no sistema,
**Then** a resposta e o registro no banco incluem `operador_id` e `operador_nome` com timestamp ISO-8601 UTC (NFR-003).

### Story 1.2: Cadastro, Edição e Ficha de Clientes com Gaveta Rápida

As a revendedora,
I want cadastrar clientes pelo formulário completo ou por uma gaveta rápida sem sair da tela em andamento, e consultar suas fichas históricas,
So that eu nunca perca o foco durante uma venda ou encomenda e mantenha o histórico das clientes organizado.

**Acceptance Criteria:**

**Given** que a revendedora está na tela de Clientes (S2),
**When** ela cadastra um cliente com Nome (obrigatório), Telefone (opcional com máscara) e Endereço (opcional),
**Then** o cliente é salvo com identificador único UUID v7,
**And** a busca instantânea localiza o cliente por nome ou telefone em menos de 2 segundos (FR-003, NFR-006).

**Given** que a revendedora está em qualquer fluxo operacional (como venda ou encomenda),
**When** ela toca no botão `+ Nova Cliente`,
**Then** uma gaveta lateral/inferior (S3) se abre com foco no Nome e campo de Telefone,
**And** ao salvar, a gaveta fecha, o cliente recém-criado é selecionado automaticamente e o fluxo em andamento não é reiniciado (UX-DR4).

**Given** dois clientes cadastrados com o mesmo nome ("Maria Silva"),
**When** a revendedora consulta a lista ou ficha,
**Then** cada registro mantém identificador interno distinto e exibe telefone/endereço para diferenciação,
**And** a ficha exibe histórico de contas, itens encomendados, entregues e saldo da carteira de crédito (FR-003, FR-004).

### Story 1.3: Catálogo de Produtos, Variantes, Preço de Venda e Custo por Marca

As a revendedora,
I want cadastrar produtos, marcas, variantes, definir preços de venda e percentuais de desconto da marca,
So that o sistema calcule automaticamente o custo estimado quando aplicável e mantenha a proveniência de custo preservada.

**Acceptance Criteria:**

**Given** que a revendedora cadastra um produto com Marca, Nome, Preço de Venda (em centavos inteiros), Código de Barras EAN (opcional) e Variante (ex: "Algodão 400ml"),
**When** o produto é salvo,
**Then** ele recebe um ID interno independente do código de barras e variantes distintas não são agrupadas (FR-006, NFR-010).

**Given** um produto cadastrado com preço de venda R$ 100,00 e uma marca cadastrada com percentual de lucro de 30%,
**When** o custo estimado for calculado,
**Then** o sistema registra custo estimado de R$ 70,00 com proveniência `ESTIMADO_PERCENTUAL` (FR-011, D-01).

**Given** um produto cadastrado sem percentual de marca associado e sem custo manual informado,
**When** a consulta do produto for realizada,
**Then** o campo de custo é armazenado como `NULL` e exibido como "Desconhecido", sendo terminantemente proibido gravar 0,00 ou presumir percentuais (FR-012, AD-2).

### Story 1.4: Lançamento de Estoque Inicial por Produto

As a revendedora,
I want registrar a contagem inicial dos produtos que já possuo na minha estante física,
So that meu estoque comece com os saldos reais sem necessidade de simular pedidos de fábrica falsos.

**Acceptance Criteria:**

**Given** um produto cadastrado no catálogo,
**When** a revendedora informa uma quantidade positiva (ex: 5 unidades), o preço unitário e a origem de custo, e confirma o estoque inicial,
**Then** o saldo de `Presentes` e `ProntaEntrega` é incrementado em 5 unidades uma única vez,
**And** a operação é registrada com tipo `ESTOQUE_INICIAL`, sem criar vínculo com compras da marca (FR-013, AD-3).

**Given** uma digitação em andamento de contagem inicial,
**When** a revendedora sai da tela ou cancela antes de confirmar,
**Then** nenhuma unidade é adicionada ao estoque físico (FR-013).

### Story 1.5: Visor de Leitura Híbrido com Câmera Contínua e Filtro Anti-Duplicação

As a revendedora,
I want bipar códigos de barras pela câmera do celular com abertura automática, modo contínuo e digitação manual alternativa,
So that eu localize produtos instantaneamente sem que a câmera registre o mesmo item várias vezes por acidente.

**Acceptance Criteria:**

**Given** que a usuária acessa uma tela de leitura com permissão concedida,
**When** a tela carrega,
**Then** o visor da câmera (`html5-qrcode`) inicializa automaticamente na metade superior sem necessidade de toque prévio,
**And** ao reconhecer um código de barras, emite bip sonoro suave e seleciona o produto sem travar o visor (FR-007, UX-DR2).

**Given** que um frasco permanece apontado para a câmera,
**When** o código for enquadrado continuamente,
**Then** o sistema aplica uma trava mínima de 1,5s e exige confirmação de quantidade, impedindo que unidades sejam somadas silenciosamente em duplicidade (FR-009, UX-DR2).

**Given** que a câmera lê um código não cadastrado ou a permissão da câmera for negada,
**When** a leitura ocorrer ou a câmera falhar,
**Then** o sistema exibe diálogo imediato para cadastro manual pré-preenchido com o código, ou permite digitação/busca por nome logo abaixo sem travar o app (FR-007, FR-008, NFR-004, UX-DR2).

### Story 1.6: Pareamento Efêmero Celular-Computador com WebSocket e Feedback Visual

As a revendedora que trabalha no computador,
I want apontar meu celular para um QR Code na tela do computador para usá-lo como leitor sem fio imediato,
So that os produtos bipados pelo celular apareçam instantaneamente no computador sem expor meus dados ou exigir login no celular.

**Acceptance Criteria:**

**Given** que a revendedora abre a tela de Leitor no computador,
**When** a sessão é iniciada,
**Then** o servidor gera um token de pareamento com TTL de 10 minutos e o computador exibe um QR Code com a URL efêmera (FR-014, AD-6).

**Given** que a revendedora lê o QR Code com o celular,
**When** a página do celular abre,
**Then** ela inicia diretamente em tela cheia na câmera sem exigir login e sem exibir dados de clientes ou contas, conectando-se ao canal WebSocket efêmero (FR-014, AD-6, UX-DR9).

**Given** a conexão ativa entre o celular e o computador,
**When** o celular bipa um código,
**Then** o evento de bip chega ao computador em tempo real,
**And** tanto o computador quanto o celular exibem indicador visual transparente do status da conexão ("Conectado", "Reconectando" ou "Sessão Expirada com botão de renovar em 1 toque") (FR-014, UX-DR9, Refinamento Elicitação).


---

## Epic 2: Encomendas de Clientes e Registro de Compra à Marca

A revendedora anota encomendas solicitadas por clientes específicos, gera suas respectivas contas sem criar falso estoque físico, e consolida os pedidos em uma compra da marca (separando o que é de cada cliente e o que é para pronta-entrega), com congelamento imutável de preço e custo histórico.

### Story 2.1: Registro de Encomenda Individual por Cliente e Criação da Conta

As a revendedora,
I want registrar os produtos que uma cliente encomendou comigo antes de eu passar o pedido na fábrica,
So that o pedido fique formalmente anotado na ficha da cliente e gere sua conta sem alterar meu estoque físico atual.

**Acceptance Criteria:**

**Given** uma cliente selecionada e produtos escolhidos do catálogo,
**When** a revendedora informa quantidades positivas e confirma a encomenda,
**Then** os itens são gravados com status de entrega `AGUARDANDO_FABRICA`,
**And** nenhuma unidade é adicionada ao estoque de `Presentes` ou `ProntaEntrega` (FR-015, AD-3).

**Given** a confirmação da encomenda,
**When** a transação é concluída,
**Then** uma conta individual (`ContaCliente`) é criada contendo os itens encomendados e o valor total devido,
**And** rascunhos não finalizados são descartados sem gerar contas ou saldos a receber (FR-016, NFR-003).

### Story 2.2: Consolidação da Compra à Marca e Separação entre Clientes e Pronta-Entrega

As a revendedora,
I want agrupar as encomendas de diferentes clientes junto com itens que desejo para a minha pronta-entrega em um registro de Compra à Marca,
So that eu saiba exatamente o que pedir no site/revista da marca sem misturar a quem pertence cada produto.

**Acceptance Criteria:**

**Given** que existem encomendas pendentes de envio de diferentes clientes (ex: Ana encomendou 1 hidratante e Bia encomendou 1 hidratante),
**When** a revendedora cria uma `CompraMarca` e adiciona itens extras para pronta-entrega (ex: +1 hidratante),
**Then** o sistema gera o espelho do pedido da marca com 3 hidratantes no total,
**And** preserva o vínculo nominal estrito de que 1 é da Ana, 1 é da Bia e 1 é de pronta-entrega (FR-015, FR-017, FR-018).

**Given** a compra registrada no sistema,
**When** a revendedora salva o registro,
**Then** a compra recebe o status `PEDIDO_REGISTRADO`,
**And** a interface deixa explícito que o registro local não envia nem afirma que o pedido foi transmitido à fábrica (FR-017).

### Story 2.3: Imutabilidade e Congelamento de Preço de Venda e Custo Histórico

As a revendedora,
I want que os preços de venda e os parâmetros de custo fiquem congelados no momento em que a encomenda/compra é confirmada,
So that alterações futuras de catálogo na revista não modifiquem os valores acordados em contas passadas.

**Acceptance Criteria:**

**Given** um produto cadastrado com preço R$ 100,00 e percentual de 30% (custo R$ 70,00),
**When** a revendedora confirma uma encomenda/conta,
**Then** o `preco_unitario` (10000 centavos), `custo_unitario` (7000 centavos) e `origem_custo` são gravados de forma imutável nos itens da conta (FR-019, AD-2).

**Given** uma conta confirmada no passado,
**When** o preço do produto no catálogo for alterado para R$ 120,00 ou o percentual da marca mudar para 35%,
**Then** a conta já confirmada continua exibindo rigorosamente o preço de R$ 100,00 e custo original, afetando apenas novas transações futuras (FR-010, FR-019, AD-2).


---

## Epic 3: Conferência de Caixa da Fábrica, Destinação Obrigatória e Conservação do Estoque

A revendedora confere a caixa de papelão da marca recebida via câmera contínua (*passar e bipar*) com proteção de idempotência contra instabilidades de rede. O sistema exige a destinação mandatória de cada item recebido para a cliente que encomendou (criando reserva nominal) ou para a pronta-entrega, suporta recebimentos parciais, trata faltas comunicadas pela fábrica com ajuste do pedido e emissão de evento de obrigação contábil, e assegura a invariante física: `Presentes = Reservados + ProntaEntrega`.

### Story 3.1: Abertura da Conferência de Caixa e Leitura com Idempotência

As a revendedora com a caixa de papelão da marca aberta na mesa,
I want abrir a conferência da compra e bipar os produtos sequencialmente sem medo de queda de internet,
So that as quantidades recebidas sejam registradas de forma confiável e sem duplicidade.

**Acceptance Criteria:**

**Given** uma compra à marca registrada com itens aguardados,
**When** a revendedora toca em "Conferir Caixa da Marca",
**Then** a tela S5 abre com o visor de câmera ativo na metade superior e a lista de itens esperados e quantidades editáveis na metade inferior (FR-020, UX-DR2).

**Given** que a revendedora bipa os itens da caixa,
**When** o lote de conferência for enviado com uma chave `idempotency_key` (UUID v4) gerada pelo cliente e houver uma queda de conexão logo após o envio,
**Then** a repetição do envio com a mesma chave retorna o resultado previamente confirmado sem duplicar as quantidades presentes no banco de dados (FR-020, AD-7, NFR-001, NFR-008).

**Given** uma conferência em andamento,
**When** houver tentativa de confirmar quantidade negativa ou excedente sem ajuste prévio,
**Then** a confirmação é recusada com mensagem de erro clara (FR-020).

### Story 3.2: Modal de Destinação Mandatória e Criação de Reserva Física

As a revendedora conferindo os produtos da caixa,
I want que o sistema me pergunte para qual cliente destinar cada unidade recebida quando houver encomendas,
So that o produto fique reservado com o nome da dona certa e nunca seja vendido por engano para outra pessoa.

**Acceptance Criteria:**

**Given** que existem 2 clientes aguardando o produto (Ana e Bia) e a revendedora bipa a primeira unidade recebida,
**When** o código é reconhecido,
**Then** o sistema exibe imediatamente o modal interativo S6 com botões destacados contendo os nomes das clientes ("Ana" e "Bia"),
**And** ao tocar em "Ana", o frasco é reservado nominalmente para a Ana, mantendo a Bia aguardando a chegada da unidade dela (FR-022, UX-DR5).

**Given** que uma unidade foi bipada e não há mais encomendas pendentes para ela (ou todas já foram atendidas),
**When** o sistema processa a leitura,
**Then** ele informa que não há encomendas aguardando e adiciona a unidade à `ProntaEntrega` (FR-022, UX-DR5).

**Given** a confirmação da conferência,
**When** o saldo do produto é atualizado,
**Then** a regra fundamental `Presentes = Reservados + ProntaEntrega` é satisfeita,
**And** as unidades reservadas não podem ser consumidas em vendas para terceiros (FR-023, AD-3).

### Story 3.3: Recebimento Parcial e Tratamento de Falta da Fábrica

As a revendedora que recebeu apenas uma parte dos produtos pedidos na caixa,
I want registrar recebimentos parciais e cancelar itens que a fábrica comunicou estarem em falta definitiva,
So that meu controle de itens aguardados reflita a realidade e emita a necessidade de ajuste financeiro.

**Acceptance Criteria:**

**Given** um pedido de 3 unidades à marca,
**When** chegam apenas 2 unidades nesta caixa e a conferência é confirmada,
**Then** o estoque registra 2 recebidos e mantém 1 unidade como `AGUARDANDO_FABRICA`,
**And** uma posterior segunda chegada de 1 unidade conclui a pendência sem duplicar as 2 anteriores (FR-021).

**Given** uma encomenda aguardando item que a marca confirmou que não será entregue,
**When** a revendedora marca o item como não entregável com motivo registrado,
**Then** a quantidade pendente de chegada é cancelada sem dar baixa em estoque que nunca chegou,
**And** o total da conta da cliente é reduzido com emissão de evento de obrigação contábil para tratamento de estorno/crédito caso a conta já tenha sido paga (FR-024, Refinamento Elicitação).


---

## Epic 4: Atendimento de Vendas, Reservas e Saída Física na Entrega

A revendedora consulta o catálogo com marcadores visuais de presentes/reservados/pronta-entrega, realiza vendas de pronta-entrega (com reserva concorrente e bloqueio atômico de estoque insuficiente), efetua entregas parciais ou totais (com baixa física dos produtos presentes apenas na confirmação da entrega), cancela itens com liberação de reserva para pronta-entrega e realiza ajustes justificados de inventário (com trava impeditiva de redução abaixo de reservas ativas).

### Story 4.1: Consulta do Estoque com Pílulas Multistatus Coloridas

As a revendedora,
I want pesquisar produtos na tela de estoque e ver claramente quantos frascos tenho em casa, quantos estão reservados para clientes e quantos estão livres para venda,
So that eu nunca prometa um produto que já pertence a outra pessoa e saiba exatamente o que tenho para vender agora.

**Acceptance Criteria:**

**Given** que a revendedora acessa a tela de Catálogo & Gestão de Estoque (S4),
**When** ela pesquisa um produto por código, nome ou marca,
**Then** o cartão do produto (UX-DR3) exibe o preço de venda e 4 contadores com texto, ícone e cores semânticas:
- *Presentes* (verde),
- *Reservados* (âmbar),
- *Pronta-Entrega* (verde),
- *Aguardados da Fábrica* (azul) (FR-025, NFR-005).

**Given** uma consulta efetuada no celular e outra no computador,
**When** o mesmo produto for visualizado,
**Then** ambas as telas exibem rigorosamente os mesmos números consolidados do banco SQLite local (FR-025, NFR-004).

### Story 4.2: Venda de Pronta-Entrega com Bloqueio de Concorrência e Reserva na Venda

As a revendedora atendendo uma cliente no balcão ou WhatsApp,
I want selecionar produtos da pronta-entrega e confirmar a venda mesmo que a cliente vá retirar mais tarde,
So that as unidades fiquem imediatamente reservadas e duas pessoas não consigam vender a mesma última unidade ao mesmo tempo.

**Acceptance Criteria:**

**Given** que a revendedora seleciona um produto com 2 unidades em pronta-entrega para uma cliente na tela Nova Venda (S8),
**When** a venda é confirmada com retirada posterior,
**Then** o sistema reserva as unidades para essa venda (`reservados += 2`), mantendo o número de `Presentes` inalterado (FR-026, AD-3).

**Given** que resta apenas 1 unidade de um batom na pronta-entrega,
**When** duas pessoas/sessões tentam confirmar a venda da última unidade simultaneamente,
**Then** a primeira confirmação tem sucesso e reserva a unidade,
**And** a segunda requisição é recusada de forma atômica com aviso amigável: *"Você tem apenas 1 unidade na pronta-entrega que acabou de ser reservada"*, sem gerar contas órfãs (FR-026, AD-7, NFR-001).

### Story 4.3: Confirmação de Entrega Física (Total e Parcial) com Baixa do Estoque

As a revendedora entregando a sacola de cosméticos na mão da cliente,
I want confirmar a entrega física no app,
So that o sistema dê a baixa real dos frascos presentes e liquide a reserva correspondente sem gerar saída dupla.

**Acceptance Criteria:**

**Given** uma conta com itens reservados (`Presentes: 2, Reservados: 2`),
**When** a revendedora toca em "Confirmar Entrega ao Cliente",
**Then** o sistema debita os produtos presentes (`Presentes: 0, Reservados: 0`),
**And** o status de entrega da conta muda para `ENTREGUE`, sem gerar saída física duplicada (FR-027, FR-031, AD-3).

**Given** uma venda de pronta-entrega em que a cliente já está levando o item na hora,
**When** a revendedora seleciona "Entrega Imediata",
**Then** a reserva e a saída física ocorrem em uma única operação transacional atômica coerente (FR-027, AD-3).

**Given** uma encomenda de 2 produtos em que apenas 1 chegou da fábrica e foi reservado,
**When** a cliente busca o item disponível,
**Then** a revendedora consegue confirmar a retirada parcial de 1 unidade, mantendo a outra unidade como `AGUARDANDO_FABRICA` e o estado da conta como `PARCIALMENTE_ENTREGUE` (FR-028, FR-031).

### Story 4.4: Cancelamento com Liberação de Reserva e Ajuste Justificado de Inventário

As a revendedora,
I want cancelar itens não entregues liberando as reservas para pronta-entrega e realizar ajustes justificados de inventário com trava de segurança,
So that meu estoque físico fique correto sem permitir que eu reduza acidentalmente produtos já comprometidos com clientes.

**Acceptance Criteria:**

**Given** uma cliente que desistiu de um produto que já havia chegado e estava reservado,
**When** a revendedora cancela o item com motivo informado,
**Then** a reserva física é liquidada e a unidade é transferida imediatamente para `ProntaEntrega` disponível, mantendo o total de `Presentes` inalterado (FR-029, D-09, AD-3).

**Given** um produto com 2 unidades presentes e 2 unidades reservadas para encomendas ativas,
**When** a revendedora tenta ajustar a contagem física do armário para 1 unidade,
**Then** o sistema bloqueia terminantemente o ajuste e informa que é mandatório resolver ou desvincular as reservas afetadas antes de registrar a redução física (FR-030, Refinamento Elicitação, AD-3).

**Given** um ajuste de contagem confirmado,
**When** o saldo for atualizado,
**Then** o sistema não apaga o histórico anterior e registra a justificativa textual, a data/hora e o operador responsável (FR-030, NFR-003).


---

## Epic 5: Gestão de Contas, Cobrança Transparente, Pagamentos e Resolução de Excedentes

A revendedora acompanha o saldo de cada compra individualmente, utiliza a "Visão Sem Itens Aguardados" para cobrar apenas o que a cliente já pode levar para casa, registra pagamentos em dinheiro/Pix/cartão (absorvendo taxas da máquina sem penalizar o saldo da cliente), realiza estornos auditados e resolve com transparência cancelamentos de compras quitadas, permitindo devolver o dinheiro em centavos exatos ou converter em crédito intransferível na carteira do cliente.

### Story 5.1: Saldo Individual por Conta e Projeção da "Visão Sem Itens Aguardados"

As a revendedora cobrando uma cliente cuja encomenda chegou apenas pela metade,
I want alternar para a visualização que calcula o valor apenas dos produtos que já chegaram,
So that eu possa cobrar com segurança o valor justo do que a cliente está levando hoje sem bagunçar a conta original.

**Acceptance Criteria:**

**Given** que uma cliente possui duas compras distintas registradas (uma de R$ 100,00 e outra de R$ 80,00),
**When** a revendedora abre a ficha da cliente (S9),
**Then** cada compra exibe seu próprio extrato e saldo devedor individual, sem somar ou redistribuir valores automaticamente entre elas (FR-032, AD-4).

**Given** uma compra com valor total de R$ 150,00, contendo R$ 100,00 de produtos já presentes e R$ 50,00 de produtos ainda aguardando a fábrica,
**When** a revendedora clica no botão de alternância `[ Apenas o que Já Chegou ]`,
**Then** o sistema exibe a projeção do saldo considerando apenas os R$ 100,00 presentes,
**And** a interface exibe o texto acolhedor explicativo sem criar uma segunda conta no banco de dados (FR-033, UX-DR6, AD-4).

### Story 5.2: Registro de Pagamento em Dinheiro, Pix ou Cartão com Taxa Absorvida

As a revendedora recebendo o pagamento da cliente na maquininha de cartão ou em dinheiro/Pix,
I want registrar o pagamento abatendo o saldo integral da cliente e computando a taxa da máquina que eu absorvo,
So that a cliente fique 100% quitada e meu saldo financeiro líquido reflita o valor real que receberei.

**Acceptance Criteria:**

**Given** uma conta com saldo de R$ 100,00,
**When** a revendedora registra um pagamento de R$ 40,00 via Pix com a data efetiva,
**Then** o saldo da conta é recalculado imediatamente para R$ 60,00 e o status passa a ser `PARCIALMENTE_PAGA` (FR-034, FR-036).

**Given** uma conta com saldo de R$ 80,00 paga integralmente no cartão com taxa informada de R$ 2,50,
**When** o pagamento for confirmado,
**Then** o saldo devedor da cliente é quitado em R$ 80,00 (saldo zera e status passa a `QUITADA`),
**And** o sistema registra o valor líquido de R$ 77,50 (7750 centavos) e o custo de taxa de R$ 2,50 (250 centavos) para o controle da revendedora (FR-034, FR-035, NFR-010).

**Given** o formulário de pagamento,
**When** a revendedora tentar informar um valor maior que o saldo em aberto da conta, ou uma taxa de cartão maior ou igual ao valor pago,
**Then** o sistema recusa a confirmação e exibe aviso corretivo (FR-034, FR-035).

### Story 5.3: Estorno Auditado de Pagamento com Recalculo de Saldo

As a revendedora que lançou acidentalmente um pagamento na conta errada ou com valor incorreto,
I want estornar o lançamento com registro do motivo,
So that o saldo da conta reabra com exatidão e o histórico de auditoria fique preservado.

**Acceptance Criteria:**

**Given** um pagamento de R$ 50,00 lançado em uma conta,
**When** a revendedora realiza o estorno informando a justificativa textual obrigatória,
**Then** o saldo devedor da conta é reaberto em R$ 50,00,
**And** o registro do pagamento anterior é marcado como `ESTORNADO` com `operador_id` e timestamp, sem ser excluído fisicamente do banco de dados (FR-037, AD-1, NFR-003).

**Given** um pagamento que já gerou devolução de excedente ou conversão em crédito já utilizado em outra compra,
**When** houver tentativa de estornar o pagamento isoladamente,
**Then** o sistema bloqueia a ação até que as operações dependentes sejam previamente resolvidas (FR-037).

### Story 5.4: Gestão de Excedente por Cancelamento, Devolução Financeira e Carteira de Crédito

As a revendedora que precisou cancelar um produto de uma compra que a cliente já havia pago adiantado,
I want que o sistema identifique o valor pago a mais e me dê a escolha transparente de devolver em dinheiro/Pix ou guardar como crédito na carteira da cliente,
So that não sobre dinheiro "fantasma" no sistema e eu nunca perca o controle do que devo à cliente.

**Acceptance Criteria:**

**Given** uma conta de R$ 100,00 que já estava quitada (R$ 100,00 pagos) e tem um item de R$ 30,00 cancelado,
**When** o cancelamento é confirmado,
**Then** o novo total da compra passa a ser R$ 70,00,
**And** a diferença de R$ 30,00 (3000 centavos) é registrada imediatamente como `ExcedentePendente`, com a conta permanecendo quitada e sem gerar saldo devedor negativo (FR-038, AD-5).

**Given** a existência do excedente de R$ 30,00,
**When** a revendedora abre a tela de resolução (UX-DR8),
**Then** o sistema apresenta dois botões de ação clara:
- `[ Devolver R$ 30,00 em Dinheiro / PIX ]`: consome o excedente, registra o motivo, data e operador da devolução física (FR-039).
- `[ Deixar como Crédito para Próximas Compras ]`: consome o excedente e adiciona R$ 30,00 na `CarteiraCredito` individual daquela cliente (FR-040).

**Given** uma cliente com R$ 30,00 de crédito em sua carteira e uma nova compra com saldo de R$ 50,00,
**When** a revendedora aplica R$ 20,00 de crédito na nova compra,
**Then** o saldo da compra cai para R$ 30,00 sem registrar entrada nova de dinheiro externo,
**And** o saldo da carteira da cliente passa a ser R$ 10,00, sendo terminantemente proibido transferir ou usar esse crédito para outra cliente (FR-040, FR-041, AD-5).

### Story 5.5: Painel Consolidado de Vendas, Recebimentos e Saldos Segregados

As a revendedora,
I want visualizar um painel resumo que mostre separadamente o total vendido, o total recebido em dinheiro, o valor a receber e o saldo de créditos ativos,
So that eu tenha clareza da minha situação financeira real sem confundir vendas fiadas com dinheiro já no bolso.

**Acceptance Criteria:**

**Given** transações com vendas a prazo (fiado) e vendas pagas no período,
**When** a revendedora consulta o resumo financeiro (S1 / S9),
**Then** o sistema apresenta os indicadores com rótulos e valores em centavos formatados:
- *Total Vendido*
- *Total Efetivamente Recebido*
- *Total a Receber (Em Aberto)*
- *Total Devolvido a Clientes*
- *Créditos Ativos em Carteiras*,
**And** nenhum desses indicadores é rotulado prematuramente como "Lucro" ou "Ganho Líquido" na etapa T1 (FR-041, NFR-010).
