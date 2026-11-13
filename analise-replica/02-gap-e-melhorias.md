# Diagnóstico de lacunas e melhorias — ConsultoraSync × Minha Revenda × Rosinha

- **Data:** 2026-11-12 · **Base:** branch `feat/painel-gestao` (commit `00bd271`)
- **Entradas:** [01-recon-concorrentes.md](01-recon-concorrentes.md), [features.csv](features.csv), código em `packages/`, PRD/épicos/decisões em `_bmad-output/`, `docs/` e `artefatos/`.
- **Como ler:** cada item cita onde está no código (arquivo) ou no planejamento (FR/NFR/UX-DR/épico). "MR" = Minha Revenda, "RO" = Rosinha.
- **Escopo:** diagnóstico comparativo e roadmap. Mantém a stack atual (o pacote replica recomenda usar a stack que o projeto já domina); a seção 6 lista os riscos técnicos no formato "partes que mordem" da skill de arquitetura.

---

## Resumo executivo

1. **O núcleo do ConsultoraSync já supera os dois concorrentes** no ciclo *encomenda → pedido à marca → conferência da caixa → reserva → entrega → conta*. Nenhum dos dois comunica esse fluxo publicamente, e ele está implementado com idempotência, concorrência e auditoria, coberto por 215 testes automáticos.
2. **Onde perdemos hoje:** acesso e confiança (não há tela de login nem perfis), finanças de resultado (ganho, despesas, boletos), validade, Pix na venda, relatórios com gráficos e período, e "produto pronto para usar" (PWA instalável, onboarding, exportação de dados).
3. **Quase tudo que falta já está planejado** no PRD como P2/INV (FR-005, FR-042 a FR-056). As lacunas *fora* do planejamento são poucas e mais de experiência: Pix copia-e-cola, exportação CSV, PWA/onboarding, busca global e relatórios visuais.
4. **Recomendação:** antes de novas funcionalidades, fechar segurança e acesso (login com PIN e trava do `dev-session`), que é pré-requisito para qualquer demonstração fora da máquina. Em seguida, os *quick wins* de alto impacto visível na banca: Pix, exportação, PWA e relatório do mês. Depois, NF-e ligada à conferência e validade, que são os dois diferenciais técnicos mais fortes.

---

## 1. O que já temos pronto e funciona bem

| Capacidade | Onde está | Comparação | Evidência |
| --- | --- | --- | --- |
| **Encomenda por cliente vinculada ao pedido à marca** (consolida várias encomendas + pronta-entrega) | `server/src/routes/encomendas.ts`, `compras.ts`; `CompraMarcaModal.tsx`; página Pedidos | **Supera MR e RO** (nenhum comunica) | Épico 2; `tests/compras-marca.test.ts` |
| **Conferência da caixa** com destinação obrigatória, recebimento parcial e falta da marca | `compras.ts` (conferência/falta-fabrica), `ConferenciaCaixaModal.tsx` | **Supera** | Épico 3; `tests/conferencia-caixa.test.ts` |
| **Estoque em 4 estados** (em casa, separado p/ cliente, pronta-entrega, a chegar) com invariante `Presentes = Reservados + ProntaEntrega` | `core/domain/estoque.ts`, `routes/estoque.ts`, página Estoque | **Supera** (MR tem estoque simples) | AD-3; `tests/estoque.test.ts`, `entrega-fisica.test.ts` |
| **Venda com bloqueio da última unidade** e entrega separada do pagamento | `routes/vendas.ts` (transação + idempotency_key) | **Supera** em consistência | NFR-001; `tests/vendas-pronta-entrega.test.ts` |
| **Contas por compra**: pagamento parcial (Pix/dinheiro/cartão com taxa), estorno auditado, excedente, devolução e **carteira de crédito** | `routes/contas.ts`, `ClienteFichaModal.tsx` | **Supera** (MR tem pendências por cliente; RO não tem) | Épico 5; `tests/contas-pagamentos-excedentes.test.ts` |
| **"Visão só do que já chegou"** (não cobra item aguardando a marca) | `GET /api/contas/:id` (projeção AD-4) | **Exclusivo** | FR-033, CT-16 |
| **Cobrança de atrasados**: vencimento único/parcelado, parcelas que se ajustam ao cancelamento, situação Atrasada, botão Cobrar (WhatsApp com mensagem pronta) | `core/domain/cobranca.ts`, `routes/cobranca.ts`, `ContasPage.tsx`, `HojePage.tsx` | **Empata com MR** em atraso; **supera** em regra (parcela ajustável, sem vencimento ≠ atraso) | FR-036; `tests/cobranca.test.ts` (core e server) |
| **Comissão por marca salva** e custo estimado com origem (informado/estimado/desconhecido), congelado na venda | `core/domain/produto.ts`, `MarcasPage.tsx`, imutabilidade | **Supera** (nenhum mostra origem do custo) | FR-011/012/019; `tests/imutabilidade-custo.test.ts` |
| **Catálogo do ciclo** com prévia de novos/preço alterado + **catálogo compartilhado** entre revendedoras | `core/domain/catalogo.ts`, `routes/catalogo.ts`, `CatalogoModal.tsx` | MR tem catálogo pronto (melhor para o usuário no dia 1); nossa prévia e o modelo colaborativo são **diferenciais** | `tests/catalogo.test.ts` |
| **Código de barras**: câmera, leitor USB, digitação; na venda, encomenda, conferência; **celular pareado ao PC** | `VisorLeituraHibrido.tsx`, `BipadorProdutos.tsx`, `routes/pareamento.ts` | Empata com MR na leitura; **pareamento é exclusivo** | FR-007/009/014 |
| **Isolamento multi-operação e auditoria nominal** | `db/tenant-prisma.ts`, `plugins/session.ts`, `RegistroAuditoria` | Não comunicado pelos concorrentes | NFR-002/003; `tests/isolation.test.ts` |
| **Painel web responsivo** (computador com menu lateral, celular com barra inferior) | `layout/AppShell.tsx`, `pages/*` | Empata com MR (web + app); **supera RO** em celular | NFR-004 |

