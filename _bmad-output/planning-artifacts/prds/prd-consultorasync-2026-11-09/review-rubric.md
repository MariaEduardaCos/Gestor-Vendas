# PRD Quality Review — ConsultoraSync

## Overall verdict

O conjunto forma uma base consistente para detalhar UX, arquitetura e histórias do primeiro teste: há regras financeiras explícitas, 40 requisitos T1, critérios observáveis e separação honesta entre produto previsto e integrações não verificadas. Antes de liberar os comportamentos de recuperação e devolução/crédito, corrigir a ambiguidade sobre confirmação após queda de conexão e definir o rateio de excedente em pagamentos de origem mista. Não há achado crítico; os ajustes abaixo evitam decisões financeiras diferentes entre implementações.

## Decision-readiness — adequate

D-01 a D-03 incorporam as respostas diretas de Duda sem fingir custo real: o percentual incide sobre preço, custo desconhecido não vira zero e o ganho é reconhecido no pagamento mesmo antes da entrega. D-04 em diante são explicitamente propostas operacionais. Essa distinção permite revisar as regras sem atribuir aprovação inexistente à usuária.

### Findings

- **[high]** Partilha de excedente com origens mistas ainda não é determinística (decisoes.md, D-07, itens 4–6; prd.md, FR-039/FR-040) — “valor originado de crédito volta a crédito” é correto, mas não define quanto do excedente de uma conta paga com dinheiro e crédito corresponde a cada origem. Com 60 em Pix e 40 em crédito e cancelamento de 50, implementadores podem devolver 30/20 proporcionalmente ou devolver primeiro 40 ao crédito e 10 ao dinheiro. *Fix:* escolher e identificar como proposta um critério de atribuição — proporcional ou ordem explícita —, preservar o lastro por origem e acrescentar cenário de cancelamento parcial de pagamento misto, incluindo arredondamento.

## Substance over theater — strong

A visão usa problemas da rotina conhecida, sem alegar novidade de mercado ou validação ampla. NFRs contêm condições de teste específicas, dispositivos, massa de dados e limitações; o material não confunde metas com resultados já obtidos. A pesquisa externa fica restrita a fatos técnicos relevantes, sem justificar integrações imaginárias.

## Strategic coherence — strong

UJ-1 a UJ-3, requisitos T1 e CT-01 a CT-22 atendem ao mesmo fluxo de centralização, conferência e atendimento. O ganho completo foi mantido em P2, enquanto T1 já preserva sua base de custos e taxas. SM-C1 impede otimizar velocidade sacrificando saldo e reserva; SM-C2 monitora esforço e abandono.

## Done-ness clarity — adequate

Todos os FRs têm critério de aceitação; o recorte especifica dados e cenários numéricos. As fórmulas D-04/D-05 mantêm uma conta com duas visualizações, e CF-01 a CF-08 deixam claro que o relatório de ganho não é exigido em T1.

### Findings

- **[high]** Falha de rede é apresentada como prova de não confirmação (prd.md, NFR-008; decisoes.md, D-13; primeiro-teste.md, CT-21/CT-22) — “mostrar que confirmação não ocorreu” conflita com o caso em que o servidor confirmou e a resposta se perdeu. CT-21 já aponta consulta de resultado, mas a mensagem normativa pode induzir nova operação. *Fix:* distinguir não enviado de resultado desconhecido; após perda de resposta, informar que o resultado está sendo verificado, consultar a mesma operação e repetir com sua identidade original, sem afirmar não confirmação antes da verificação. Acrescentar esse resultado esperado no CT-21.
- **[medium]** Venda de item vencido é bloqueada em uma fonte e apenas sinalizada em outra (prd.md, FR-051; decisoes.md, D-14) — D-14 determina “Registrar vencido não deve efetivar venda”, enquanto o FR só requer sinalizar e baixar perda. *Fix:* alinhar FR-051 e sua aceitação ao bloqueio proposto, com teste de tentativa de venda de grupo com validade conhecida vencida, sem impor data aos grupos desconhecidos. Refere-se a P2, não bloqueia T1.

## Scope honesty — strong

T1/P2/INV aparecem de forma consistente; a conta do primeiro teste é explícita e as integrações têm condições de liberação. O documento não transforma a preferência por fotos e preços em promessa, nem sugere que notas confirmam chegada ou pagamento. Regras inferidas estão marcadas e têm responsável de revisão; não há pendência de integração silenciosamente absorvida pelo recorte.

## Downstream usability — adequate

IDs FR-001 a FR-056 e NFR-001 a NFR-012 são estáveis e referenciados pelo recorte, sem duplicar seu texto normativo. O glossário distingue produto/unidade, venda/entrega e crédito/dinheiro externo, sustentando o trabalho técnico posterior.

### Findings

- **[medium]** “Pagamentos líquidos” pode significar abatimento após taxa (prd.md, FR-032) — o requisito pede “pagamentos líquidos”, mas D-04 usa principal confirmado não estornado, enquanto FR-035 reserva “líquido” ao valor após taxa. Usar 97 em vez de 100 nesse campo quebraria a quitação correta. *Fix:* trocar por “pagamentos confirmados não estornados, antes das taxas” e manter líquido da taxa exclusivamente nos recebimentos financeiros.

## Shape fit — strong

A forma é adequada a um TCC que alimentará UX, arquitetura e histórias: requisitos agrupados, decisões normativas e recorte de teste separado. O detalhamento financeiro é necessário, pois cancelamentos e créditos fazem parte do fluxo autorizado; evitar colocá-los apenas em notas vagas foi uma escolha útil.

## Mechanical notes

- Contagem T1 conferida: FR-001 a FR-004 e FR-006 a FR-041 totalizam 40; FR-005 pertence a P2.
- O índice de hipóteses é resumido no PRD §9 e detalhado em decisoes.md. Para melhorar extração, listar explicitamente D-04 a D-11 e D-13 como hipóteses e D-12/D-14 como condicionada/proposta; o texto “D-04 em diante” generaliza um pouco a classificação.
- UJs usam papéis (“Revendedora”, “Filho”), em vez de protagonistas nomeados. Como refletem uma rotina real sem nomes fornecidos, isso é aceitável, mas deve permanecer explícito que não são entrevistas adicionais.
- A pesquisa técnica distingue fatos de inferências e declara que nenhum contrato das marcas ou cobertura de produtos foi validado.
- A execução dos testes continua declarada como não realizada, corretamente.

## Contagem de achados

- Critical: 0
- High: 2
- Medium: 2
- Low: 0

As duas correções high são locais e verificáveis; não exigem reabrir o briefing ou ampliar T1. Recomenda-se corrigi-las antes de marcar o conjunto como pronto para implementação dos comportamentos afetados.
