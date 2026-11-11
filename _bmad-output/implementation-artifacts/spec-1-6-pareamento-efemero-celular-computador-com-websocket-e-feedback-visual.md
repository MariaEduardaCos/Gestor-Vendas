---
title: 'Story 1.6: Pareamento Efêmero Celular-Computador com WebSocket e Feedback Visual'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: 'f81db64'
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

**Problem:** A revendedora trabalha sentada em frente ao computador para registrar compras, conferir caixas ou gerenciar contas, mas digitar manualmente dezenas de códigos de barras é lento e cansativo. Além disso, ela não quer comprar um leitor ótico USB dedicado e nem expor suas senhas, clientes ou contas bancárias conectando o celular com login completo.

**Approach:** Implementar um pareamento efêmero entre o computador e o celular baseado em QR Code e WebSockets no Fastify (`@fastify/websocket`). O computador solicita uma sessão efêmera (TTL de 10 minutos) e gera um QR Code na tela. A revendedora aponta a câmera do celular para o QR Code e abre uma página limpa que se conecta ao canal do computador sem exigir login, transmitindo os eventos de leitura (*bip*) em tempo real com indicador visual transparente de status da conexão ("Conectado", "Reconectando", "Sessão Expirada com renovação em 1 toque") em ambos os aparelhos (FR-014, AD-6, UX-DR9).

## Boundaries & Constraints

**Always:**
- O token de pareamento possui TTL estrito de 10 minutos (600.000 ms) e é gerado com aleatoriedade criptográfica no servidor (AD-6, FR-014).
- A página do celular aberta via QR Code opera unicamente como transmissor ótico de códigos de barras e é terminantemente proibida de acessar clientes, saldos, contas ou relatórios financeiros (AD-6).
- A conexão WebSocket entre celular e computador notifica ambas as pontas em tempo real sobre mudanças de status: `CONECTADO`, `DESCONECTADO`, `EXPIRADO` (UX-DR9).
- Ambas as telas exibem status visual claro com texto e cor para não depender apenas de cromática (ex: pílula verde com texto *"Celular Conectado"*, amarela com *"Aguardando Celular"*, vermelha com *"Sessão Expirada"*).
- Botão grande de renovação em 1 toque (alvo >= 48px) disponível caso a sessão expire após os 10 minutos.

**Never:**
- Nunca exigir credenciais, senhas ou login do operador na página de leitor remoto do celular (AD-6).
- Nunca permitir que mensagens enviadas pelo celular acessem ou modifiquem dados de outras operações (isolamento garantido pelo `operacao_id` associado ao token no servidor).
- Nunca perder o estado da tela no computador ao reconectar o celular.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Computador abre aba de Pareamento | Usuário clica em "Parear Celular como Leitor" | Servidor gera token efêmero com TTL 10m; tela exibe QR Code nítido e status "Aguardando leitura do QR Code" | Se rede falhar ao gerar token, exibe mensagem acolhedora com botão de tentar novamente |
| Celular lê QR Code | Câmera do celular abre URL com token | Celular conecta ao WebSocket do token; ambos os lados atualizam status para "Conectado" em verde | Se token for inválido ou expirado, celular exibe tela de "Sessão Expirada no Computador" |
| Celular bipa código de barras | Leitura válida com filtro anti-duplicação 1,5s no celular | Celular envia `{ tipo: 'SCAN', codigo: '789...' }`; computador recebe o código instantaneamente e consulta catálogo/estoque | Se conexão cair no envio, tenta reconectar e avisa "Reconectando..." |
| Sessão atinge TTL de 10 minutos | Tempo decorrido > 10m sem renovação | Canal fecha automaticamente com status `EXPIRADO`; tela exibe botão "Renovar Sessão em 1 Toque" | Renova token mantendo interface operacional intacta |
| Celular perde conexão Wi-Fi/4G | Celular desconecta do WebSocket | Computador exibe status "Celular Desconectado" (amarelo) aguardando reconexão | Reconexão automática com backoff exponencial suave |

</frozen-after-approval>

## Code Map