**Qualidade:** 84 testes de domínio + 131 de integração passando; testes usam banco próprio (`test.db`). Não há testes de interface (ver seção 2).

---

## 2. Planejado no BMAD, mas ainda não codado

### Requisitos funcionais P2 e INV (PRD)

| Requisito | O que pede | Cobre qual concorrente | Situação no código |
| --- | --- | --- | --- |
| **FR-005** Pessoa contratada | Perfil que vende e recebe, mas não mexe em pedidos às marcas nem permissões | Acesso por função (nenhum dos dois detalha) | ❌ Não há tela de login nem perfis. A API tem `POST /api/auth/login` com PIN (sha256), mas o site entra sempre por `dev-session` |
| **FR-042/043** Boleto por compra e pagamento | Obrigação com a marca, valor, vencimento, marcar pago/reverter | MR (financeiro a pagar) | ❌ |
| **FR-044** Resumo financeiro (a receber × a pagar) | Distinguir crédito de cliente, saldo não controlado | MR/RO (financeiro) | ⚠️ Parcial: `FinanceiroPage` mostra vendido/recebido/a receber; sem "a pagar" |
| **FR-045–048** Ganho calculável, custo desconhecido, taxas, ajustes | Ganho proporcional ao pagamento (CF-01 a CF-09) | MR (lucratividade), RO (cálculo de lucro) | ❌ Os dados existem (custo congelado por item, taxa por pagamento); falta o cálculo e a tela |
| **FR-049** Recorrência no perfil | Produtos que a cliente compra sempre, com último pedido | RO (fidelização) | ❌ |
| **FR-050/051** Validade e produto vencido | Validade por grupo de entrada, alerta, bloqueio de venda, baixa de perda | **MR tem** (alerta de vencimento) | ❌ Dor do briefing ("vencidos achados na faxina") |
| **FR-056** Percentual padrão de taxa por modalidade | Taxa da maquininha pré-preenchida | — | ❌ Hoje a taxa é digitada a cada pagamento |
| **FR-052** Dados externos (INV) | Consulta a base aberta pelo código, com fonte | MR (cadastro pelo catálogo) | ⚠️ Substituído em parte pelo catálogo compartilhado; Open Beauty Facts não integrado |
| **FR-053** Referências de preço (INV) | Comparação com fonte e data | — | ❌ |
| **FR-054** Importar documentos (INV) | Prévia de itens de documento, sem movimentar estoque | **MR tem NF-e (XML/chave) desde a v5.0** | ❌ Planejado em `feat/nota-fiscal` |
| **FR-055** Enviar pedido à marca (INV) | Só com integração autorizada | Nenhum | ❌ Corretamente bloqueado (sem API das marcas) |

### Requisitos não funcionais e de UX ainda abertos

