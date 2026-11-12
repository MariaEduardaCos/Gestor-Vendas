# Recon de concorrentes: Minha Revenda e Rosinha (web + mobile)

- **Escopo:** gestão da revenda de venda direta (catálogo, estoque, vendas/pedidos, cobrança, clientes, finanças, WhatsApp). Não é um projeto de cópia: o objetivo é **benchmark para o TCC ConsultoraSync** — entender o que o mercado já entrega, onde estão as lacunas e o que diferencia a proposta.
- **Para:** fundamentação do capítulo de trabalhos relacionados/análise de concorrentes do TCC e priorização das próximas funcionalidades.
- **Data:** 2026-11-12
- **Método:** somente fontes públicas (sites oficiais, páginas de planos e termos, central de ajuda pública, App Store). Nenhum login, cadastro ou teste nos produtos; nenhum código ou API privada consultados. Por isso, telas e fluxos abaixo são **inferidos** de material público e marcados com nível de confiança.

> **Legenda de confiança:** **alta** = afirmado pelo próprio produto em página pública; **média** = deduzido de lista de recursos, categorias da ajuda ou descrição de loja; **suposição** = inferência sem evidência direta.

---

## 1. Fontes

| # | fonte | URL | observações |
| --- | --- | --- | --- |
| 1 | Site Minha Revenda | https://minharevenda.app/ | Recursos, marcas, números de marketing, 7 dias grátis. Sem preços. |
| 2 | Central de ajuda Minha Revenda | https://portal.minharevenda.online/central-ajuda | Trilhas de curso e categorias de tutoriais (com contagem). Passo a passo não visível sem acesso. |
| 3 | App Store — Minha Revenda | https://apps.apple.com/br/app/minha-revenda/id6747267381 | Nota 4,9 (251 avaliações), versão 5.0.0, novidades (NF-e, WhatsApp, fidelidade). |
| 4 | App Store — Revendi (mesmo desenvolvedor) | https://apps.apple.com/br/app/revendi/id6460934720 | Nota 4,9 (63), preços das assinaturas, uma crítica sobre travamentos. |
| 5 | Google Play — Minha Revenda | https://play.google.com/store/apps/details?id=com.minharevenda.app | Página não pôde ser lida pela ferramenta; sem dados de nota/downloads. |
| 6 | Site Rosinha | https://meurosinha.com.br/ | Recursos (agenda, metas, trocas, comunidade), depoimentos, suporte. |
| 7 | Planos Rosinha | https://meurosinha.com.br/planos/ | Preços do Básico; Plus sem preço público; garantias. |
| 8 | Quem somos Rosinha | https://meurosinha.com.br/quem-somos/ | Origem em 2016 (smartMK), ~1.000 assinantes. |
| 9 | Termos de uso Rosinha | https://meurosinha.com.br/termos-de-uso/ | Renovação automática, reajuste IGPM, retenção de 90 dias e exportação CSV. |
| 10 | Reclame Aqui — reclamações do setor | https://www.reclameaqui.com.br/vendah/vendas-nao-computadas-e-suporte-ineficiente-no-app-vendah_dOu657KoQVC_J_2a/ · https://www.reclameaqui.com.br/eudora-representantes/falhas-no-aplicativo-e-falta-de-estoque-causam-prejuizos-e-perda-de-cliente_dMq2GyJFQ95j5c5m/ | Dores da categoria (não dos dois apps). |
| 11 | Avaliações de app genérico de vendas/fiado (Kyte) | https://allbestapps.pt/android/pdv-controle-de-vendas-recibos-fiado-e-estoque | Dores da categoria: estoque que "some", falta de variações, sincronização. |
| 12 | Apps de marca (Mary Kay myCustomers+) | https://appgoblin.info/apps/com.marykay.marykayandroid | Referência: app oficial de marca, nota 3,8. |

**Não foram encontradas** avaliações públicas do Rosinha (não há app nas lojas) nem reclamações no Reclame Aqui sobre Minha Revenda ou Rosinha. Uma busca por "Minha Revenda" retorna também um app homônimo **sem relação** (revenda de botijões da Nacional Gás) — cuidado ao citar.

---

## 2. Visão geral dos produtos

