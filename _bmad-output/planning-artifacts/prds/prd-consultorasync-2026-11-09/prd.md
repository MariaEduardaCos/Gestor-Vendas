---
title: "PRD completo — ConsultoraSync"
status: final
created: 2026-11-09
updated: 2026-11-09
---

# PRD completo — ConsultoraSync

## 1. Finalidade e precedência

Especificação funcional e de qualidade para orientar desenho, arquitetura, histórias e testes do TCC. Este PRD consolida o [briefing](../../briefs/brief-consultorasync-2026-11-09/brief.md), seu complemento, a descoberta e as decisões posteriores de Duda. Não é implementação nem demonstração de integração existente.

Requisitos têm identificadores estáveis. **T1** integra o primeiro teste; **P2** descreve produto previsto com entrega posterior; **INV** é capacidade condicionada à investigação. A especificação completa cobre o produto conhecido, sem tornar integrações não verificadas compromissos de entrega. O [primeiro teste](primeiro-teste.md) usa os mesmos IDs. As [decisões](decisoes.md) têm precedência sobre hipóteses antigas; regras operacionais inferidas estão marcadas `[ASSUMPTION]` e não são atribuídas a Duda.

## 2. Escopo, limites e evolução

T1 inclui apenas requisitos marcados T1 e seus NFRs aplicáveis. P2 não é uma segunda entrega com data prometida; é o conjunto completo de necessidades conhecidas para planejar após avaliação. INV depende de formatos, amostras e acesso autorizado, sem substituição por coleta oculta ou credenciais compartilhadas.

Não são objetivos: comércio eletrônico público, contabilidade fiscal, integração bancária, armazenamento de dados de cartão, disparo automático de cobranças, mini-loja, coleta de revistas ou expansão imediata para outras categorias. O sistema registra confirmação de pagamentos feita por quem opera; não verifica bancos ou operadoras automaticamente.

## 3. Visão, público e jornadas

Centralizar encomendas, estoque de pronta-entrega e contas de clientes para reduzir procura de informações em mensagens, revistas e memória. Público inicial: revendedora de Natura, Eudora e O Boticário e familiares que ajudam na gestão; posteriormente, pessoa contratada com limites. Tupperware e DeMillus permanecem futuras. O atendimento completo deve poder ser realizado pelo celular e pelo computador.

Trabalhos principais: lembrar quem pediu o quê; informar preços e contas na ausência da revendedora; saber o que está disponível; registrar o que chegou e o que foi entregue; registrar pagamentos parciais sem perder o saldo de cada compra; conhecer compromissos com marcas e ganho identificado como informado ou estimado.

As jornadas abaixo estruturam o relato de Duda; não inventam participantes entrevistados nem resultados observados.

- **UJ-1 — Revendedora reúne encomendas.** Recebe escolhas por revista ou WhatsApp, registra cliente e itens, associa-os à compra feita no site e acrescenta pronta-entrega quando desejar. Termina com encomendas identificadas, sem estoque fictício.
- **UJ-2 — Revendedora recebe uma caixa.** Abre a conferência, identifica produtos por código ou nome, informa quantidades reais e escolhe clientes se faltarem unidades. Confirma a chegada; consulta reservado e disponível sem procurar mensagens.
- **UJ-3 — Filho atende na ausência dela.** Acessa com sua identificação, consulta cliente, conta e preço, registra retirada ou venda e informa pagamento, inclusive parcial. Produto reservado a outra pessoa permanece protegido.
- **UJ-4 — Revendedora acompanha o financeiro.** Consulta contas e pagamentos; na evolução P2, cadastra boleto, marca pagamento e consulta ganho e sua cobertura. Crédito e devolução preservam origem sem duplicar valores.

## 4. Vocabulário e estados