| Item | Situação |
| --- | --- |
| **NFR-006** Busca/confirmação ≤ 2 s com 1.000 produtos e 500 clientes | Não medido. O selo "Homologada" foi removido da tela por isso; falta o teste de carga. |
| **NFR-008** Queda de rede: banner e proteção contra reenvio | Idempotência no servidor ✅; **não há banner de conexão** no site. |
| **NFR-009** Exportação e recuperação de cópia do banco | ❌ Não há backup/exportação pela interface. |
| **NFR-011** Câmera em contexto seguro | ⚠️ `npm run dev:celular` (HTTPS autoassinado) resolve em desenvolvimento; sem endereço público com certificado válido. |
| **UX-DR2** Visor com abertura automática na venda | ⚠️ Na venda e encomenda o leitor abre por botão (decisão para não pedir câmera sem necessidade). Registrar a decisão. |
| **UX-DR6** Alternador "conta completa × só o que chegou" | ✅ Na ficha; não aparece na lista de contas. |
| **UX-DR7** Barra de ação fixa no celular | ⚠️ Barra de navegação fixa ✅; modais longos (venda) têm rodapé fixo, ficha da cliente não. |
| **Retro épico 1 — "Modularização de páginas e rotas do frontend"** | ✅ Resolvido pelo painel com rotas (pode ser fechado no `sprint-status.yaml`). |
| **Retro épico 1 — "Testes de componentes visuais no frontend"** | ❌ Ainda aberto: `packages/web` não tem nenhum teste. |

### Itens do plano original (`docs/PLANO_ARQUITETURAL_E_ROADMAP.md`) que ficaram pelo caminho

- **Fase 1:** Open Beauty Facts e "régua de cobrança WhatsApp". A régua virou o botão Cobrar manual; os lembretes automáticos continuam faltando.
- **Fase 2:** parser de DANFE (PDF/XML) com **rateio proporcional do frete** no custo. O rateio é um diferencial que nem o MR comunica.
- **Fase 3:** scraper de revistas e mini-loja pública. O scraper foi descartado por risco jurídico e de quebra; a mini-loja está fora do T1 pelo briefing.

---

## 3. Lacunas reais (nem no código nem no planejamento)

### Produto

| Lacuna | Quem tem | Impacto | Observação |
| --- | --- | --- | --- |
| **Pix na venda e na cobrança** (QR / copia-e-cola com valor) | MR | **Alto** — reduz atrito no recebimento | BR Code estático com a chave da revendedora: sem banco, sem custo. A confirmação continua manual. |
| **Exportação de dados (CSV)** de clientes, contas, vendas e estoque | MR (exportação), RO (CSV só após suspensão) | **Alto** para confiança e LGPD | Também atende parte do NFR-009. |
| **Relatórios com período e gráficos** (vendas do mês, mais vendidos, melhores clientes) | MR, RO | **Alto** na percepção de valor | Base pronta; depende do FR-045 para mostrar ganho. |
| **Despesas gerais** (gasolina, sacolas, brindes) além dos boletos | MR, RO | Médio | O PRD só prevê boletos (FR-042); sem despesas o "lucro" fica superestimado. |
| **Lembretes automáticos** (lista diária de quem cobrar, aniversários, pós-venda) | RO (Plus), MR | Médio | Sem a API paga do WhatsApp: gerar a **fila do dia** com botões wa.me. |
| **Data de aniversário e pós-venda** na ficha | RO (2+2+2) | Médio | Campo simples + filtro "aniversariantes da semana". |
| **Divulgação**: catálogo em PDF ou link de vitrine | MR, RO | Médio | Vitrine é "could" (fora do T1); o PDF da pronta-entrega é barato. |
| **Programa de fidelidade** | MR (v5.0) | Baixo | Pode esperar. |
| **Agenda, metas, trocas entre consultoras, comunidade** | RO | Baixo para o núcleo | Fora do foco do TCC (rotina de carreira, não de operação). |

### Experiência (UX)

| Lacuna | Por que importa | Sugestão |
| --- | --- | --- |
| **Sem login e sem "quem está usando"** | Ajudante e revendedora não se distinguem na tela; a auditoria registra sempre "Dona Sônia" | Tela de entrada com escolha de pessoa + PIN (API já existe). |
| **App instalável (PWA) e ícone na tela inicial** | MR tem app nas lojas; RO não. Para a revendedora, "app" = ícone | `manifest.webmanifest` + service worker simples (cache de leitura). |
| **Onboarding do primeiro acesso** | MR: "< 2 min", cursos; nós: tela vazia + aviso de marcas | Assistente de 3 passos: marcas → catálogo (compartilhado) → primeira cliente; opção "carregar dados de exemplo" para a banca. |
| **Ficha da cliente em janela estreita no computador** | Componente de 1.390 linhas, difícil de usar e manter | Página `/clientes/:id` com abas (Contas, Encomendas, Histórico). |
| **Busca global** (cliente, produto ou código em um só campo) | Atendimento rápido no celular | Campo no topo com resultados agrupados; código de barras também. |
| **Sem aviso de conexão perdida** | NFR-008 | Banner com `navigator.onLine` + bloqueio de envio. |
| **Mensagens de sucesso somem em 5 s, sem "desfazer"** | Medo de errar (público 40+) | Para ações reversíveis, botão "Desfazer" no aviso. |