| | **Minha Revenda** | **Rosinha (Meu Rosinha)** |
| --- | --- | --- |
| Empresa | Revendi Soluções Digitais LTDA (São Paulo/SP). Mesmo desenvolvedor do app **Revendi** — provável evolução/rebrand (a descrição na loja ainda cita "Revendi"). *média* | Origem em 2016 como **smartMK**, criado por um desenvolvedor para a esposa consultora. *alta* |
| Público | Revendedoras multimarcas de cosméticos ("todas as marcas em um só lugar"), mas serve para "qualquer produto". | Consultoras de beleza com perfil de **carreira em venda direta** (sessões, entrevistas, metas, equipe). |
| Plataformas | Web (app.minharevenda.online), Android e iOS (inclusive Mac M1). *alta* | **Somente web responsiva** (celular, tablet, computador). Não há app nas lojas. *alta* |
| Base declarada | "+500 clientes ativos"; 251 avaliações na App Store. | "Mais de 1.000" / "quase 1.000" assinantes (o site se contradiz). |
| Proposta central | **Operação**: estoque com código de barras e validade, vendas parceladas com Pix, cobrança de atrasados, loja online. | **Rotina e relacionamento**: agenda, contatos/fidelização (2+2+2), metas, trocas entre consultoras, comunidade de conteúdo. |
| Core loop (o que se paga para ter) | Registrar estoque → vender (parcelado/Pix) → acompanhar quem deve. | Organizar agenda e contatos → vender → acompanhar lucro e metas. |

---

## 3. Funcionalidades principais

| Área | Minha Revenda | Rosinha |
| --- | --- | --- |
| **Catálogo de marcas** | Catálogos prontos de Natura, Avon, O Boticário, Eudora, Mary Kay, Jequiti, L'Occitane, Oui, QDB; cadastro rápido a partir deles, com foto e preço. *alta* | Produtos de Avon, Mary Kay, Natura, Jequiti, Mahogany, Hinode, Tupperware + produtos próprios; depoimento elogia "produtos atualizados". *alta* |
| **Cadastro de produtos** | Código de barras pela câmera, categorias, filtros, **importação de planilha**, **controle de lotes**. *alta/média* | Cadastro próprio além do catálogo. *alta* |
| **Estoque** | Baixa automática na venda, **alertas de vencimento**, reposição. *alta* | Citado em depoimentos e lista de recursos, sem detalhe. *média* |
| **Compras / entrada** | Registro de compras e pagamentos; **v5.0: criar compra a partir de NF-e (XML ou chave de acesso)**. *alta* | Não citado. |
| **Vendas / pedidos** | Registrar, editar, compartilhar e **desfazer** venda; parcelamento; status de pagamento. *alta* | Controle de vendas no financeiro; encomendas chegam pela loja online. *média* |
| **Fiado / cobrança** | Pendências por cliente automáticas, **alerta de pagamentos atrasados**, **Pix gerado na venda** (chave cadastrada). *alta* | Lembretes de cobrança pelo WhatsApp (Plus). Não há módulo de contas explícito. *média* |
| **Clientes** | Cadastro e gestão; "principais clientes" nos relatórios; **programa de fidelidade** (v5.0). *alta* | Ficha da cliente, **datas importantes, indicações, método 2+2+2** de pós-venda. *alta* |
| **Financeiro** | Receitas e despesas mensais, totais consolidados e previstos, filtros por situação e cliente. *alta* | Vendas, despesas, **bônus e consórcios**, cálculo de lucro. *alta* |
| **Relatórios** | Vendas, estoque, financeiro, lucratividade por período, mais vendidos; exportação. *alta* | Relatórios do negócio (sem detalhe). *média* |
| **Loja online** | Loja com logo/cores, categorias, promoções, carrinho integrado; **"Loja PRO"** paga à parte. *alta* | Vitrine que recebe encomendas. *alta* |
| **WhatsApp** | v5.0: envio de mensagens sem sair do app; links de contato. *alta* | Mensagens e lembretes (vendas, cobranças, promoções, aniversários, pós-venda) — **exclusivo do Plano Plus**. *alta* |
| **Agenda / metas** | Não citado. | **Agenda** (sessões, entrevistas, reuniões) e **metas** (sessões, contatos, entrevistas, vendas). *alta* |
| **Trocas** | Não citado. | **Trocas de produtos entre consultoras**. *alta* |
| **Divulgação / conteúdo** | Catálogos em PDF para divulgar. *média* | **Comunidade**: videoaulas, artes para redes sociais, PDFs. *alta* |
| **IA** | Não citado (há "Assistente Virtual" na ajuda). | "Recursos de inteligência artificial" no Plus, sem detalhe. *alta* |
| **Comissão / custo** | "Gestão de comissões" citada sem detalhe; lucratividade nos relatórios. *média* | Cálculo de lucro. *média* |
| **Educação** | Cursos: primeiros passos (celular e desktop), trilha Loja PRO, **mentorias com contador sobre CPF/CNPJ**. *alta* | Comunidade de conteúdo para assinantes. *alta* |

