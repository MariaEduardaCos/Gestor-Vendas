---
title: 'Story 1.5: Visor de Leitura Híbrido com Câmera Contínua e Filtro Anti-Duplicação'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '0352797ab23a2fc2c626ca4ca383be03a1007b67'
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

**Problem:** A revendedora precisa conferir e identificar dezenas de frascos rapidamente sem cansaço visual, sem cliques intermediários para abrir a câmera a cada produto e sem que segurar o produto em frente à lente registre unidades repetidas acidentalmente.

**Approach:** Criar o serviço de debounce anti-duplicação no `@consultorasync/core`, enriquecer o endpoint de lookup de produto por código de barras no `@consultorasync/server`, e desenvolver o componente `VisorLeituraHibrido` no `@consultorasync/web` com auto-start (zero cliques), modo contínuo com feedback sonoro suave (*bip*), campo manual inferior de fallback e diálogo de cadastro imediato para códigos não cadastrados (FR-007, FR-008, FR-009, UX-DR2).

## Boundaries & Constraints

**Always:**
- O visor inicia automaticamente ao montar o componente quando a permissão de câmera estiver concedida, sem botão prévio de "abrir câmera" (UX-DR2).
- Filtro anti-duplicação com debounce estrito de 1,5 segundos (1500ms) para repetições do mesmo código de barras (FR-009).
- Emissão de feedback sonoro suave (*bip*) na leitura válida confirmada (UX-DR2).
- Alternativa manual de digitação sempre acessível e funcional logo abaixo do visor, sem bloqueio de fluxo em caso de falha ou recusa da câmera (FR-007, NFR-004).
- Se o código lido não existir no catálogo, exibir diálogo imediato para cadastro manual com o código pré-preenchido (FR-008).
- Todas as consultas de produtos por código de barras respeitam o isolamento por `operacao_id` (NFR-002).

**Never:**
- Nunca somar ou duplicar leituras do mesmo código antes do término da janela de debounce de 1,5s.
- Nunca travar a interface ou impedir o uso manual caso a câmera não esteja disponível ou a permissão seja negada.
- Nunca confirmar transações financeiras ou saídas físicas isoladamente apenas pela leitura do código sem confirmação explícita (FR-007, FR-009).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Leitura contínua válida com código cadastrado | Câmera enquadra código EAN existente | Emite som *bip*, exibe detalhes e estoque do produto na metade inferior | N/A |
| Repetições do mesmo código dentro de 1,5s | Produto mantido no enquadramento por 2s | Apenas a primeira leitura é processada; leituras repetidas em < 1,5s são ignoradas sem emitir bips adicionais | Debounce anti-duplicação ativo |
| Leitura de códigos distintos em sequência rápida | Produto A seguido de Produto B em 500ms | Ambas as leituras são processadas individualmente (código diferente reseta o bloqueio) | N/A |
| Código de barras não cadastrado | Leitura de código ausente do banco | Exibe diálogo acolhedor sugerindo cadastrar o novo produto com o código já preenchido | Retorna 404 RFC 7807 permitindo cadastro imediato |
| Falha ou recusa de permissão da câmera | Câmera bloqueada / sem HTTPS ou permissão negada | Exibe mensagem explicativa acolhedora mantendo campo inferior de digitação em foco | Permite busca manual sem bloqueio |

</frozen-after-approval>

## Code Map

- `packages/core/src/domain/scanner.ts` -- Serviço de domínio `FiltroAntiDuplicacao` com controle de debounce temporal e validação de códigos.
- `packages/core/src/index.ts` -- Re-exportação de `FiltroAntiDuplicacao`.
- `packages/core/tests/scanner.test.ts` -- Testes unitários para debounce de 1500ms, códigos distintos e sanitização.
- `packages/server/src/routes/produtos.ts` -- Endpoint de consulta rápida por código de barras (`GET /api/produtos/codigo/:codigo`) retornando produto e estoque atual.
- `packages/server/tests/produtos.test.ts` -- Testes de integração de busca por código existente e 404 para código inexistente.
- `packages/web/src/utils/audio.ts` -- Emissor sonoro de confirmação (*bip*) suave via Web Audio API nativa.
- `packages/web/src/components/VisorLeituraHibrido.tsx` -- Componente híbrido com auto-start da câmera (`html5-qrcode`), modo contínuo, tratamento de erros e campo manual inferior.
- `packages/web/src/components/VisorView.tsx` -- Tela/Página operacional dedicada ao visor contínuo com histórico de itens bipados e diálogo de cadastro para códigos novos.
- `packages/web/src/App.tsx` -- Integração da nova aba/botão "Leitor / Visor" na navegação da revendedora.

## Tasks & Acceptance