| Termo | Definição |
|---|---|
| Operação | Conjunto privado de dados de uma revendedora, compartilhado apenas com pessoas autorizadas. |
| Cliente | Pessoa compradora, identificada internamente sem depender de telefone único. |
| Produto | Identidade comercial e variante; código de barras identifica produto, não necessariamente unidade física. |
| Encomenda | Itens solicitados por um cliente antes da chegada; pode originar uma conta, não estoque físico. |
| Compra à marca | Pedido agregado da revendedora, com itens de encomendas e/ou pronta-entrega. Não confundir com conta do cliente. |
| Recebimento | Confirmação de unidades que chegaram da marca; pode ocorrer em várias conferências. |
| Presente / reservado / disponível | Quantidade física não entregue / parcela destinada a contas / diferença disponível para novas vendas. |
| Venda | Compromisso comercial confirmado, de pronta-entrega ou encomenda; reserva, entrega e pagamento são fatos separados. |
| Conta | Total devido por uma compra do cliente, com itens e pagamentos vinculados. |
| Pagamento | Valor confirmado por Pix, dinheiro ou cartão; aprovação do cartão é suficiente para a conta do cliente. |
| Crédito | Valor a favor do cliente derivado de excedente, mantido por escolha; não é novo dinheiro ao ser utilizado. |
| Custo informado / estimado / desconhecido | Valor declarado com fonte / derivado do preço e percentual / ausência de base de cálculo. |
| Ganho reconhecido | Parcela do ganho atribuída aos pagamentos; com custo estimado é ganho estimado, não lucro líquido comprovado. |
| Boleto | Obrigação da compra à marca, inicialmente única por compra; pagamento não é novo custo da venda. |

Estados financeiros da conta: aberta, parcialmente paga, quitada; excedente é posição separada a resolver. Atraso exige vencimento informado e saldo positivo. Estados de entrega: aguardando chegada, disponível para retirada, parcialmente entregue, entregue ou cancelado. Estados de compra à marca: rascunho, registrada, parcialmente recebida, recebida ou cancelada. Confirmação local não equivale a aceite da marca.

## 5. Requisitos funcionais

Cada consequência abaixo é critério de aceitação do requisito. T1 realiza UJ-1 a UJ-3; contas também sustentam UJ-4. P2 amplia UJ-4 e o histórico; INV só é liberado após sua condição de viabilidade.

### Acesso e clientes

#### FR-001 — Identificação de quem opera [T1]

O sistema deve: Permitir acesso individual da revendedora e de familiares autorizados à mesma operação, distinguindo-os de outras operações.

**Aceitação:** Cada venda, recebimento, entrega e pagamento identifica quem confirmou; sem sessão não se consultam contas.

#### FR-002 — Limites por operação [T1]

O sistema deve: Restringir consultas e alterações à operação autorizada, também em buscas por código e pareamento.

**Aceitação:** Uma sessão de outra operação não acessa clientes, estoque ou sessão do leitor alheios, mesmo conhecendo identificadores.

#### FR-003 — Cadastro de clientes [T1]

O sistema deve: Cadastrar e editar nome obrigatório, telefone e endereço opcionais; buscar por nome ou telefone sem exigir endereço.

**Aceitação:** Homônimos recebem identificadores distintos; telefone ausente não impede encomenda; registros ligados a vendas não são apagados com o histórico.

#### FR-004 — Perfil do cliente [T1]

O sistema deve: Mostrar encomendas, entregas, contas separadas, pagamentos e créditos do cliente.

**Aceitação:** Selecionar uma conta exibe seus itens e saldo; somatório das contas pode aparecer, mas não substitui a escolha da conta paga.

#### FR-005 — Pessoa contratada [P2]

O sistema deve: Permitir registrar encomendas dos clientes, vendas e pagamentos, impedindo criar, alterar ou confirmar compras às marcas e alterar permissões.

**Aceitação:** Tentativa de alterar compra à marca é recusada independentemente da tela; a restrição não impede lançar uma encomenda de cliente. Regra operacional proposta D-10.

### Catálogo e leitura

#### FR-006 — Produto e variante [T1]

O sistema deve: Cadastrar nome, marca, variante quando aplicável, código de barras opcional e preço de venda definido; manter identificador interno independente do código.

**Aceitação:** Produtos sem código são pesquisáveis; volume, cor ou fragrância distintos não são mesclados só por nome parecido.

#### FR-007 — Leitura de código [T1]

O sistema deve: Localizar produto cadastrado pelo código lido na chegada ou venda e permitir digitação ou busca por nome.