### O que **nenhum dos dois** comunica publicamente

- **Encomenda por cliente vinculada ao pedido feito à marca** (consolidar várias encomendas num pedido e separar o que é de cada cliente quando a caixa chega).
- **Conferência da caixa recebida** contra o pedido, com tratamento de falta.
- **Reserva**: distinguir unidade em casa disponível × já separada para uma cliente.
- **Contas separadas por compra** com pagamento parcial em conta escolhida, estorno, excedente e crédito da cliente.
- **Acesso por função** (ajudante/contratada com permissões limitadas).
- **Celular como leitor pareado ao computador.**

Esses pontos coincidem com o núcleo do ConsultoraSync e são o argumento de diferenciação do TCC (ver seção 8).

---

## 4. Telas inferidas (inventário)

IDs estáveis para uso nas próximas análises. `MR` = Minha Revenda, `RO` = Rosinha.

| ID | app | tela | como se chega | propósito | componentes-chave | estados prováveis | confiança |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S01 | MR | Cadastro / login | "Comece agora" → app.minharevenda.online | Criar conta em < 2 min, sem cartão | formulário curto, link WhatsApp | vazio, erro | alta |
| S02 | MR | Início (dashboard) | após login | Resumo de vendas, pendências | cards de indicadores | vazio (conta nova), preenchido | média |
| S03 | MR | Configurações (marcas, Pix, conta) | menu | Escolher marcas, cadastrar chave Pix | listas de seleção, campos | — | alta (6 tutoriais) |
| S04 | MR | Estoque / produtos | menu | Listar, filtrar, cadastrar, lotes, validade | busca, leitor de código, filtros | vazio, vencendo, preenchido | alta |
| S05 | MR | Cadastro de produto (do catálogo de marca) | estoque → novo | Puxar produto do catálogo com foto/preço | busca no catálogo, câmera | não encontrado | alta |
| S06 | MR | Importação de planilha | estoque | Carga em massa | upload | erro de formato | média |
| S07 | MR | Compras (incl. NF-e XML/chave) | menu | Registrar entrada e pagamento à marca | upload XML / campo chave | NF inválida | alta |
| S08 | MR | Clientes | menu | Cadastro e histórico | lista, ficha | vazio | alta |
| S09 | MR | Nova venda | atalho / menu | Itens, cliente, parcelas, Pix | seletor de produto, parcelas, QR Pix | sem estoque | alta |
| S10 | MR | Vendas (lista, editar, desfazer, compartilhar) | menu | Gerir vendas | lista, filtros, compartilhar | — | alta (6 tutoriais) |
| S11 | MR | Financeiro | menu | Receitas, despesas, previstos | gráficos, filtros | — | alta (9 tutoriais) |
| S12 | MR | Cobranças / atrasados | menu | Quem deve e desde quando | lista com status | nenhum atraso | alta |
| S13 | MR | Loja online (config + vitrine pública) | menu | Personalizar e vender online | editor de cores/logo, carrinho | loja vazia | alta |
| S14 | MR | Divulgação (catálogo PDF) | menu | Gerar material | gerador de PDF | — | média |
| S15 | MR | Relatórios + exportação | menu | Vendas, estoque, lucro | gráficos, export | — | alta |
| S16 | MR | Fidelidade / WhatsApp | v5.0 | Pontos e mensagens | — | — | média |
| S20 | RO | Login / cadastro | app.meurosinha.com.br/auth | Acesso; cadastro com rastreio de origem | formulário | — | alta |
| S21 | RO | Agenda | menu | Sessões, entrevistas, reuniões | calendário | vazio | alta |
| S22 | RO | Contatos / clientes | menu | Fidelização 2+2+2, datas, indicações | ficha, lembretes | — | alta |
| S23 | RO | Vendas e financeiro | menu | Vendas, despesas, bônus, consórcios, lucro | lançamentos, totais | — | alta |
| S24 | RO | Estoque e produtos (catálogos de marcas) | menu | Produtos e quantidades | lista, cadastro | — | média |
| S25 | RO | Trocas entre consultoras | menu | Controle de trocas | lista | — | alta |
| S26 | RO | Metas | menu | Objetivos e progresso | barras de progresso | — | alta |
| S27 | RO | Relatórios | menu | Análises | gráficos | — | média |
| S28 | RO | Loja online | menu + página pública | Vitrine e encomendas | catálogo, pedido | — | alta |
| S29 | RO | WhatsApp (Plus) | menu | Mensagens e lembretes | modelos de mensagem | bloqueado no Básico | alta |
| S30 | RO | Comunidade | menu | Videoaulas, artes, PDFs | biblioteca de conteúdo | — | alta |
| S31 | RO | Ajuda (perguntas e respostas) | dentro do sistema | Autoatendimento | FAQ | — | alta |