---

## 4. Oportunidades de diferenciação

| Dor no mercado (recon) | Como entregar melhor | Base já existente |
| --- | --- | --- |
| Encomendas misturadas, caixa não conferida | **Fluxo completo encomenda → caixa → entrega**, com destinação obrigatória e falta da marca | Épicos 2–4 (pronto) — **argumento central da banca** |
| Cobrança e inadimplência | **Cobrança justa e explicável**: "só o que chegou", parcelas que se ajustam, atraso só com vencimento, mensagem pronta, **fila diária de cobrança** e **Pix copia-e-cola** | `cobranca.ts`, AD-4; faltam Pix e fila |
| Catálogo desatualizado / digitar tudo | **Catálogo colaborativo com prévia** + **NF-e que alimenta o catálogo e a conferência** (o que chegou × o que foi pedido × para quem) + **rateio do frete no custo** | `catalogo.ts`; NF-e planejada |
| "Lucro ilusório" (taxas, frete, despesas) | Ganho **com origem do custo** (informado/estimado/desconhecido), taxa absorvida e frete rateado, sem chamar de lucro o que não é | FR-045–048 + D-01 a D-03 |
| Velocidade no celular | PWA instalável, leitura em cache, busca global, celular como leitor do PC | Pareamento pronto; faltam PWA e busca |
| Preço opaco e dados "presos" (RO apaga em 90 dias) | Exportação a qualquer momento; transparência de dados (LGPD) | Falta exportação |
| Instabilidade (avaliação do Revendi: "desloga e trava") | Idempotência, transações e sessão que se recupera sozinha já existem; medir NFR-006 e mostrar na banca | `session.ts`, testes de concorrência |
| Público 40+ | Tokens de contraste, toque de 48 px, linguagem sem jargão (UX-DR1, NFR-005) | Design system aplicado |

---

## 5. Roadmap priorizado

Estimativas para um desenvolvedor, com o ritmo atual do projeto. **QW** = quick win (até ~2 dias); **MP** = médio prazo (3–10 dias).

### Agora — pré-requisito de segurança (antes de mostrar fora da máquina)

| # | Item | Tipo | Esforço | Por quê |
| --- | --- | --- | --- | --- |
| 0.1 | Restringir `POST /api/auth/dev-session` a `NODE_ENV=development` e exigir `SESSION_SECRET` em produção (hoje há segredo padrão no código) | Técnico | 0,5 dia | Qualquer pessoa com o endereço entra como a revendedora |
| 0.2 | **Tela de login com escolha de pessoa + PIN**, e cadastro de ajudante (FR-001; base para FR-005) | Produto | 2 dias | API já existe; destrava auditoria real e perfis |

### Quick wins (alto impacto visível, baixo risco)

| # | Item | Requisito | Esforço |
| --- | --- | --- | --- |
| 1 | **Pix copia-e-cola e QR** na venda, na conta e no botão Cobrar (BR Code estático, chave em Configurações) | Lacuna (MR) | 1–2 dias |
| 2 | **Exportação CSV** de clientes, contas, vendas e estoque + botão "baixar cópia do banco" | NFR-009 + lacuna | 1 dia |
| 3 | **PWA instalável** (manifest, ícone, service worker de cache de leitura) | Lacuna UX | 1 dia |
| 4 | **Banner de conexão** e bloqueio de envio offline | NFR-008 | 0,5 dia |
| 5 | **Fila de cobrança do dia** no Hoje (atrasadas + vencendo hoje, um toque para cada WhatsApp) | Diferenciação | 1 dia |
| 6 | **Taxa padrão por modalidade** pré-preenchida no pagamento | FR-056 | 0,5 dia |
| 7 | **Busca global** no topo (cliente, produto, código) | Lacuna UX | 1–2 dias |
| 8 | Aniversário na ficha + "aniversariantes da semana" no Hoje | Lacuna (RO) | 0,5 dia |
| 9 | Fechar no `sprint-status.yaml` o item de retro "modularização do frontend" | Processo | minutos |

### Médio prazo (diferenciais e P2)