**Aceitação:** Câmera negada, sem foco ou indisponível não bloqueia cadastro manual; leitura isolada não confirma entrada, venda ou pagamento.

#### FR-008 — Código não cadastrado [T1]

O sistema deve: Oferecer cadastro manual e, quando houver integração habilitada, sugestões externas editáveis antes de salvar.

**Aceitação:** Produto não encontrado ou serviço fora do ar permite continuar manualmente; código lido pode ser associado após confirmação.

#### FR-009 — Evitar leituras duplicadas [T1]

O sistema deve: Exigir confirmação de quantidade; repetições da câmera sobre o mesmo código não somam unidades silenciosamente.

**Aceitação:** Manter um código no enquadramento não cria várias unidades; ler códigos diferentes seleciona produtos sem confirmar movimentação.

#### FR-010 — Preço de venda [T1]

O sistema deve: Permitir definir preço pela revista, referência externa conferida ou valor manual e preservar o preço até alteração explícita.

**Aceitação:** Mudança de revista ou consulta externa não muda preço salvo; preço e custo têm campos e rótulos distintos.

#### FR-011 — Percentual por marca [T1]

O sistema deve: Cadastrar percentual sobre o preço definido do produto e calcular custo estimado pela decisão D-01, sem percentual embutido ou presumido por marca.

**Aceitação:** Preço 100 e percentual 30 resultam em custo estimado 70; percentual ausente e nenhum custo informado mantêm custo desconhecido; mudança não altera vendas já confirmadas.

#### FR-012 — Proveniência de custo [T1]

O sistema deve: Permitir custo informado com fonte declarada ou estimativa por marca; manter desconhecido quando não houver dado nem configuração válida.

**Aceitação:** Referência externa de preço não é custo informado; custo estimado é identificado na revisão e no histórico; custo zero só existe se informado explicitamente.

#### FR-013 — Estoque inicial [T1]

O sistema deve: Permitir contagem inicial por produto, confirmar quantidade, preço e origem do custo sem criar compra fictícia à marca.

**Aceitação:** Confirmar 5 unidades adiciona 5 uma única vez e registra operação de estoque inicial; abandono antes de confirmar não movimenta estoque.

#### FR-014 — Leitor pareado [T1]

O sistema deve: Permitir parear celular a uma sessão autorizada no computador para enviar códigos, sem expor dados no endereço de pareamento.

**Aceitação:** Pareamento expira ou pode ser encerrado; sessão de outra operação não recebe eventos; desconexão visível permite reconectar sem confirmar movimentos em duplicidade.

### Encomendas e compras

#### FR-015 — Encomenda por cliente [T1]

O sistema deve: Registrar cliente, produtos, quantidades positivas, preço unitário e data; vincular itens à futura compra à marca.

**Aceitação:** Duas encomendas de clientes diferentes permanecem separadas mesmo em uma compra conjunta à marca; quantidade esperada não aumenta estoque físico.

#### FR-016 — Confirmação da conta [T1]

O sistema deve: Criar conta ao confirmar encomenda ou venda, preservando valores da transação e permitindo cancelamento controlado.

**Aceitação:** Rascunho não entra no valor a receber; confirmar uma encomenda inclui os itens ainda aguardados no total da conta, sem gerar entrada no estoque físico.

#### FR-017 — Compra à marca [T1]

O sistema deve: Registrar manualmente marca, referência opcional, data, itens para clientes e itens de pronta-entrega; marcar rascunho ou pedido registrado.

**Aceitação:** O registro local não afirma que compra foi enviada à marca; cópia manual de pedido do site preserva vínculo a cada cliente.

#### FR-018 — Vínculos e recebimentos [T1]

O sistema deve: Acompanhar quantidades pedidas, recebidas, destinadas, entregues e canceladas sem misturar estados financeiros.

**Aceitação:** Somar quantidades recebidas de várias conferências respeita o total do pedido salvo ajuste explícito; não marcar como entregue um item ainda não recebido.

#### FR-019 — Preço histórico [T1]