**Execution:**
- [x] `packages/core/src/domain/scanner.ts` e testes -- Implementar `FiltroAntiDuplicacao` puro com debounce de 1,5s -- Garantir regra anti-duplicação (FR-009).
- [x] `packages/web/package.json` -- Instalar dependência `html5-qrcode` -- Habilitar leitor de câmera no frontend.
- [x] `packages/web/src/utils/audio.ts` -- Implementar emissor sonoro *bip* via Web Audio API -- Prover feedback sonoro suave (UX-DR2).
- [x] `packages/web/src/components/VisorLeituraHibrido.tsx` -- Implementar visor híbrido com auto-start, debounce de 1,5s e fallback manual -- Atender UX-DR2 e FR-007.
- [x] `packages/web/src/components/VisorView.tsx` -- Criar tela operacional do visor com diálogo para produto não cadastrado (FR-008) -- Experiência completa do visor.
- [x] `packages/web/src/App.tsx` -- Integrar tela do visor na barra de navegação móvel -- Navegação acessível com alvos de toque 48px.

**Acceptance Criteria:**
- Given que a revendedora acessa uma tela com visor de leitura (Conferência de Caixa S1, Venda ou Consulta), when a tela é montada com permissão de câmera concedida, then o visor de vídeo na metade superior inicia automaticamente sem exigência de clique em botão "abrir câmera" (UX-DR2, NFR-011).
- Given a câmera ativa em modo contínuo ("passar e bipar"), when a revendedora passa o mesmo código repetidamente ou mantém o produto sob o foco, then o sistema aciona um filtro anti-duplicação (debounce de 1,5 segundos) que ignora leituras repetidas do mesmo código na janela de tempo, emitindo feedback sonoro suave (bip) apenas na leitura válida (FR-009, UX-DR2).
- Given um ambiente com iluminação ruim ou falha na câmera, when a leitura ótica falha ou a permissão é negada, then o campo inferior de digitação manual permanece utilizável para busca por código numérico ou nome, exibindo mensagem acolhedora sem bloquear o fluxo (FR-007, NFR-004, UX State Pattern).
- Given a leitura de um código de barras que não consta no catálogo, when o código é capturado, then o sistema não trava e oferece diálogo/modal imediato para cadastrar o novo produto com o código já preenchido, permitindo continuar manualmente (FR-008).

## Implementation Notes

- Implementado `FiltroAntiDuplicacao` no pacote `@consultorasync/core` com janela de debounce de 1500ms (1,5s), função idempotente `podeProcessar` para verificação pura sem mutação do estado interno, e testes com 100% de cobertura.
- Adicionado endpoint `GET /api/produtos/codigo/:codigo` no pacote `@consultorasync/server` com enriquecimento dos dados de estoque (`presentes`, `reservados`, `pronta_entrega`) e resposta 404 RFC 7807 quando o código não existir.
- Enriquecido endpoint `GET /api/produtos` para incluir `itens_estoque` no `include` e mapear `estoque` na listagem, suportando busca simultânea por nome e código.
- Implementado utilitário de áudio em `packages/web/src/utils/audio.ts` com onda senoidal pura em 880Hz (Lá5) e desbloqueio automático no primeiro gesto global do usuário (`click`, `touchstart`, `keydown`).
- Desenvolvido componente `VisorLeituraHibrido.tsx` com `html5-qrcode`, auto-start contínuo (zero cliques), fallback para câmera frontal/webcam caso a câmera ambiente/traseira não esteja disponível, prop `pausado`, e preservação do contêiner no DOM sem `display: none` para evitar falha no cálculo de enquadramento.
- Desenvolvido `VisorView.tsx` com histórico de produtos bipados na sessão, exibição do estoque atualizado, busca híbrida por código ou nome textual, pausa automática do scanner durante exibição de modais e diálogo de cadastro imediato para novos códigos.

## Spec Change Log

- 2026-11-11: Adicionado suporte a busca por nome no campo de busca do visor com fallback acolhedor caso o termo digitado não seja numérico.
- 2026-11-11: Adicionado prop `pausado` no `VisorLeituraHibrido` para suspender o scanner durante o diálogo de produto não cadastrado e o formulário de cadastro.

## Review Triage Log

- Review Triage (Blind Hunter & Edge Case Hunter):
  - Corrigido: `podeProcessar` mutava o estado interno do debounce. Transformado em consulta pura idempotente.
  - Corrigido: teardown loop do `useEffect` no `VisorLeituraHibrido`. Estabilizadas referências com `useRef` e isolado disparo do ciclo de vida por `autoStart` e `pausado`.
  - Corrigido: contêiner do `html5-qrcode` com `hidden` (`display: none`) durante inicialização. Alterado para renderizado contínuo com opacidade zero durante carregamento.
  - Corrigido: busca manual tratava nomes como códigos de barra e disparava diálogo de produto não cadastrado com o nome. Corrigido com detecção de padrão numérico e consulta a `/api/produtos?busca=...`.
  - Corrigido: suspensão do `AudioContext` em navegadores móveis. Adicionado auto-unlock nos primeiros eventos de interação global.
  - Corrigido: diálogo de código não cadastrado e modal de cadastro exibiam backdrops duplicados empilhados. Condicionado render para evitar sobreposição.

## Design Notes

O feedback sonoro suave é gerado via `AudioContext` nativo (onda senoidal a 880Hz com decaimento exponencial de 80ms), garantindo latência zero e dispensando arquivos de áudio externos. O filtro anti-duplicação de 1,5s reside no domínio para que o mesmo controle governe tanto a leitura ótica pela câmera quanto futuros eventos de leitor USB ou pareado via WebSocket.