| # | Item | Requisito | Esforço | Dependência |
| --- | --- | --- | --- | --- |
| 10 | **Importação de NF-e (XML/chave)** com prévia, ligada à **conferência da caixa** e ao catálogo; **rateio do frete** no custo | FR-054 | 5–8 dias | Branch `feat/nota-fiscal`; amostras reais de XML |
| 11 | **Validade por grupo de entrada**, alerta de vencendo/vencido, bloqueio de venda e baixa de perda | FR-050/051 | 4–6 dias | Conferência (pronta) |
| 12 | **Ganho do mês** (proporcional ao pagamento, com origem do custo e taxas) + relatório com período e gráficos (vendas, mais vendidos, melhores clientes) | FR-045–048 + lacuna | 4–6 dias | Contratos CF-01 a CF-09 já especificados |
| 13 | **Boletos à marca, despesas e "a pagar"** no Financeiro | FR-042–044 + lacuna | 3–5 dias | Item 12 |
| 14 | **Perfil contratada** (permissões por papel) | FR-005 | 2–3 dias | Item 0.2 |
| 15 | **Ficha da cliente como página** (`/clientes/:id`) e quebra do `ClienteFichaModal` (1.390 linhas) e de `compras.ts` (1.319 linhas) | Retro + manutenção | 3–4 dias | — |
| 16 | **Testes de interface (Playwright)** dos fluxos principais + **medição do NFR-006** com 1.000 produtos/500 clientes | Retro + NFR-006 | 3–4 dias | — |
| 17 | **Publicação para a banca** (endereço HTTPS público, banco persistente, backup) | NFR-011/012 | 2–3 dias | Itens 0.1, 0.2 |
| 18 | Recorrência no perfil | FR-049 | 1–2 dias | — |

### Depois / fora do núcleo do TCC

Vitrine/loja online, programa de fidelidade, agenda e metas, trocas entre consultoras, API oficial do WhatsApp Business, Open Beauty Facts (FR-052) e referências de preço (FR-053).

### Sequência sugerida

`0.1 → 0.2 → 1 → 2 → 5 → 3 → 4 → 6 → 10 (NF-e) → 11 (validade) → 12 → 13 → 16 → 17`

Racional: segurança primeiro; depois o que a revendedora sente no dia a dia (receber, exportar, cobrar); em seguida os dois diferenciais técnicos (NF-e na conferência e validade); por último resultado financeiro, qualidade mensurável e publicação.

---

## 6. Riscos técnicos ("partes que mordem")

| Tema | Situação | Ação |
| --- | --- | --- |
| **Autenticação** | `dev-session` aberto em qualquer ambiente; segredo de sessão padrão no código; CORS com `origin: true` | Itens 0.1/0.2; restringir CORS ao domínio publicado |
| **Fuso horário** | Vencimentos usam o dia de Brasília (`hojeNoFuso`); demais datas em UTC | Manter datas de calendário como `AAAA-MM-DD`; revisar relatórios por período |
| **Idempotência** | Venda, pagamento, conferência ✅; vencimentos e catálogo são substituições idempotentes ✅ | Cobrir NF-e (chave de acesso única) |
| **Concorrência** | Última unidade protegida ✅ | Validade: não vender grupo vencido em corrida |
| **Multi-operação** | Isolamento por `operacao_id` ✅; **`produtos_referencia` é global de propósito** (sem dados da operação) | Documentar no TCC; manter fora do `tenantPrisma` |
| **Busca** | `contains` no SQLite, sem índice de texto | Medir (NFR-006) antes de otimizar |
| **Offline** | Sem cache nem banner | Itens 3 e 4 |
| **Banco** | SQLite local; sem backup pela interface | Item 2 e 17 (SQLite com volume persistente ou Postgres gerenciado) |
| **LGPD** | Dados de clientes (nome, telefone, endereço); sem exportação/exclusão completa pela interface | Exportação (item 2) e exclusão de cliente já existente; registrar base legal no TCC |
| **Manutenção** | Componentes e rotas com mais de 1.300 linhas; frontend sem testes | Itens 15 e 16 |

---

## 7. Resumo em cinco linhas

- **Prontos e acima do mercado:** fluxo encomenda→caixa→entrega, contas justas com crédito/excedente, cobrança com parcelas, catálogo com prévia e compartilhado, celular como leitor.
- **Planejado e não codado:** login/perfis, validade, ganho/boletos/despesas, NF-e, taxa padrão, recorrência, testes de interface e métricas de desempenho.
- **Lacunas fora do plano:** Pix copia-e-cola, exportação CSV, PWA/onboarding, busca global, relatórios com gráficos, fila diária de cobrança.
- **Maiores riscos:** acesso sem login, publicação (HTTPS/banco/backup) e ausência de testes de interface.
- **Próximo passo:** itens 0.1 e 0.2 (segurança e login), depois o Pix (item 1).