O sistema deve: Fixar na confirmação os valores e parâmetros de custo da transação; alteração posterior de produto ou percentual só afeta novas transações.

**Aceitação:** Abrir conta antiga após mudar preço ou percentual mostra valores originais; mudança acordada de conta exige revisão explícita e histórico.

### Recebimento e reserva

#### FR-020 — Conferência de chegada [T1]

O sistema deve: Abrir conferência por ação própria e apresentar itens pedidos, quantidades esperadas e quantidade desta chegada editável.

**Aceitação:** Só a confirmação entra no estoque; quantidade negativa ou excedente sem ajuste prévio é recusada; confirmar novamente a mesma conferência não repete entrada.

#### FR-021 — Recebimento parcial [T1]

O sistema deve: Permitir várias chegadas para uma compra e manter pendente o que ainda falta.

**Aceitação:** Pedido de 3 com chegada de 2 registra 2 recebidos e 1 aguardado; segunda chegada de 1 encerra a pendência sem duplicar as 2 anteriores.

#### FR-022 — Destinação quando falta [T1]

O sistema deve: Exigir escolha da revendedora entre clientes quando unidades recebidas não atendem todos.

**Aceitação:** Dois clientes aguardando e uma unidade recebida exigem destinação explícita; a outra encomenda continua aguardando, sem reserva física fictícia.

#### FR-023 — Reserva física [T1]

O sistema deve: Reservar unidades recebidas para encomendas escolhidas, impedindo consumo em outra conta.

**Aceitação:** Presentes 5 e reservadas 3 mostram disponíveis 2; venda de 3 unidades a terceiro é recusada; esperado e reservado são quantidades distintas.

#### FR-024 — Item não entregável [T1]

O sistema deve: Cancelar quantidade pendente quando a marca confirmar que não entregará e reduzir a conta, preservando motivo e histórico.

**Aceitação:** Não retirar estoque de item que nunca chegou; se a conta já foi paga, gerar valor a devolver ou creditar sem apagar pagamento.

### Estoque e atendimento

#### FR-025 — Consulta do estoque [T1]

O sistema deve: Buscar produto por código, nome ou marca e mostrar preço e quantidades presentes, reservadas e disponíveis.

**Aceitação:** Produtos reservados continuam presentes até entrega, mas indisponíveis; consulta em celular e computador usa mesma situação confirmada.

#### FR-026 — Reserva na venda [T1]

O sistema deve: Ao confirmar venda de pronta-entrega ainda não retirada, reservar unidades para essa venda.

**Aceitação:** Duas pessoas tentando vender a última unidade não confirmam ambas; tentativa recusada não gera conta ou pagamento parcial isolado.

#### FR-027 — Saída na entrega [T1]

O sistema deve: Dar saída física apenas na confirmação da entrega, consumindo a reserva correspondente.

**Aceitação:** Vender e entregar a mesma unidade não gera duas saídas; venda com retirada imediata confirma reserva e entrega em uma operação coerente.

#### FR-028 — Entrega parcial [T1]

O sistema deve: Permitir retirada parcial de encomenda somente quando a chegada estiver incompleta, registrando os itens retirados.

**Aceitação:** Não entregar mais que recebido e reservado; encomenda inteiramente recebida deve ser entregue integralmente no fluxo inicial.

#### FR-029 — Cancelamento e reserva [T1]

O sistema deve: Cancelar quantidades não entregues com motivo; proposta D-09 libera reserva física para pronta-entrega após confirmação.

**Aceitação:** Cancelamento de item já entregue não repõe estoque automaticamente; cancelar pendência sem produto recebido não aumenta disponibilidade.

#### FR-030 — Ajuste e correção [T1]

O sistema deve: Permitir ajuste justificado de contagem, preservando movimento anterior e impedindo reduzir estoque abaixo de reservas válidas.

**Aceitação:** Diferença física não apaga vendas; para ajustar presentes abaixo dos reservados é necessário resolver explicitamente reservas afetadas.

#### FR-031 — Estado de entrega [T1]

O sistema deve: Mostrar aguardando chegada, disponível para retirada, parcialmente entregue, entregue ou cancelado, independentemente da situação financeira.

