---
name: ConsultoraSync
description: Sistema visual acolhedor, altamente legível e humanizado para revendedoras de cosméticos e beleza multimarcas (foco 40+ anos).
status: final
updated: 2026-11-10
colors:
  surface-base: '#FBF9F6'
  surface-raised: '#FFFFFF'
  surface-sunken: '#F3EFEA'
  surface-accent: '#FDF2EC'
  ink-primary: '#1F1E1C'
  ink-secondary: '#5C5852'
  ink-muted: '#8C867E'
  ink-inverse: '#FFFFFF'
  brand-primary: '#BD5338'
  brand-hover: '#A4442C'
  brand-subtle: '#FCEEE8'
  status-available: '#1B7340'
  status-available-bg: '#EAF6EE'
  status-reserved: '#B26200'
  status-reserved-bg: '#FEF6E8'
  status-waiting: '#2C5E8A'
  status-waiting-bg: '#EDF4FA'
  status-alert: '#A32224'
  status-alert-bg: '#FCEBEB'
  border-hairline: '#E7E2DA'
  border-strong: '#C9C2B7'
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    fontSize: '28px'
    fontWeight: '700'
    lineHeight: '36px'
  title-lg:
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    fontSize: '22px'
    fontWeight: '700'
    lineHeight: '28px'
  title-md:
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    fontSize: '18px'
    fontWeight: '600'
    lineHeight: '24px'
  body-lg:
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    fontSize: '17px'
    fontWeight: '400'
    lineHeight: '26px'
  body-md:
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    fontSize: '15px'
    fontWeight: '400'
    lineHeight: '22px'
  label-strong:
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    fontSize: '15px'
    fontWeight: '600'
    lineHeight: '20px'
  meta:
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    fontSize: '13px'
    fontWeight: '500'
    lineHeight: '18px'
rounded:
  sm: '6px'
  md: '12px'
  lg: '16px'
  full: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  'touch-target': '48px'
components:
  button-primary:
    background: '{colors.brand-primary}'
    color: '{colors.ink-inverse}'
    minHeight: '{spacing.touch-target}'
    borderRadius: '{rounded.md}'
    fontSize: '{typography.label-strong.fontSize}'
    fontWeight: '{typography.label-strong.fontWeight}'
  button-secondary:
    background: '{colors.surface-raised}'
    color: '{colors.brand-primary}'
    border: '1.5px solid {colors.brand-primary}'
    minHeight: '{spacing.touch-target}'
    borderRadius: '{rounded.md}'
  card-action:
    background: '{colors.surface-raised}'
    border: '1px solid {colors.border-hairline}'
    borderRadius: '{rounded.lg}'
    padding: '{spacing.5}'
  badge-status:
    borderRadius: '{rounded.full}'
    padding: '4px 12px'
    fontSize: '{typography.meta.fontSize}'
    fontWeight: '{typography.label-strong.fontWeight}'
---

## Brand & Style

O ConsultoraSync foi desenhado para ser o parceiro diário de revendedoras de cosméticos e cuidados pessoais — mulheres dinâmicas, muitas com mais de 40 anos, que gerenciam seus clientes pelo celular em meio à rotina doméstica e profissional.

A identidade rejeita deliberadamente o visual frio e cinzento de ERPs contábeis e a poluição visual cheia de termos técnicos crípticos. Em seu lugar, adota uma linguagem calorosa, acolhedora e imediata:
- **Calor sem infantilização**: Tons de terracota suave combinados a superfícies de papel artesanal/creme claro (`#FBF9F6`), trazendo a sensação tátil de um caderno de vendas confiável e bem cuidado.
- **Clareza sem esforço visual**: Tipografia com corpo generoso (mínimo de 15px para leitura confortável, 17px para leitura principal), números grandes e contrastes intencionais que não exigem óculos de leitura para confirmar valores e quantidades.
- **Dignidade e segurança operacional**: Cada estado do produto (disponível na pronta-entrega, encomendado por alguém, a caminho da fábrica) possui identidade visual distinta e texto em português claro, eliminando o medo de errar a contagem.

## Colors

A paleta de cores combina conforto térmico e legibilidade estrita:

- `{colors.surface-base}` (`#FBF9F6`): Fundo geral que reduz o cansaço visual em telas de celular comparado ao branco puro fosco sob luz do dia.
- `{colors.surface-raised}` (`#FFFFFF`): Cartões e painéis com destaque, oferecendo separação nítida das informações.
- `{colors.surface-sunken}` (`#F3EFEA`): Áreas de cabeçalho secundário, campos de busca inativos e fundos de agrupamento.
- `{colors.ink-primary}` (`#1F1E1C`): Grafite profundo e quente. Utilizado em todos os títulos, preços principais e nomes de clientes. Alto contraste superior a 12:1 contra o fundo.
- `{colors.ink-secondary}` (`#5C5852`): Textos de apoio, rótulos de campos e descrições.
- `{colors.ink-muted}` (`#8C867E`): Códigos de barras auxiliares, data de registro e marcações opcionais.
- `{colors.brand-primary}` (`#BD5338`): Terracota acolhedor e expressivo. É a cor de ação afirmativa do sistema: botões principais ("Confirmar", "Registrar Chegada", "Salvar Venda").
- `{colors.brand-subtle}` (`#FCEEE8`): Fundo de destaque para áreas selecionadas e banners de ação recomendada.
- `{colors.status-available}` (`#1B7340`) e `{colors.status-available-bg}` (`#EAF6EE`): Verde natural que sinaliza produto disponível na pronta-entrega e conta quitada.
- `{colors.status-reserved}` (`#B26200`) e `{colors.status-reserved-bg}` (`#FEF6E8`): Âmbar caloroso para reserva nominal de cliente (ex: "Separado para Ana"). Não transmite alarme de erro, mas atenção ativa.
- `{colors.status-waiting}` (`#2C5E8A`) e `{colors.status-waiting-bg}` (`#EDF4FA`): Azul suave para produtos aguardados da fábrica (encomendados mas ainda não entregues pela marca).
- `{colors.status-alert}` (`#A32224`) e `{colors.status-alert-bg}` (`#FCEBEB`): Vermelho vinho controlado para cancelamento, estorno ou falta de estoque.

