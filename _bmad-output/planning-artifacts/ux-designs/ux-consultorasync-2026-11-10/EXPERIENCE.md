---
name: ConsultoraSync
status: final
sources:
  - _bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/primeiro-teste.md
  - _bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/prd.md
  - _bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/decisoes.md
updated: 2026-11-10
---

# ConsultoraSync — Experience Spine (Primeiro Teste T1)

Este documento especifica a arquitetura de informação, comportamento de telas, fluxos de uso, padrões de microcopy e regras de acessibilidade para o primeiro teste funcional (T1) do ConsultoraSync. Ele opera como contrato normativo de experiência do usuário e dialoga diretamente com as definições visuais em [DESIGN.md](DESIGN.md).

---

## Foundation

- **Form-factor**: Aplicação web única e responsiva (*mobile-first*), acessada diretamente pelo navegador do celular da revendedora e também utilizável no computador com leitor físico pareado ou USB.
- **Público-alvo & Postura**: Revendedoras autônomas (com atenção especial à faixa etária de 40+ anos). A experiência prioriza clareza absoluta, botões de toque confortáveis (`{spacing.touch-target}` = 48px), contraste forte e processos que não causam insegurança de "apagar dados por engano".
- **Identidade Visual**: Herdada integralmente dos tokens de [DESIGN.md](DESIGN.md).
- **Tratamento de Conectividade**: Caso a conexão caia durante uma operação, o sistema impede envios silenciosos duplicados e exibe status transparente de reconexão.

---

## Information Architecture

O primeiro teste (T1) é coberto por 8 superfícies funcionais interligadas:

| Superfície | Como é Acessada | Propósito Operacional | Requisitos Vinculados |
|---|---|---|---|
| **S1 — Painel Inicial (Início)** | Abertura do app / Barra inferior | Visão geral rápida do dia: botões de ação imediata ("Nova Venda", "Registrar Caixa/Estoque", "Clientes") e resumo de itens aguardados da fábrica. | FR-001, FR-002 |
| **S2 — Ficha & Lista de Clientes** | Aba "Clientes" / Link na venda | Listagem com busca rápida por nome. Ficha da cliente exibindo histórico de compras, contas em aberto, itens já entregues e itens encomendados. | FR-003, FR-004 |
| **S3 — Gaveta de Cadastro Rápido de Cliente** | Botão "+ Nova Cliente" (em qualquer fluxo) | Cadastro ágil sem travar a tarefa em andamento: apenas Nome completo (obrigatório) e Telefone (opcional). | FR-003 |
| **S4 — Catálogo & Gestão de Estoque** | Aba "Estoque" | Consulta de produtos com contadores visuais: *Presentes*, *Reservados*, *Pronta-Entrega* e *Aguardados*. Cadastro manual de produto/variante com preço e percentual de marca. | FR-006, FR-010, FR-011, FR-012, FR-013 |
| **S5 — Conferência de Caixa & Entrada de Estoque** | Botão "Conferir Caixa da Marca" ou "Novo Estoque" | Câmera com abertura automática imediata na metade superior (zero cliques) para leitura contínua dos produtos, com painel inferior de destinação e digitação manual alternativa. | FR-007, FR-008, FR-009, FR-020, FR-021 |
| **S6 — Modal de Destinação de Produto Chegado** | Disparado na leitura de item da caixa | Pergunta mandatória: destinar a unidade recebida para a Encomenda de uma cliente específica (cria reserva) ou colocar na Pronta-Entrega. | FR-022, FR-023, FR-025 |
| **S7 — Registro de Encomenda & Pedido à Marca** | Botão "+ Encomenda" na cliente ou Estoque | Registra o pedido de itens que a revendedora não tem em mãos; permite agrupar encomendas em uma "Compra da Marca" antes do envio do pedido. | FR-015 a FR-019 |
| **S8 — Venda Balcão & Entrega** | Botão "Nova Venda" | Seleciona itens por bip/busca e escolhe cliente. Define se a entrega física é imediata (sai do estoque) ou se é encomenda/reserva (permanece presente). | FR-026, FR-027, FR-028, FR-031 |
| **S9 — Conta, Pagamentos & Ajustes** | Botão "Ver Conta" / "Receber" na cliente | Extrato da conta; botão para alternar entre "Visão Completa" e "Visão Sem Itens Aguardados"; registro de pagamento (dinheiro, PIX ou cartão com taxa); estorno; e cancelamento com crédito/devolução. | FR-024, FR-029, FR-030, FR-032 a FR-041 |
| **S10 — Pareamento de Leitor no Computador** | Configurações / Ícone de Leitor | Conexão de disparo direto via QR Code no computador: ao ler com o celular, abre página leve que inicia a câmera em tela cheia na hora sem menus ou login, operando como leitor sem fio imediato. | FR-014 |