**Aceitação:** Conta pode estar entregue e parcialmente paga ou paga e aguardando chegada; situação financeira não muda estoque.

### Contas e pagamentos

#### FR-032 — Saldo por compra [T1]

O sistema deve: Mostrar total válido da compra, valor bruto dos pagamentos confirmados, descontados os estornos e as devoluções, sem deduzir taxas do saldo quitado pelo cliente, créditos aplicados e saldo conforme D-04.

**Aceitação:** Duas contas de 100 e 80 com pagamento de 40 na segunda exibem saldos 100 e 40; não redistribuir pagamento sem ação explícita.

#### FR-033 — Visão sem pendentes [T1]

O sistema deve: Exibir cálculo alternativo para itens já recebidos e o saldo projetado segundo D-05, sem criar segunda conta.

**Aceitação:** Total 150, itens recebidos 100 e pagamento 40 mostram saldos 110 completo e 60 sem aguardados; confirmar pagamento em uma visão atualiza a mesma conta.

#### FR-034 — Registrar pagamento [T1]

O sistema deve: Selecionar conta, valor positivo, data, meio Pix/dinheiro/cartão e operador; confirmar pagamento parcial ou total.

**Aceitação:** Não aceitar valor superior ao saldo por engano no primeiro teste; valor pago não pode ser lançado em duas contas por repetição da confirmação.

#### FR-035 — Cartão e taxa [T1]

O sistema deve: Registrar valor bruto confirmado, taxa absorvida e valor líquido; aprovação manual informada conta como pagamento do cliente.

**Aceitação:** Pagamento de 100 com taxa 3 quita 100, não 97; taxa maior que pagamento ou negativa é recusada; depósito da operadora não é exigido.

#### FR-036 — Datas e situação [T1]

O sistema deve: Permitir conta sem vencimento e registrar pagamentos na data efetiva, mostrando aberta, parcialmente paga ou quitada.

**Aceitação:** Sem vencimento não mostrar atrasada; atraso só quando há data vencida e saldo positivo; entrega não muda situação de pagamento.

#### FR-037 — Correção de pagamento [T1]

O sistema deve: Corrigir por estorno identificado e novo lançamento, recalculando saldo e respeitando créditos/devoluções já dependentes.

**Aceitação:** Estornar pagamento de 40 reabre o saldo em 40 sem apagar histórico; impedir correção isolada que deixe crédito utilizado sem lastro até desfazer dependências.

#### FR-038 — Excedente por cancelamento [T1]

O sistema deve: Manter valor pago excedente identificado e pendente de escolha entre devolução e crédito.

**Aceitação:** Conta 100 paga em 100 e cancelada em 30 gera excedente 30, não saldo negativo chamado dívida; escolha não acontece automaticamente.

#### FR-039 — Devolução financeira [T1]

O sistema deve: Registrar valor, data, motivo e responsável por devolver o excedente, sem alegar transferência bancária automática.

**Aceitação:** Devolver 30 consome excedente 30 uma única vez; não disponibiliza simultaneamente crédito de 30.

#### FR-040 — Crédito de cliente [T1]

O sistema deve: Converter excedente por escolha do cliente e aplicar crédito em outra conta do mesmo cliente com histórico de origem.

**Aceitação:** Crédito 30 aplicado 20 deixa 10; aplicar crédito reduz saldo da conta de destino sem registrar entrada nova de dinheiro; não usar em outro cliente.

#### FR-041 — Separar venda e recebimento [T1]

O sistema deve: Consultar valor vendido, recebido, devolvido, a receber e crédito sem apresentá-los como ganho.

**Aceitação:** Venda fiada de 100 sem pagamento mostra recebido 0 e saldo 100; aplicar crédito não aumenta recebido externo do período.

### Boletos e visão financeira

#### FR-042 — Boleto por compra [P2]

O sistema deve: Cadastrar manualmente um boleto por compra à marca, com valor e vencimento, editável com histórico.

**Aceitação:** Boleto sem valor ou vencimento não é confirmado; vinculação a compra não lança custo duas vezes nem cria pagamento de cliente.

#### FR-043 — Pagamento de boleto [P2]