---

## 5. Fluxos e experiência (onboarding e UX)

### Minha Revenda

```
F01 Começar a usar
    S01 cadastro (sem cartão, "< 2 min") -> S03 escolher marcas e chave Pix -> S04/S05 cadastrar estoque pelo catálogo ou código de barras
    happy path estimado: ~5-8 toques até o primeiro produto
    apoio: trilha "Primeiros passos" (celular e desktop), assistente virtual, WhatsApp
    edge: produto fora do catálogo de marca; código não reconhecido
F02 Vender parcelado e cobrar
    S09 nova venda -> escolher cliente e itens -> parcelas -> gerar Pix -> S12 acompanhar atraso
F03 Entrada de mercadoria por nota fiscal (novo, v5.0)
    S07 compras -> colar chave de acesso ou enviar XML -> itens viram compra/estoque
F04 Abrir a loja online
    S13 configurar logo/cores -> escolher produtos/preços -> compartilhar link -> pedidos entram no sistema
```

**UX:** foco em **celular** (app nativo nas duas lojas) com versão web; muita **educação embutida** (cursos, mentorias de contador). Onboarding com **teste de 7 dias sem cartão** e cadastro iniciado por WhatsApp — baixo atrito e venda assistida. Ponto de atenção: os links "Termos de Uso", "LGPD", "Documentação" e "Status" do site **não levam a lugar nenhum** (`#`).

### Rosinha

```
F10 Começar a usar
    S20 cadastro -> escolher plano (sem teste grátis; garantia de 7/14 dias) -> configurar perfil
    edge: plano mensal cancela a qualquer momento; semestral/anual só na garantia
F11 Rotina da consultora
    S21 agenda (sessão de beleza) -> S22 registrar contato e indicação -> S23 venda -> S22 pós-venda 2+2+2 (lembrete, WhatsApp no Plus)
F12 Acompanhar resultado
    S23 lucro, bônus e despesas -> S26 metas -> S27 relatórios
```

**UX:** sistema **web responsivo**, sem app nativo (não instala, mas sem câmera nativa/notificações de app). Linguagem e funcionalidades **voltadas à carreira em venda direta** (sessões, entrevistas, equipe), muito alinhadas ao modelo Mary Kay apesar de não citarem a marca. Diferencial forte de **comunidade/conteúdo** e **atendimento humano**, que aparecem nos depoimentos.

---

## 6. Monetização e planos

| | Minha Revenda | Rosinha |
| --- | --- | --- |
| Teste | **7 dias grátis, sem cartão**. *alta* | **Sem teste**; garantia de reembolso 7 dias (termos) / 14 dias nos planos semestral e anual do Básico (página de planos). *alta* |
| Preço base | **Não publicado no site.** O app Revendi, do mesmo desenvolvedor, cobra **R$ 39,90/mês** ou **R$ 349,90/ano**. *média (inferido)* | **Básico: R$ 32,90/mês**, R$ 164,50/semestre, R$ 329,00/ano. *alta* |
| Upsell | **Loja PRO**: R$ 59,90 e R$ 499,90 (provavelmente mensal/anual; a loja não explica). *média* | **Plano Plus** (WhatsApp, lembretes, IA) — preço não publicado. *alta* |
| Cobrança | Assinatura nas lojas de apps (Apple/Google). *alta* | Cartão recorrente, Pix ou boleto; **renovação automática** e **reajuste anual pelo IGPM**. *alta* |
| Cancelamento / dados | Não informado publicamente. | Saldo de planos antecipados **não é devolvido**; após suspensão, dados ficam **90 dias** com exportação em **CSV** e depois são apagados. *alta* |

**Diferenciais que mais atraem (pelo que destacam e pelo que os usuários elogiam):**
- *Minha Revenda:* catálogos de várias marcas prontos (evita digitar), código de barras, **Pix na venda**, cobrança de atrasados, loja online, atualizações frequentes, suporte rápido, conteúdo educativo (inclusive contábil).
- *Rosinha:* foco na rotina completa da consultora (agenda, metas, contatos), **comunidade de conteúdo**, preço de entrada baixo, atendimento personalizado, "tudo online, sem papéis e planilhas".

