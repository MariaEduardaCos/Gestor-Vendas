# Histórico de Conversa e Registro de Decisões (ADR)

> As seções 1 a 6 preservam a concepção original, incluindo hipóteses ainda não verificadas. O [briefing atual](../_bmad-output/planning-artifacts/briefs/brief-consultorasync-2026-11-09/brief.md) e a seção 7 registram a atualização após a descoberta.

Este documento registra a evolução das discussões, requisitos levantados e decisões de engenharia de software tomadas durante a concepção do projeto de TCC.

---

## 📅 Linha do Tempo das Decisões

### 1. Demanda Inicial & Contexto de Rio Verde - GO
- **Solicitação**: Ideias para Trabalho de Conclusão de Curso (TCC) em Engenharia de Software viáveis em Rio Verde - GO, com baixo custo financeiro.
- **Primeiras Propostas (Foco Agro/Local)**:
  - Foram propostas ideias como agricultura familiar, caderno de campo offline-first, otimização de fretes e rastreabilidade de defensivos.
- **Decisão do Usuário**: Solicitação de ideias **sem relação com o agronegócio**, preferindo problemas mais genéricos e de impacto real.

---

### 2. Mudança para Temas Urbanos & Sociais
- **Segunda Rodada**:
  - Propostas voltadas para saúde pública (monitoramento de estoques de sangue no Hemocentro), gestão de clínicas-escola universitárias (UniRV/IF Goiano), proteção animal/adoção e descarte de resíduos eletrônicos.
- **Novo Requisito Crítico do Usuário**:
  - *"Gostaria que fossem ideias que não precisaria entrevistar muitas pessoas, pois estou residindo em uma cidade do interior e não consigo fazer muitas entrevistas."*
- **Análise Técnica**:
  - Em Engenharia de Software, projetos validados por dados abertos (Open Data), ferramentas de desenvolvedores (DevTools/Linters) ou padrões consolidados (WCAG, repetição espaçada) não dependem de pesquisas de campo com dezenas de usuários.

---

### 3. A Descoberta do Nicho Ideal: Revendedores de Produtos e Cosméticos
- **Solicitação do Usuário**:
  - *"E alguma coisa voltado para revendedores de produtos, como cosméticos OBoticário, Natura, Eudora. Ou então que possa ser útil para revendedores no geral."*
- **Validação de Viabilidade**:
  - **Aderência Total**: Presente em todas as cidades do interior do Brasil.
  - **Dispensabilidade de Entrevistas em Massa**: O modelo de venda direta segue manuais e regras públicas oficiais das marcas. A validação pode ser realizada com 1 ou 2 pessoas próximas (parentes ou amigas revendedoras) através das Heurísticas de Usabilidade de Nielsen.
  - **Dores Reais**: Dificuldade de cadastrar caixas cheias de itens, fiado sem controle, cosméticos vencendo no estoque e margens de lucro ilusórias (falta de rateio de frete e taxas de maquininha).

---

### 4. Análise de Integrações: APIs Oficiais vs. Código de Barras vs. Nota Fiscal
- **Dúvida do Usuário**:
  - *"Será que teria alguma forma de conectar com alguma API dessas marcas para pegar os produtos do catálogo ou informações pelo código de barras?"*
- **Parecer Técnico**:
  - **APIs Oficiais**: São fechadas e privadas (risco alto de quebra de contrato e bloqueio durante a banca).
  - **Solução A (Código de Barras EAN-13)**: Uso da câmera do celular + API aberta gratuita *Open Beauty Facts* + cache colaborativo.
  - **Solução B (Nota Fiscal / DANFE)**: Extração automática de itens, quantidades, custos faturados com desconto e rateio proporcional do frete total da caixa.
  - **Solução C (Catálogo Digital)**: Scraper periódico de revistas digitais abertas.
- **Decisão do Usuário**:
  - *"Podemos começar pela Solução A e depois ir implementando as Soluções B e C. Pois acredito que todas são boas soluções, principalmente a da Nota Fiscal que já podemos pegar o valor."*

---

### 5. Arquitetura de Escaneamento Mobile: A Escolha da Abordagem 3 para Início
- **Dúvida do Usuário**:
  - *"Acredito que poderia ter uma integração com o celular para poder fazer o escaneamento ou alguma coisa nesse modelo."*
- **Três Abordagens Analisadas**:
  1. *PWA Puro*: Câmera no navegador mobile.
  2. *Híbrido Nativo com Capacitor (APK Android)*: App instalado com Google ML Kit nativo.
  3. *Modo Pistola Leitora (Companion Scanner via WebSockets)*: O computador mostra um QR Code de pareamento; o celular abre o leitor no navegador e transmite cada código bipado instantaneamente para a tela do computador em tempo real.
- **Decisão do Usuário**:
  - *"Quero testar primeiramente com a abordagem 3, para após testes seguirmos com instalação de aplicativos."*

---

### 6. Transferência para o Repositório de Trabalho
- **Ação**: Criação da pasta de destino `/home/duda/Documentos/GitHub/prototipo_TCC/`.
- **Conteúdo Transferido**:
  - Documentação arquitetural completa.
  - Histórico de decisões e transcrições de logs.
  - Artefatos originais gerados na sessão.


---

### 7. Atualização após a descoberta — 09/11/2026

- Duda autorizou incorporar recomendações da [análise](ANALISE_DESCOBERTA_PARA_BRIEFING.md) ao primeiro teste e à organização do briefing, incluindo contas e pagamentos no fluxo de clientes, encomendas, recebimento, reservas, estoque e vendas com código de barras.
- Marcas iniciais: Natura, Eudora e O Boticário. Uso pelo celular e computador. Tupperware e DeMillus para depois.
- Organização: briefing conciso, complemento com regras e pendências e registro próprio da atualização. README alinhado; arquitetura anterior sinalizada para revisão.
- Scanner pareado permanece experimento, integrado a teste funcional mais amplo. Aplicativo instalado, bases externas e fases de automação dependem de reavaliação.
- Integrações não garantidas, validade depende de teste de esforço e custo individual de unidades misturadas segue pendente. Não há redução de inadimplência demonstrada.
- Fonte: [descoberta](../_bmad-output/brainstorming/brainstorm-rotina-revendedoras-2026-11-09/.memlog.md), baseada em relato de Duda, não validação ampla do público.


### 8. Especificação de requisitos e resolução de pendências — 09/11/2026

- Duda solicitou o PRD completo e a especificação do primeiro teste, resolvendo pendências antes da implementação dos comportamentos afetados.
- Confirmou percentual sobre preço definido por produto, configurado por marca: R$ 100 com 30% resulta em custo estimado de R$ 70 e ganho de referência de R$ 30. Essa decisão substitui a preferência provisória por custo individual.
- Confirmou ganho não calculado quando o custo é desconhecido e reconhecimento proporcional no pagamento, inclusive antes da entrega; cartão aprovado conta como pago.
- [PRD](../_bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/prd.md), [primeiro teste](../_bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/primeiro-teste.md) e [decisões](../_bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/decisoes.md) distinguem regras confirmadas, soluções operacionais propostas e integrações condicionadas. Nenhuma implementação ou teste do sistema foi executado nessa elaboração.