O sistema deve: Permitir marcar pago com data e reverter erro com justificativa e histórico.

**Aceitação:** Marcar duas vezes não duplica saída registrada; reverter devolve obrigação ao estado aberto sem mexer em ganho da venda.

#### FR-044 — Resumo financeiro [P2]

O sistema deve: Mostrar a receber dos clientes, a pagar por vencimento e boletos pagos; distinguir crédito de cliente e saldo bancário não controlado.

**Aceitação:** Somatórios correspondem a contas válidas e boletos não pagos; total a receber menos boletos não é rotulado lucro nem saldo bancário.

### Ganho por pagamentos

#### FR-045 — Ganho calculável [P2]

O sistema deve: Usar custo informado ou estimado congelado por item e reconhecer ganho proporcional ao pagamento, inclusive antes da entrega e cartão aprovado.

**Aceitação:** Base 100, percentual 30, pagamento 50 gera ganho estimado 15 sem taxas; entrega posterior não gera ganho adicional.

#### FR-046 — Custo desconhecido [P2]

O sistema deve: Não calcular ganho de itens sem custo informado ou estimativa configurada; mostrar cobertura e valor não calculado.

**Aceitação:** Venda e recebimento continuam visíveis; custo ausente não vira zero e item desconhecido não desaparece do total vendido.

#### FR-047 — Taxas no ganho [P2]

O sistema deve: Subtrair taxa absorvida do pagamento que a gerou; não reduzir o valor quitado pelo cliente.

**Aceitação:** Venda 100 com custo estimado 70 paga 50 no cartão com taxa 2 gera ganho estimado 13 nesse pagamento; boleto pago não reduz novamente esse ganho.

#### FR-048 — Ajustes no ganho [P2]

O sistema deve: Reverter efeitos de cancelamentos, estornos e devoluções e manter crédito não aplicado fora do ganho, conforme D-06.

**Aceitação:** Venda 100 paga, custo estimado 70 e cancelamento total revertem ganho de 30; crédito aplicado a nova compra calcula ganho só segundo os itens de destino, sem somar recebimento externo.

### Histórico e validade

#### FR-049 — Recorrência no perfil [P2]

O sistema deve: Exibir produto e último pedido quando houver ao menos duas compras confirmadas distintas com esse produto e quantidade não integralmente cancelada.

**Aceitação:** Duas unidades na mesma compra não contam como recorrência; cancelamento integral retira ocorrência; histórico não dispara pedido automático.

#### FR-050 — Validade opcional [P2]

O sistema deve: Registrar validade por grupo de entrada quando disponível, permitir datas diferentes do mesmo produto e filtro de vencidos/próximos.

**Aceitação:** Ausência de validade não é tratada como produto sem risco; registro não bloqueia conferência por falta de data; antecedência do alerta será configurável.

#### FR-051 — Produto vencido [P2]

O sistema deve: Sinalizar validade conhecida vencida, impedir venda e entrega de unidades do grupo identificado como vencido e permitir baixa de perda justificada, sem transformar perda em venda.

**Aceitação:** Baixa não gera conta de cliente; grupo vencido não pode ser vendido ou entregue; reserva afetada exige resolução antes da baixa. Política operacional proposta D-14.

### Integrações condicionadas

#### FR-052 — Dados externos [INV]

O sistema deve: Habilitar consulta complementar só após validar fonte, cobertura e condições; guardar fonte e momento da consulta e confirmar correspondência de variante.

**Aceitação:** Ausência de nome/foto não impede operação manual; consulta não entrega automaticamente custo, lote ou validade da unidade.

#### FR-053 — Referências de preço [INV]

O sistema deve: Apresentar referências com fonte, data e critério de comparação; chamar de média apenas quando cálculo e amostra forem verificáveis.

**Aceitação:** Uma única oferta é referência, não média; valores de variantes distintas não se combinam; confirmação não modifica vendas anteriores.

#### FR-054 — Importar documentos [INV]

O sistema deve: Pré-visualizar itens e valores extraídos de formato validado antes de confirmar, mantendo associação de clientes e prevenção de importação repetida.