→ **Referências Visuais Interativas (Mockups)**:
- Conferência de Caixa & Destinação: [mockups/key-conferencia-estoque.html](mockups/key-conferencia-estoque.html) (Ilustra S5, S6 e Jornada 1).
- Lista de Clientes & Cadastro Rápido: [mockups/key-cadastro-cliente-gaveta.html](mockups/key-cadastro-cliente-gaveta.html) (Ilustra S2, S3 e Jornada 2).

*Nota de autoridade: Os spines (`DESIGN.md` e `EXPERIENCE.md`) são o contrato normativo; em caso de divergência visual ou de layout com os mockups, prevalecem as definições deste documento.*

---

## Voice and Tone

A microcopy do ConsultoraSync fala com a revendedora como uma assistente pessoal atenciosa e direta, sem jargões corporativos.

| O que Fazer (Do) | O que Evitar (Don't) |
|---|---|
| *"Separar para a encomenda da Ana"* | *"Alocar unidade à reserva pendente do cliente"* |
| *"Pronta-entrega (disponível para qualquer pessoa)"* | *"Estoque desimpedido"* |
| *"Chegou da fábrica"* | *"Entrada de mercadoria via fornecedor registrada"* |
| *"Aguardando a marca entregar"* | *"Status de remessa: Backorder / Pendente"* |
| *"Receber com Cartão (com taxa da maquininha)"* | *"Transação POS MDR absorvida"* |
| *"Você devolveu R$ 30 em dinheiro para a cliente ou deixou como crédito para a próxima compra?"* | *"Processar refund via cash ou emitir credit balance"* |
| *"Não conseguimos conectar à internet agora. Seus dados estão seguros e nada foi enviado duas vezes."* | *"Network Exception 503: retry failed"* |

---

## Component Patterns

### 1. Campo de Leitura Híbrido com Visor Ativo (Zero Cliques / Auto-Start + Leitor + Digitação)
- **Localização**: Fixo no topo das telas operacionais (Conferência de Caixa, Nova Venda e Leitor Pareado).
- **Comportamento**:
  - **Abertura Automática (Zero Cliques)**: Ao entrar na tela, o visor da câmera na metade superior já inicializa automaticamente (com permissão concedida), pronto para leitura imediata, dispensando toques intermediários em botões de "abrir câmera".
  - **Modo Contínuo (*Passar e Bipar*)**: A revendedora passa os frascos em sequência; a cada código reconhecido, a tela emite feedback sonoro suave (*bip*) e exibe a ação correspondente na metade inferior sem interromper o visor.
  - **Alternativa Rápida de Digitação**: Campo de digitação sempre acessível logo abaixo do visor para busca por nome ou código manual (e com foco automático caso um leitor USB/Bluetooth físico esteja conectado).
  - **Filtro Anti-Duplicação (Debounce)**: Trava de 1,5s para evitar que segurar o produto na frente da câmera leia o mesmo item duas vezes acidentalmente.

### 2. Cartão de Item com Pílulas de Quantidade
- Apresenta o nome do produto em `{typography.title-md}`, seguido de 4 marcadores visuais claros e coloridos:
  - **Presentes**: Total de frascos/unidades físicas na casa da revendedora (`{colors.status-available}`).
  - **Reservados**: Unidades físicas que já pertencem a clientes específicos (`{colors.status-reserved}`).
  - **Pronta-Entrega**: Unidades físicas livres para vender agora (`{colors.status-available}`).
  - **Aguardados**: Unidades já pedidas à fábrica mas ainda não entregues pela transportadora (`{colors.status-waiting}`).
- Garante a regra fundamental: `Presentes = Reservados + Pronta-Entrega`.

### 3. Alternador de Visão de Conta da Cliente (Toggle Simples)
- Localizado no topo da tela de cobrança e pagamento da cliente:
  - Botão de alternância com rótulos amigáveis:
    - `[ Conta Completa: R$ 150,00 ]` (inclui tudo o que foi encomendado).
    - `[ Apenas o que Já Chegou: R$ 100,00 ]` (exclui itens que a marca ainda não entregou).
  - Um texto explicativo logo abaixo tranquiliza a revendedora: *"Isso ajuda a cobrar apenas o que a cliente já pode levar para casa hoje"*.

### 4. Barra de Ação Fixa na Base do Celular (*Sticky Bottom Bar*)
- No celular, a ação principal da tela fica sempre fixa na base, ocupando toda a largura útil e com altura mínima de 48px (`{components.button-primary}`).
- Exemplo: em Nova Venda, exibe o total acumulado à esquerda e o botão *"Avançar para Pagamento / Entrega"* à direita.

---

## State Patterns

- **Câmera Bloqueada ou Sem Permissão**: O app não trava; exibe uma mensagem acolhedora: *"A câmera está desligada. Você pode digitar o código ou o nome do produto no campo abaixo sem problemas."*
- **Produto Não Cadastrado Bipado**: Abre imediatamente um diálogo: *"Código 789... não encontrado. Deseja cadastrar esse produto agora?"* com formulário simples pré-preenchido com o código lido.
- **Sem Internet / Falha de Rede**: Banner amarelo claro no topo da tela: *"Você está sem internet no momento. Não se preocupe: nenhuma cobrança ou entrega será duplicada."* Botões de envio mostram indicador claro e bloqueiam novos toques enquanto aguardam confirmação do servidor.
- **Tentativa de Vender Acima do Disponível**: O sistema alerta: *"Você tem apenas 1 unidade na pronta-entrega. Deseja registrar a outra como encomenda para pedir à fábrica?"*

---

## Interaction Primitives

- **Confirmação de Destinação em Duas Etapas**: Quando um produto chega e há encomendas pendentes, a revendedora é solicitada a tocar no nome da cliente destinatária. Isso atualiza a reserva imediatamente e impede que a unidade suma na pronta-entrega.
- **Desistência e Cancelamento Transparente**: Ao cancelar um item pago, o sistema abre uma escolha objetiva em dois botões grandes:
  - `[ Devolver em Dinheiro / PIX ]`
  - `[ Deixar como Crédito para Próximas Compras ]`
  O saldo é recalculado na hora, mantendo o histórico legível na ficha da cliente.

---

## Accessibility Floor

- **Legibilidade para 40+ Anos**: Corpo de texto nunca inferior a 15px; textos prioritários em 17px (`{typography.body-lg}`). Rótulos e valores de preços em negrito com contraste superior a 10:1 (`{colors.ink-primary}` sobre `{colors.surface-base}`).
- **Áreas de Toque Generosas**: Nenhuma área clicável ou tocável menor do que 48x48px (`{spacing.touch-target}`). Espaçamento mínimo de 12px entre botões adjacentes para evitar toques acidentais.
- **Independência de Cores**: Todo status cromático é acompanhado de texto e ícone (ex: a cor verde vem acompanhada do texto *"Pronta-entrega"* e do ícone de caixa aberta; o âmbar vem com *"Reservado para Ana"* e ícone de etiqueta nominal).

---

## Key Flows (Jornadas do Primeiro Teste)

### Protagonista do Teste:
**Dona Sônia**, 49 anos, revendedora multimarcas há 8 anos. Trabalha em casa, atende clientes vizinhas e amigas pelo WhatsApp e organiza seus produtos em uma estante na sala. Ela precisa de agilidade, odeia confusão com dinheiro e quer ter certeza absoluta de quem é cada perfume que chega.

---

### Jornada 1: A Chegada da Caixa da Marca e a Destinação Imediata (Cena Principal T1)

1. **Contexto**: Dona Sônia senta na mesa com a caixa de papelão da Natura recém-entregue. Dentro há 3 unidades do "Desodorante Hidratante Algodão": 1 foi encomendado pela cliente **Ana**, 1 pela cliente **Bia** e 1 é para deixar disponível na pronta-entrega.
2. **Passo 1 (Abertura)**: Dona Sônia abre o ConsultoraSync no celular e toca em **"Conferir Caixa da Marca"**.
3. **Passo 2 (Bip do primeiro frasco)**: Ela aponta a câmera do celular para o código de barras do primeiro frasco. O celular emite um som suave de sucesso (*bip!*).
4. **Passo 3 (Clímax — A Escolha de Destinação)**: A tela exibe um aviso em destaque:
   > *"Você tem 2 encomendas aguardando esse produto: Ana e Bia. Para quem você quer separar este primeiro frasco?"*
   Dona Sônia toca no botão grande com o nome da **Ana**.
5. **Passo 4 (Confirmação Visual)**: O sistema atualiza o painel:
   - *1 Frasco Reservado para Ana.*
   - *Estoque Presente: 1 unidade.*
   - *Bia continua aguardando a chegada da unidade dela.*
6. **Passo 5 (Bip do segundo frasco)**: Dona Sônia bipa o segundo frasco. A tela pergunta novamente. Ela escolhe **Bia**. Agora há 2 unidades reservadas.
7. **Passo 6 (Bip do terceiro frasco)**: Ela bipa o terceiro frasco. Como não há mais encomendas aguardando, o sistema informa alegremente: *"Nenhuma encomenda aguardando. Este frasco foi adicionado à sua Pronta-Entrega!"*
8. **Resultado**: Em menos de 2 minutos, Dona Sônia conferiu a caixa inteira sem usar papel de rascunho, e cada frasco está marcado com clareza para a dona certa.

---

### Jornada 2: Cadastro Rápido de Nova Cliente e Encomenda

1. **Contexto**: Durante a tarde, uma vizinha chamada **Carla** manda mensagem no WhatsApp pedindo um creme que não está na pronta-entrega.
2. **Passo 1**: Dona Sônia abre o app e toca em **"Clientes"** > **"+ Nova Cliente"**.
3. **Passo 2**: Digita apenas *"Carla Vizinha"* e o número de WhatsApp dela. Toca em **"Salvar Cliente"** (leva menos de 10 segundos).
4. **Passo 3**: Na própria ficha da Carla recém-aberta, Dona Sônia toca em **"+ Anotar Encomenda"**.
5. **Passo 4**: Busca o creme pelo nome, confirma o valor e salva.
6. **Resultado**: O produto entra na lista de *Itens Aguardados da Fábrica*. O saldo a receber não considera o valor como dívida vencida, e Dona Sônia sabe exatamente o que precisa pedir no próximo pedido da marca.

---

### Jornada 3: Entrega, Venda de Pronta-Entrega e Pagamento com Cartão

1. **Contexto**: A cliente **Ana** passa na casa de Dona Sônia para buscar seu hidratante reservado (R$ 50,00) e decide levar também um batom que viu na pronta-entrega (R$ 30,00). Total: R$ 80,00.
2. **Passo 1**: Dona Sônia toca em **"Nova Venda"**, seleciona a cliente **Ana** e adiciona o batom da pronta-entrega bipando com a câmera.
3. **Passo 2**: O sistema avisa que Ana já tem 1 produto reservado pronto para entrega. Dona Sônia marca a opção *"Entregar também o Hidratante reservado"*.
4. **Passo 3 (Entrega física)**: Ao marcar a entrega, o estoque físico atualiza: a reserva é liquidada e o batom sai da pronta-entrega, sem saída dupla.
5. **Passo 4 (Pagamento com Cartão)**: Ana decide passar os R$ 80,00 na maquininha de cartão. Dona Sônia informa o valor e a taxa de R$ 2,50 descontada pela máquina.
6. **Passo 5 (Clímax — Baixa Transparente)**: O sistema registra o pagamento integral da conta da Ana (saldo devedor zera), armazena o valor líquido de R$ 77,50 para o controle financeiro, e Dona Sônia entrega os produtos com a certeza de que a conta está limpa.

---

### Jornada 4: Cancelamento de Item e Destinação do Saldo (Devolução vs Crédito)

1. **Contexto**: A cliente **Bia** já havia deixado R$ 50,00 pagos adiantados pelo hidratante dela, mas a fábrica comunicou que o produto está em falta definitiva.
2. **Passo 1**: Dona Sônia entra na conta da Bia e toca em **"Cancelar Item Encomendado"**.
3. **Passo 2 (Clímax — Decisão sobre o Dinheiro)**: O sistema não apaga o registro financeiro anterior; ele exibe uma mensagem direta:
   > *"O valor total da compra da Bia diminuiu em R$ 50,00. Como ela já havia pago, existe um saldo sobrando de R$ 50,00.*
   > *O que foi combinado com a Bia?"*
   > - Botão 1: `[ Devolver R$ 50,00 em Dinheiro / PIX ]`
   > - Botão 2: `[ Deixar R$ 50,00 como Crédito para Próximas Compras ]`
4. **Passo 3**: Dona Sônia escolhe *"Deixar como Crédito"*. O saldo da conta zera e a carteira de crédito da Bia passa a ter R$ 50,00 disponíveis para abater em compras futuras.
5. **Resultado**: Nenhuma ponta solta: nem dinheiro fantasma no sistema, nem risco de esquecer que devia o valor à cliente.

---

## Responsive & Platform (Mobile & Computador com Leitor)

- **Mobile (Smartphones Android / iOS)**:
  - Navegação principal por barra inferior (*Bottom Navigation*): Início, Vender, Estoque, Clientes.
  - Câmera do aparelho acessível com um único toque.
- **Desktop (Computador da Revendedora)**:
  - Mesma aplicação web, com painel alargado e barra lateral de navegação.
  - Tela de leitura de código de barras adaptada para focar o leitor USB ou receber eventos do celular pareado (CT-08).