---

## 7. Dores, limitações e reclamações

### Dos dois produtos (evidência pública)

| Dor | Produto | Evidência | Confiança |
| --- | --- | --- | --- |
| Travamentos e deslogar ao cadastrar produtos | MR/Revendi | Avaliação App Store de 18/11/2025: "toda hora desloga e trava quando to adicionando produtos"; desenvolvedor atribuiu à instabilidade da Cloudflare. (fonte 4) | alta |
| Preço não transparente (site não mostra planos; Loja PRO duplicada sem explicação) | MR | Site e App Store (fontes 1, 3, 4) | alta |
| Links institucionais quebrados (Termos, LGPD, Status) | MR | Site (fonte 1) | alta |
| Sem teste grátis; plano longo não reembolsável após garantia; reajuste IGPM | RO | Planos e termos (fontes 7, 9) | alta |
| WhatsApp e IA só no plano superior, sem preço público | RO | Planos (fonte 7) | alta |
| Sem app nativo (sem leitor de código nativo, notificações limitadas) | RO | Quem somos / site (fontes 6, 8) | alta |
| Informação de base inconsistente ("mais de 1.000" × "quase 1.000") | RO | Site (fontes 6, 8) | alta |
| Exclusão definitiva dos dados 90 dias após suspensão | RO | Termos (fonte 9) | alta |

### Da categoria (apps de vendas/estoque para revenda)

| Dor recorrente | Evidência | Relevância para o TCC |
| --- | --- | --- |
| **Estoque que "some" ou diverge** do físico | Usuários do Kyte relatam números de estoque que desaparecem (fonte 11) | Alta — o ConsultoraSync trata com idempotência, conferência e ajuste justificado. |
| **Falta de variações** (cor/tom/tamanho) | Kyte (fonte 11) | Alta — cosméticos têm tons; o ConsultoraSync já separa variantes. |
| **Dados desatualizados até sair e entrar de novo** (sincronização) | Kyte (fonte 11) | Média — listas que recarregam após alteração resolvem. |
| **Preço e catálogo das marcas desatualizados** | Reclame Aqui, app de representante Eudora/Boticário (fonte 10) | Alta — catálogo por ciclo com prévia de mudanças. |
| **Vendas não computadas / suporte lento** | Reclame Aqui, Vendah (fonte 10) | Média — auditoria por operador e histórico. |
| **Dependência de várias ferramentas** (app de cada marca + caderno + planilha) | Proposta de ambos ("um só lugar"); depoimentos do Rosinha | Alta — é o problema central do briefing. |

---

## 8. Comparação com o ConsultoraSync (estado da branch `feat/painel-gestao`)

| Capacidade | Minha Revenda | Rosinha | ConsultoraSync |
| --- | --- | --- | --- |
| Catálogo de marcas pronto | ✅ | ✅ | ⚠️ catálogo por ciclo importado (lista/planilha), marcas pré-listadas |
| Código de barras | ✅ câmera | ❓ | ✅ câmera + **celular pareado ao PC** |
| Validade / lotes | ✅ | ❌ | ❌ (pendente no PRD) |
| Encomenda por cliente → pedido à marca | ❌ | ❌ | ✅ |
| Conferência da caixa e falta da marca | ❌ | ❌ | ✅ |
| Reserva × disponível | ❌ | ❌ | ✅ |
| Contas por compra, parcial, estorno, crédito | ⚠️ pendências por cliente | ❌ | ✅ |
| Pix gerado na venda | ✅ | ❌ | ❌ |
| Alerta de atrasados | ✅ | ⚠️ lembrete WhatsApp | ⚠️ contas antigas no painel (sem vencimento ativo) |
| NF-e (XML/chave) | ✅ (novo) | ❌ | ❌ planejado em branch própria |
| Loja online | ✅ | ✅ | ❌ (fora do escopo T1) |
| WhatsApp | ✅ | ✅ Plus | ❌ |
| Agenda / metas / comunidade | ❌ | ✅ | ❌ |
| Acesso por função (ajudante/contratada) | ❓ | ❓ | ⚠️ previsto (login pendente) |
| App nativo | ✅ | ❌ | ❌ web responsiva |