**Aceitação:** Arquivo malformado ou dados incompletos não movimentam estoque; documento não cria recebimento físico nem pagamento automático.

#### FR-055 — Enviar pedido à marca [INV]

O sistema deve: Permitir envio somente com integração autorizada e validada e confirmação da revendedora, distinguindo enviado, confirmado e falha.

**Aceitação:** Repetir tentativa após falha não pode criar duas compras; ausência de integração mantém registro manual; contratado não efetiva envio.

#### FR-056 — Percentual padrão de taxa [P2]

O sistema deve: Permitir padrão de taxa por modalidade de pagamento com conferência e substituição em cada pagamento.

**Aceitação:** Alterar padrão afeta apenas novos registros; percentual padrão de cartão não altera percentual de ganho da marca.

## 6. Regras de cálculo e integridade

As fórmulas e exemplos normativos estão em [decisoes.md](decisoes.md). Quantidades inteiras não negativas; operações confirmadas não criam estoque abaixo de zero nem reserva superior ao presente. Valor monetário em reais com centavos; cálculo intermediário preserva precisão e distribui diferenças de arredondamento de modo determinístico. A última parcela absorve resíduo para totalizar exatamente o ganho da conta.

T1 registra custos/percentuais históricos e taxas, mas não exige o relatório de ganho P2. Custo desconhecido não impede vender ou receber. Integração indisponível não impede cadastro manual. Correções são eventos rastreáveis, não exclusões silenciosas.

## 7. Requisitos não funcionais

São critérios propostos para o teste, não resultados medidos. `[ASSUMPTION N-01]` números e ambiente serão confirmados ao preparar a execução.

- **NFR-001 — Consistência:** confirmar venda, reserva, entrega e pagamento com todos os seus efeitos ou nenhum; repetição da mesma confirmação não duplica fatos. Testar duas sessões disputando última unidade e repetição após queda de conexão.
- **NFR-002 — Privacidade:** sessão de uma operação não consulta nem altera dados de outra; não expor contatos, contas ou credenciais na consulta de código a serviço externo. Verificação negativa também por identificador conhecido.
- **NFR-003 — Rastreabilidade:** cada alteração confirmada guarda responsável, data/hora, motivo quando correção, valores anteriores e vínculo ao fato original. Rascunho descartado não deve parecer fato financeiro.
- **NFR-004 — Uso em telas diferentes:** tarefas T1 concluíveis em celular a partir de 360 px de largura e computador a partir de 1280 px, sem corte dos botões principais; câmera e leitor pareado têm alternativas manuais.
- **NFR-005 — Acessibilidade:** campos com rótulos, erros associados, navegação por teclado no computador e estados identificados por texto, sem depender apenas de cor, som ou vibração.
- **NFR-006 — Resposta local:** em massa de teste de 1.000 produtos e 500 clientes, busca interna e confirmação simples em até 2 s no percentil 95 das 30 repetições registradas, em ambiente e conexão descritos. Tempo externo medido separadamente.
- **NFR-007 — Falhas externas:** consulta externa com espera limitada e opção manual imediata; erro nunca confirma movimento parcial. Prazo proposto de espera: até 8 s, ajustável após teste.
- **NFR-008 — Conectividade:** primeiro teste exige internet; quando uma ação ainda não tiver sido enviada, informar que não foi confirmada. Se a conexão cair após o envio, mostrar resultado desconhecido e consultar a confirmação anterior antes de permitir repetição segura. Não anunciar funcionamento offline ou sincronização pendente sem implementá-los.
- **NFR-009 — Preservação:** manter dados após recarga e reinício de sessão; demonstrar exportação e recuperação de cópia de teste antes de usar dados reais. Objetivo inicial: cópia diária e recuperação em até um dia de trabalho, a validar no desenho técnico.
- **NFR-010 — Valores:** valores financeiros têm duas casas na apresentação, moeda explícita e estado desconhecido distinto de zero; estimativas nunca são apresentadas como valores reais comprovados.
- **NFR-011 — Câmera e pareamento:** contexto seguro aceito no dispositivo, permissão explícita, opção de encerrar câmera e sessão pareada, sem leitura para outra operação. Não depender de exceção de segurança do navegador.
- **NFR-012 — Custo e operação:** manter inventário de serviços e limites de uso, sem anunciar custo zero não verificado. Documentar dependências e como o fluxo manual continua quando consulta externa falha.

