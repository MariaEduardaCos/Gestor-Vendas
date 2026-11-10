# Decisões e fórmulas — ConsultoraSync

Data: 09/11/2026. Documento normativo associado ao [PRD](prd.md). Não relata testes já executados.

**Confirmada:** resposta direta de Duda. **Regra operacional `[ASSUMPTION]`:** solução adotada nesta especificação para tornar o teste determinístico, sem atribuí-la à usuária; pode ser revista após demonstração dos exemplos. **Condicionada:** capacidade não deve ser implementada antes de satisfazer sua condição externa. Questões da descoberta são encerradas aqui por regra explícita ou por limite de implementação, não por alegação de integração existente.

## D-01 — Percentual sobre preço, por marca — confirmada

Duda substituiu a preferência provisória por identificação individual de custo pela proposta de usar o preço definido do produto e um percentual normalmente fixo por marca. Esclareceu o exemplo: **preço R$ 100 e percentual 30% resultam em ganho de referência R$ 30 e custo estimado R$ 70**.

- `B` = preço definido no produto no momento da confirmação da transação; `m` = percentual cadastrado para a marca dividido por 100.
- Custo estimado unitário `C = B × (1 − m)`; ganho de referência unitário `B × m`.
- Não usar `B / (1 + m)`: essa seria outra fórmula, não a escolhida.
- Registrar percentual por marca manualmente; não presumir percentuais reais de Natura, Eudora ou O Boticário. Validar `0 ≤ m ≤ 1`, preço base positivo e valores numéricos válidos. Custo informado deve ser não negativo; custo maior que o preço pode gerar perda e não deve ser truncado para zero.
- Congelar B, m, C e origem na transação, não nos preços futuros do catálogo. Alterar padrão não recalcula contas confirmadas.
- Se o preço efetivo de venda for `S` diferente de B, o ganho potencial do item é `S − C`, não necessariamente `S × m`. Exemplo: B=100, m=30%, C=70, S=90 → ganho 20 antes de taxas. Regra operacional `[ASSUMPTION]` para alterações explícitas do preço da transação.
- Se houver custo efetivamente informado, com fonte declarada na transação, permitir usar esse valor em vez da estimativa. A origem deve ficar visível; não deduzir custo real a partir da internet. Esse modo complementar é regra operacional `[ASSUMPTION]`, não alteração da fórmula confirmada.

**Efeito na pendência anterior:** não é necessário identificar a compra física de cada unidade para o modo estimado. Isso resolve o primeiro teste com produtos misturados sem apresentar estimativa como custo real. O ganho deve chamar-se estimado quando usar C derivado de percentual.

## D-02 — Custo desconhecido — confirmada

Sem custo informado e sem percentual válido configurado no momento da transação, a venda e o recebimento são registrados, mas o ganho aparece como **não calculado**. Mostrar valores e quantidade de itens sem base, sem convertê-los em custo zero. Se apenas parte da conta for calculável, exibir o ganho calculável e sua cobertura, não um total aparentemente completo.

Referência de preço encontrada na internet pode orientar preço de venda, após conferência. Não é custo de compra. Correção posterior de custo exige evento explícito com origem e motivo, sem modificar relatórios históricos silenciosamente.

## D-03 — Momento do ganho — confirmada

Reconhecer proporcionalmente ao confirmar pagamento, mesmo antes da chegada ou entrega. Para cartão, a aprovação informada conta como pagamento, sem esperar depósito da operadora. Entrega posterior não reconhece o mesmo ganho novamente. Esse indicador não é saldo bancário, ganho final garantido ou apuração fiscal; cancelamentos podem exigir ajustes posteriores.

Para conta válida sem ajustes, com itens de custo conhecido/estimado:

- Total de venda válido `T = soma dos valores de venda dos itens não cancelados`.
- Ganho potencial `G = soma(valor de venda do item − custo atribuído à quantidade válida)`.
- Para recebimento parcial `p`, reconhecer `p / T × G`, descontando a taxa absorvida desse pagamento.
- Exemplo: T=100, C=70, p=50 → ganho estimado 15. Se a taxa de cartão desse pagamento é 2, ganho estimado líquido das taxas registradas = 13. Recebimento bruto é 50 e líquido da taxa 48; conta do cliente é abatida em 50.
- Não aplicar a taxa duas vezes nem deduzir novamente custo da mercadoria quando o boleto à marca for pago.

## D-04 — Conta, saldo e conservação de valores `[ASSUMPTION]`

Para cada conta, manter entradas e saídas identificadas, sem editar ou apagar pagamentos confirmados:

- `E = pagamentos confirmados não estornados + créditos aplicados nesta conta − devoluções efetuadas − créditos emitidos a partir desta conta`.
- `saldo a pagar = máximo(T − E, 0)`; `excedente pendente = máximo(E − T, 0)`.
- Confirmar conta exige total positivo. Após cancelamento integral T pode ser zero: não dividir por zero, ganho válido passa a zero e o valor pago é tratado como excedente.
- Ganho só considera montante aplicado à compra válida, limitado a T. Excedente não é receita adicional nem ganho. Ganho negativo representa perda e não deve ser escondido como zero.
- A conta não aceita pagamento acima do saldo no fluxo inicial; excedente pode surgir depois, por redução de T. Não inventar troco ou crédito automático.
- Sem vencimento, saldo aberto não equivale a atraso.

Pagamentos e créditos podem se relacionar a várias contas apenas por lançamentos explícitos; um pagamento da interface T1 refere-se a uma conta escolhida. Não redistribuir para outras contas automaticamente.

## D-05 — Cálculo sem itens que não chegaram `[ASSUMPTION]`

Manter uma conta e dois modos de consulta. `R` é o valor dos itens recebidos válidos da encomenda. Na visão alternativa, `saldo sem itens aguardados = máximo(R − E, 0)`. Se E exceder R, mostrar valor já pago que cobre itens ainda aguardados; não criar crédito por isso, pois T continua válido.

Exemplo: T=150, R=100, E=40 → saldo completo 110 e saldo sem aguardados 60. Se E=120 → saldo completo 30, saldo sem aguardados 0 e 20 já pagos em relação a itens aguardados. A visão não cria pagamento, exclui item ou decide qual cliente receberá uma chegada insuficiente.

## D-06 — Distribuição e arredondamento do ganho `[ASSUMPTION]`

- Distribuir cumulativamente o valor aplicado à conta entre seus itens válidos proporcionalmente ao valor de venda de cada item. Não presumir que o cliente escolheu pagar um item: a escolha confirmada foi de uma conta específica.
- Usar centavos e distribuição pelo maior resto, desempate pelo identificador estável do item. Pagamentos posteriores registram a diferença entre o acumulado anterior e novo; a quitação absorve resíduos de centavos.
- Ganho do item = parcela de venda aplicada − parcela proporcional do custo; custo desconhecido deixa essa parte não calculada. Taxas reais do pagamento permanecem despesas conhecidas separadas. Um resumo parcial deve mostrar ganho calculável antes de taxas, taxas registradas e ausência de cálculo completo, em vez de atribuir precisão ao desconhecido.
- Estorno de pagamento reverte sua taxa somente se a pessoa confirmar que a taxa foi devolvida. Cancelar venda não pressupõe estorno da taxa da operadora.
- Cancelar ou corrigir item recalcula os valores cumulativos válidos, mas registra diferença como ajuste datado no momento da correção. Não reescrever silenciosamente ganho de períodos encerrados.
- Transação confirmada com custo estimado permanece estimada no histórico, salvo correção explícita.

## D-07 — Cancelamento, devolução e crédito `[ASSUMPTION]`

Duda confirmou retirada do valor de item que a marca não entregará e escolha entre devolução e crédito quando houver pagamento excedente. Operacionalização:

1. Cancelar a quantidade não entregue, ajustar T e ganho correspondente, mantendo histórico.
2. Se houver excedente, deixá-lo pendente de escolha. Não devolver dinheiro nem criar crédito sem confirmação.
3. Ao devolver, registrar saída e reduzir excedente; a confirmação é manual, não transferência bancária.
4. Ao converter em crédito, registrar saída da conta de origem e entrada na carteira de crédito do cliente. A conversão não mantém simultaneamente excedente utilizável na conta.
5. Ao aplicar crédito em conta de destino, reduzir carteira e aumentar E no destino. Não registrar novo dinheiro externo. O ganho agora vinculado aos itens de destino substitui o ganho revertido na origem, sem reconhecimento duplicado.
6. Se uma conta paga com crédito gerar novo excedente, preservar origem do meio de pagamento: valor originado de crédito volta a crédito; não afirmar devolução de dinheiro nunca recebido nessa conta. Quando os meios forem mistos, distribuir o excedente proporcionalmente ao valor de cada origem ainda aplicado, em centavos pelo maior resto e desempate por identificador. Exemplo: conta paga com 60 em dinheiro e 40 em crédito, reduzida de 100 para 50, gera excedente 50: 30 de origem dinheiro podem ser devolvidos ou convertidos em crédito por escolha; 20 de origem crédito voltam à carteira. Se o cliente escolher todo o excedente como crédito, carteira recebe 50; nunca devolver 50 em dinheiro. Registrar cada movimento uma única vez e conservar saldo da conta. Histórico permite verificar as origens e seus limites.

Exemplo completo, sem taxas: conta A=100, custo estimado 70, paga 100 → ganho estimado 30. Cancelamento integral → ganho 0 e excedente 100. Converter em crédito → carteira 100, excedente 0. Aplicar 60 em conta B=100, custo estimado 80 → carteira 40, saldo B=40, ganho estimado B=12; novo recebimento externo=0.

## D-08 — Estoque, reserva e momento único de saída `[ASSUMPTION]`

- Quantidade esperada não é presente nem reserva física. Vínculo de encomenda antes da chegada é uma intenção de destinação.
- Confirmar chegada gera presente. Destinação confirmada para cliente gera reserva física. `disponível = presente − reservado`.
- Venda confirmada ainda não retirada reserva unidades. Entrega confirmada diminui presente e reservado uma única vez.
- Venda com retirada imediata realiza ambos os passos coerentemente. Se qualquer verificação falhar, não confirmar parte da operação.
- Estoque inicial tem operação própria de contagem; não requer nota ou compra fictícia. Depois, correções por movimento justificado, sem repetir estoque inicial sobre produtos já contados.
- Ajustes não podem invalidar reserva existente sem resolução explícita. Repetir a mesma confirmação não repete entrada, reserva, saída ou pagamento.

## D-09 — Desistência e recebimento incompleto `[ASSUMPTION]`

Para desistência de quantidade ainda não entregue, permitir cancelar e liberar unidades presentes reservadas para pronta-entrega após confirmação. A proposta foi levantada com incerteza na descoberta, portanto precisa de avaliação durante teste.

Se a marca não entregará, cancelar somente quantidade pendente; não repor estoque que nunca existiu. Não autorizar devolução física de produto já entregue pelo mesmo comando: isso exige conferência de retorno e tratamento próprio antes de implementação. O primeiro teste cobre cancelamento de itens não entregues, não troca/devolução física após uso.

Retirada parcial de encomenda ocorre apenas se a chegada estiver incompleta. A revendedora escolhe destinação em falta de unidades; sistema não estabelece prioridade por data ou valor da conta.

## D-10 — Acessos e contato `[ASSUMPTION]`