**Leitura para o TCC:**
1. Os concorrentes resolvem **venda e cobrança simples**; nenhum comunica o fluxo **encomenda → pedido à marca → conferência → reserva → entrega → conta**, que é justamente o problema relatado no briefing. Esse é o diferencial defensável na banca.
2. **NF-e** deixou de ser hipótese: o Minha Revenda lançou importação por XML/chave na v5.0. Isso valida a ideia original da Duda e reduz o risco técnico percebido; o ConsultoraSync pode diferenciar ligando a NF-e à **conferência da caixa** (o que chegou × o que foi pedido × para quem).
3. **Pix na venda** e **alerta de atraso** são itens baratos que os usuários valorizam — bons candidatos após o login.
4. **Validade** é recurso esperado na categoria (MR já tem) e é dor do briefing.
5. Agenda, metas, comunidade e loja online são diferenciais do Rosinha/MR, mas **fora do núcleo** do TCC.

---

## 9. Modelo de dados inferido (para comparação)

```
Produto (MR)   nome, marca, foto, preço, código de barras, categoria, lote, validade
               evidência: site (validade, código), ajuda "Estoque: lotes, planilhas"   confiança: média
Venda (MR)     cliente, itens, total, parcelas[], forma (Pix...), status de pagamento
               evidência: site (parcelamento, Pix, status), ajuda "Vendas: desfazer"   confiança: média
Compra (MR)    marca/fornecedor, itens, pagamentos, origem NF-e (XML/chave)
               evidência: App Store v5.0, ajuda "Compras"   confiança: média
Cliente (MR)   nome, contato, pendências, pontos de fidelidade                         confiança: suposição (pontos)
Loja (MR)      logo, cores, produtos expostos, promoções, pedidos                      confiança: alta
Compromisso (RO) tipo (sessão, entrevista, reunião, pessoal), data, cliente            confiança: alta
Contato (RO)   cliente, datas importantes, indicações, etapa 2+2+2                     confiança: média
Lançamento (RO) tipo (venda, despesa, bônus, consórcio), valor, data                  confiança: média
Meta (RO)      indicador (sessões, contatos, entrevistas, vendas), alvo, período       confiança: alta
Troca (RO)     consultora, produto dado, produto recebido                              confiança: suposição
```

Comparado a isso, o modelo do ConsultoraSync (Encomenda, CompraMarca, ItemCompraMarca com destinação, EstoqueItem com presentes/reservados/pronta-entrega, Conta, PagamentoConta, Excedente, crédito) é **mais rico no ciclo pedido-recebimento-conta** e mais pobre em relacionamento (agenda, metas) e venda online.

---

## 10. Matriz de funcionalidades

Ver [`features.csv`](features.csv). Colunas no formato do pacote replica: `original` = quem oferece (MR, RO, MR+RO); `clone` = situação no ConsultoraSync (`yes`, `partial`, `no`, `skip`). Total: must 14, should 10, could 8, skip 4.

## 11. O que não se replica (e não deve)

- **Catálogos e fotos das marcas** montados pelos concorrentes: são dados deles (e imagens com direitos das marcas). O ConsultoraSync usa importação feita pela própria revendedora.
- **Comunidade, videoaulas, mentorias com contador**: conteúdo próprio e relacionamento, não software.
- **Base de usuárias, avaliações e reputação nas lojas.**
- **Integração oficial com WhatsApp Business**: exige conta e aprovação da Meta; para o TCC, no máximo links `wa.me` com mensagem pronta.
- Termos do Rosinha proíbem uso automatizado de dados e prestação de serviço a terceiros com a ferramenta; esta análise usou apenas páginas públicas lidas manualmente.

## 12. Tamanho e próximos passos

- **Telas mapeadas:** 16 (MR) + 12 (RO). **Fluxos:** 7. **Entidades inferidas:** 10.
- **Partes difíceis, se forem incorporadas:** importação de NF-e ligada à conferência; geração de Pix (BR Code estático é viável sem banco; cobrança com confirmação automática exige PSP); loja online com pedidos.
- **Limitações desta análise:** sem acesso aos produtos por dentro (sem conta), sem dados do Google Play e sem avaliações públicas do Rosinha; preços do Minha Revenda inferidos do app Revendi. Para o TCC, recomenda-se complementar com **teste dos períodos gratuitos pela própria pesquisadora** (respeitando os termos) e registrar capturas como evidência.
- **Próximos passos sugeridos:** (1) validade/lotes; (2) Pix estático + alerta de atraso; (3) NF-e na branch `feat/nota-fiscal`, ligada à conferência; (4) usar a seção 8 como tabela de trabalhos relacionados na monografia.