## Typography

A família tipográfica adotada é a **Plus Jakarta Sans** (com fallback nativo do sistema), reconhecida pela geometria limpa, aberturas amplas e excelente legibilidade em telas de baixa e alta densidade.

- **Display** (`28px / 700`): Indicadores numéricos expressivos (ex: saldo devedor do cliente, valor total da caixa recebida).
- **Title LG** (`22px / 700`): Cabeçalho das telas principais (Estoque, Nova Venda, Ficha da Cliente).
- **Title MD** (`18px / 600`): Nomes de clientes em listas, nomes de produtos e títulos de seções.
- **Body LG** (`17px / 400`): Leituras operacionais prioritárias e perguntas de confirmação na tela.
- **Body MD** (`15px / 400`): Texto de formulários, instruções de apoio e descrições de produtos.
- **Label Strong** (`15px / 600`): Textos de botões e rótulos de campos obrigatórios.
- **Meta** (`13px / 500`): Informações de apoio como código de barras (EAN), horário de bipagem e detalhes secundários.

## Layout & Spacing

A grade é orientada a uma coluna fluida no celular (com margens laterais de `{spacing.4}` = 16px) e centralizada em até 768px/960px em telas maiores de desktop.

- **Alvo de Toque Mínimo**: Nenhum botão, link ou campo interativo tem altura inferior a `{spacing.touch-target}` (48px). Isso atende plenamente à ergonomia de manuseio rápido com uma só mão.
- **Espaçamento Vertical Confortável**: Cartões têm espaçamento interno `{spacing.5}` (20px) para que elementos não pareçam amontoados.
- **Barra de Ação Fixa Inferior (Mobile)**: Botões decisivos de avanço ("Confirmar Entrega", "Receber Pagamento", "Salvar") ficam ancorados na base da tela, ao alcance direto do polegar, sem exigir rolagem.

## Elevation & Depth

- **Superfícies Niveladas com Borda Sutil**: A profundidade é dada principalmente pelo contraste de tons e pela borda fina `{colors.border-hairline}` (`#E7E2DA`), evitando sombras pesadas que poluem a tela.
- **Elevação Flutuante (Bottom Sheet / Modal)**: Sombras suaves apenas em modais de cadastro rápido e avisos de confirmação: `0px 8px 24px rgba(31, 30, 28, 0.10)`.

## Shapes

- **Arredondamento Amigável**: Cantos com `{rounded.md}` (12px) e `{rounded.lg}` (16px) transmitem gentileza e acolhimento.
- **Pílulas de Status**: Badges de situação usam `{rounded.full}` (formato pílula) para diferenciar imediatamente de botões de ação e campos de texto.

## Components

### 1. Botão Primário (`button-primary`)
- Altura: 48px mínima.
- Fundo: `{colors.brand-primary}`, texto em negrito `{colors.ink-inverse}`.
- Comportamento: Estado de carregamento com spinner claro e bloqueio de múltiplos toques (previne cliques duplos acidentais).

### 2. Cartão de Item de Estoque / Produto
- Estrutura clara em 3 zonas:
  1. Topo: Nome da marca e nome do produto em negrito (`{typography.title-md}`).
  2. Miolo: Badges de quantidade com cores semânticas explícitas: `[ 3 Presentes ]` (verde), `[ 1 Reservado ]` (âmbar), `[ 2 Pronta-Entrega ]` (verde-água), `[ 1 Aguardando ]` (azul).
  3. Rodapé: Preço de venda em tamanho destacado e código de barras legível.

### 3. Campo de Leitura / Digitação de Código de Barras
- Um campo unificado e de alta prioridade visual:
  - Botão grande com ícone de câmera "Ler com Câmera".
  - Campo de texto grande ao lado para digitação manual ou entrada direta do leitor USB/Bluetooth.
  - Alerta sonoro/visual discreto e amigável ao bipar.

### 4. Barra de Destinação de Produto (Conferência de Caixa)
- Ao ler um item recém-chegado que possui pedidos pendentes, exibe um painel de escolha clara:
  - *"Esse produto é para a encomenda da cliente Ana ou para pronta-entrega?"*
  - Botões de seleção direta com nome da cliente e quantidade restante.

## Do's and Don'ts

### Do's:
- **Faça**: Use sempre frases completas e humanas nos diálogos (ex: *"Deseja separar esta unidade para a Ana?"*).
- **Faça**: Destaque o valor monetário e a quantidade em fontes grandes e legíveis.
- **Faça**: Ofereça sempre a alternativa de digitação manual quando a leitura de código de barras estiver em uso.
- **Faça**: Mantenha os botões de ação com pelo menos 48px de altura e espaçados entre si para evitar toques incorretos.

### Don'ts:
- **Não faça**: Nunca use termos contábeis ou de informática como "SKU", "Null", "Payload", "Timestamp", "Rollback" ou "Gateway".
- **Não faça**: Nunca dependa unicamente de cores para informar o estado de um produto (adicione sempre o texto explicativo junto ao ícone/cor).
- **Não faça**: Não use botões pequenos ou textos cinza-claros de baixo contraste sobre fundo branco.
- **Não faça**: Nunca feche uma venda ou movimente estoque sem um resumo claro do que acabou de acontecer.