- Nome obrigatório, telefone e endereço opcionais para não bloquear cadastro sem informação; cliente identificado internamente, homônimos e telefone compartilhado não devem ser fundidos automaticamente.
- Cada pessoa autorizada tem identificação própria. Primeiro teste usa revendedora e familiar gestor com acesso completo.
- Perfil contratado P2 pode criar encomenda de cliente, vender e receber. Não pode criar, editar, confirmar ou enviar compra à marca, nem administrar permissões. A restrição de compra foi confirmada; seu alcance incluindo rascunhos é solução operacional proposta.
- Registrar correções com pessoa e motivo; não apagar o fato original. Impedir desfazer um pagamento de origem enquanto crédito dependente continuar utilizado, indicando como desfazer a cadeia.

## D-11 — Recorrência `[ASSUMPTION]`

Duda definiu duas ocorrências do mesmo produto. Adotar duas compras confirmadas distintas do mesmo cliente com quantidade válida do produto, sem exigir quitação, em todo histórico disponível. Duas unidades na mesma compra contam uma vez. Cancelamento integral retira ocorrência. A data exibida é da compra confirmada mais recente válida; não inventar previsão de reposição nem pedido automático.

## D-12 — Dependências externas — condicionada

Manter cadastro, compras, estoque e pagamentos manuais como base independente. Consulta de identificação só entra após amostra real de produtos, fonte e condições verificadas. Média de preço exige amostra e critério explícitos; uma oferta não é média. Fotos e identificação não provam custo, lote ou validade da unidade. Importação de documento não comprova chegada física ou quitação.

Enviar compra à marca depende de integração autorizada, confirmação de quem tem permissão e prevenção de pedidos duplicados. Nenhuma integração com Natura, Eudora ou O Boticário foi verificada. A ausência dessa integração não bloqueia T1; bloqueia sua própria capacidade INV.

## D-13 — Qualidade, conexão e dados `[ASSUMPTION]`

T1 é online e tem alternativa manual para câmera e consulta externa. Se não houver conexão antes de enviar, deixar claro que a operação não foi enviada nem confirmada. Se houver queda após envio, apresentar resultado desconhecido e verificar o resultado daquela confirmação antes de repetir, sem assumir que houve falha ou duplicar efeitos. Navegador móvel precisa de contexto seguro aceito pelo dispositivo; acesso por IP local em HTTP não é garantia de câmera funcional.

As metas de desempenho e de cópia de segurança descritas no PRD são propostas a verificar no ambiente de teste. Não anunciar resultado antes de medir. Coleta de contato é para operação autorizada, sem envio automático ou compartilhamento de clientes com serviços de busca de produtos.

## D-14 — Validade `[ASSUMPTION]` — capacidade a testar em P2

Data por grupo de entrada é opcional, com possibilidade de datas distintas do mesmo produto. Impedir venda e entrega de unidades do grupo identificado como vencido; baixa por perda é movimento sem conta de cliente. Não bloquear unidades de outro grupo com validade válida nem presumir validade de grupo desconhecido. Para grupo com reserva, resolver destino da reserva antes de baixar. O esforço de informar datas deve ser medido antes de tornar obrigatório. Esta proposta não promete que o código de barras informa a validade.

## Liberação dos comportamentos

- **T1:** regras operacionais desta especificação resolvem os fluxos de cadastro, chegada, reservas, entrega, contas e ajustes; a revisão dos exemplos integra a preparação das histórias e dos critérios de aceitação. Não é necessário aguardar pesquisa de integrações para usar o fluxo manual.
- **Ganho P2:** fórmula e momento agora definidos com Duda; implementar somente após cobrir cenários de arredondamento, custo desconhecido, antecipação e crédito desta especificação. Validar apresentação de estimativa no teste do indicador.
- **INV:** cada integração continua bloqueada até comprovação da fonte/formato/acesso e cumprimento dos requisitos correspondentes. Responsável técnico registra evidência e Duda decide prioridade; não é pendência a esconder no código.
- **Revisão de política proposta:** Duda é responsável por ajustar hipóteses operacionais após demonstração. Mudança recebe nova versão da regra e preserva histórico; a aprovação das fórmulas confirmadas não é inferida para outras hipóteses.