- `packages/core/src/domain/pareamento.ts` -- Tipos e protocolo de mensagens de pareamento (`PareamentoMensagem`, `StatusPareamento`, `SessaoPareamentoDTO`, validação de TTL).
- `packages/core/src/index.ts` -- Re-exportação dos tipos e utilitários de pareamento.
- `packages/core/tests/pareamento.test.ts` -- Testes unitários do protocolo de mensagens e regras de TTL.
- `packages/server/src/infrastructure/pareamentoHub.ts` -- Gerenciador em memória de sessões e canais WebSocket para conexões desktop e mobile.
- `packages/server/src/routes/pareamento.ts` -- Endpoints HTTP (`POST /api/pareamento/criar`, `POST /api/pareamento/renovar`) e rota WebSocket (`GET /ws/pareamento/:token`).
- `packages/server/src/index.ts` -- Registro do plugin `@fastify/websocket` e rotas de pareamento.
- `packages/server/tests/pareamento.test.ts` -- Testes automatizados de criação de sessão, expiração de TTL e troca de mensagens via WebSocket.
- `packages/web/src/components/PainelPareamentoDesktop.tsx` -- Componente no computador com renderização do QR Code, status em tempo real e botão de renovação em 1 toque.
- `packages/web/src/components/LeitorRemotoMobileView.tsx` -- Tela minimalista e rápida para o celular com câmera contínua, status de conexão e envio de leituras via WebSocket.
- `packages/web/src/App.tsx` -- Roteamento do leitor remoto para celulares que acessarem a URL do QR Code (`?leitor_token=...`).

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/domain/pareamento.ts` e testes -- Definir protocolo de mensagens tipadas e regras de expiração de TTL.
- [x] `packages/server/src/infrastructure/pareamentoHub.ts` -- Implementar hub em memória para emparelhar socket desktop e socket mobile com TTL de 10 minutos.
- [x] `packages/server/src/routes/pareamento.ts` -- Criar endpoints REST de emissão/renovação de token e endpoint WebSocket.
- [x] `packages/server/tests/pareamento.test.ts` -- Criar testes de integração validando criação, renovação, isolamento e envio de eventos `SCAN`.
- [x] `packages/web/src/components/PainelPareamentoDesktop.tsx` -- Criar componente desktop com QR Code gerado via `qrcode`, status visual e listener de bips.
- [x] `packages/web/src/components/LeitorRemotoMobileView.tsx` -- Criar tela remota para celular com auto-start da câmera e feedback de conexão.
- [x] `packages/web/src/App.tsx` e `VisorView.tsx` -- Integrar pareamento na interface de Dona Sônia com alternância fluida entre leitor local e pareado.

**Acceptance Criteria:**
- Given que a revendedora abre a tela de Leitor no computador, when a sessão é iniciada, then o servidor gera um token de pareamento com TTL de 10 minutos e o computador exibe um QR Code com a URL efêmera (FR-014, AD-6).
- Given que a revendedora lê o QR Code com o celular, when a página do celular abre, then ela inicia diretamente em tela cheia na câmera sem exigir login e sem exibir dados de clientes ou contas, conectando-se ao canal WebSocket efêmero (FR-014, AD-6, UX-DR9).
- Given a conexão ativa entre o celular e o computador, when o celular bipa um código, then o evento de bip chega ao computador em tempo real, and tanto o computador quanto o celular exibem indicador visual transparente do status da conexão ("Conectado", "Reconectando" ou "Sessão Expirada com botão de renovar em 1 toque") (FR-014, UX-DR9).

## Implementation Notes

- Protocolo de pareamento puro e regras de validação de TTL implementados em `packages/core/src/domain/pareamento.ts`.
- Hub em memória de sessões efêmeras implementado em `packages/server/src/infrastructure/pareamentoHub.ts` com isolamento estrito por `operacao_id`, timers de TTL de 10 minutos (600.000 ms), broadcast seguro para desktops da mesma sessão e suporte a reconexão automática com detecção de queda.
- Rotas HTTP (`/api/pareamento/criar`, `/api/pareamento/renovar`, `/api/pareamento/:token`) e WebSocket (`/ws/pareamento/:token`) criadas com `@fastify/websocket`.
- Testes unitários do core (8 testes) e testes de integração com WebSocket real no Fastify (7 testes) implementados e validados, cobrindo criação, renovação, expiração, isolamento multi-inquilino e tráfego de bips.
- Componente `PainelPareamentoDesktop.tsx` com geração de QR Code via `qrcode`, contagem regressiva de tempo restante, pílulas de status semânticas (verde, amarelo, vermelho) e botão de renovação em 1 toque (alvo >= 48px).
- Componente `LeitorRemotoMobileView.tsx` responsivo, auto-iniciando câmera contínua sem exigir credenciais/login e sem carregar dados confidenciais (clientes/financeiro), com debounce de 1,5s via `FiltroAntiDuplicacao` e reconexão suave.
- `VisorView.tsx` integrado com alternância instantânea entre Leitor Local e Celular Remoto, preservando histórico de leituras e estado do catálogo em tela.
- `App.tsx` roteia automaticamente qualquer requisição móvel com `?leitor_token=...` ou `?t=...` direto para a tela de leitura ótica sem passar por tela de autenticação.

## Spec Change Log

- 2026-11-11: Adicionado suporte a `APP_BASE_URL`, `origin` e `referer` para construção dinâmica da URL de pareamento no QR Code, garantindo funcionamento tanto em localhost quanto em rede local Wi-Fi.
- 2026-11-11: Adicionado botão "Tentar Reconectar Agora" na tela de sessão expirada do celular para reconexão em 1 toque sem necessidade de re-escanear o QR Code.

## Review Triage Log

- Review Triage (Blind Hunter, Edge Case Hunter & Verification Gap):
  - Corrigido: Isolamento multi-inquilino na renovação da sessão (`pareamentoHub.ts`). Adicionada verificação estrita de `sessao.operacao_id === operacao_id`.
  - Corrigido: Memory leak na expiração de sessões (`pareamentoHub.ts`). Adicionado `this.sessoes.delete(token)` ao término do TTL.
  - Corrigido: Notificação de desconexão do desktop para o celular (`pareamentoHub.ts`). Adicionado `broadcastParaMobiles` com status `DESCONECTADO` quando o desktop fecha a conexão.
  - Corrigido: Stale closure e loop de reconexão no desktop (`PainelPareamentoDesktop.tsx`). Adicionado `statusRef` e removido `status` das dependências do `useCallback(conectarWs)`.
  - Corrigido: Drift de contador regressivo de TTL no desktop (`PainelPareamentoDesktop.tsx`). Sincronizado contra data real `expiraEm` retornada pelo servidor.
  - Corrigido: Concorrência e race conditions nos testes do servidor (`pareamento.test.ts`). Limpeza isolada apenas aos IDs do teste de pareamento, preservando isolamento entre arquivos de teste do Vitest.

## Design Notes

O pareamento efêmero utiliza conexões WebSocket diretas sobre o mesmo servidor HTTP do Fastify (`@fastify/websocket`), garantindo custo zero e compatibilidade com redes locais (Wi-Fi doméstico) ou nuvem. O isolamento operacional é absoluto: o token efêmero guarda o `operacao_id` no servidor, e a conexão móvel só tem permissão de emitir mensagens do tipo `SCAN` e `PING`, impossibilitando leitura de bancos de dados a partir do dispositivo móvel do leitor.