## 8. Indicadores de sucesso

Metas abaixo são propostas de aceitação do protótipo, não evidências sobre revendedoras em geral.

- **SM-1:** concluir todos os cenários críticos do [primeiro teste](primeiro-teste.md) sem erro de saldo, estoque ou reserva; valida FRs T1 de confirmação e movimentação.
- **SM-2:** nas tarefas de consulta de preço, conta e encomenda, conseguir resposta sem procurar novamente mensagens/revistas após dados cadastrados; registrar tempo e ajuda necessária. Valida perfil, consulta e vínculos.
- **SM-3:** comparar cadastro por código e manual com mesma amostra real, ordem alternada; medir cobertura encontrada, tempo e correções. Não definir vantagem automática como critério de aprovação se cobertura externa for insuficiente.
- **SM-C1:** não otimizar velocidade omitindo conferência ou gerando quantidade duplicada; qualquer erro monetário ou reserva indevida reprova o cenário, mesmo que rápido.
- **SM-C2:** acompanhar abandono, correções e esforço percebido de cadastro. Não exigir validade para melhorar artificialmente cobertura do estoque.

Teste exploratório inicial com revendedora e familiar disponíveis, quantidade e condições registradas. Isso não sustenta generalização estatística. A avaliação acadêmica será alinhada com orientador; testes de tarefas e avaliação heurística são atividades distintas.

## 9. Decisões, hipóteses e liberação

D-01 a D-03 refletem respostas diretas de Duda nesta rodada. D-04 em diante especificam soluções operacionais propostas pelo PRD para resolver ambiguidades, marcadas `[ASSUMPTION]` no registro de decisões. As histórias de implementação devem incorporar essas regras e seus exemplos antes de codificar o comportamento afetado; a validação de uso poderá ajustá-las, preservando versões anteriores. Integrações e ganho P2 têm condições explícitas; ausência de pesquisa ou de regra não autoriza assumir resultado.

Responsáveis: Duda valida política de negócio; responsável técnico verifica dependências; orientador valida método acadêmico. Quando a condição de uma capacidade INV não for satisfeita, ela permanece fora da implementação e o fluxo manual é usado.

### Índice de hipóteses operacionais

- D-04: conservação de saldo e excedente.
- D-05: visão sem itens aguardados.
- D-06: distribuição, precisão e ajustes de ganho.
- D-07: origem do crédito e escolha de devolução.
- D-08: entrada, reserva e saída física únicas.
- D-09: desistência de item não entregue.
- D-10: contato opcional, identificação de operador e alcance do perfil contratado.
- D-11: duas compras válidas distintas para recorrência.
- D-13 e N-01: conectividade, metas de desempenho e recuperação.
- D-14: política proposta para validade conhecida e baixa por perda.
- D-01: custo informado complementar e tratamento de preço efetivo distinto da base são propostas; a fórmula percentual foi confirmada.

Cada item é definido em [decisoes.md](decisoes.md), com condição de aplicação e responsável pela revisão. Não representam novos resultados de entrevista.

## 10. Fontes e próximos documentos

- [Briefing](../../briefs/brief-consultorasync-2026-11-09/brief.md) e [complemento](../../briefs/brief-consultorasync-2026-11-09/addendum.md).
- [Descoberta](../../../brainstorming/brainstorm-rotina-revendedoras-2026-11-09/.memlog.md) e [análise](../../../../docs/ANALISE_DESCOBERTA_PARA_BRIEFING.md).
- [Decisões e fórmulas](decisoes.md), [especificação do primeiro teste](primeiro-teste.md), [complemento técnico](addendum.md), [fontes técnicas verificadas](pesquisa-integracoes.md) e [memória desta elaboração](.memlog.md).

Ainda não foram executados cenários de software, testes com produtos nem validação de integrações. O passo seguinte é desenho de experiência e arquitetura com essas regras, seguido de histórias de implementação.
