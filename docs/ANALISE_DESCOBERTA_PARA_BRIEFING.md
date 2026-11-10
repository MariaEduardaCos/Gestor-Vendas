# Análise da descoberta para atualização do briefing — ConsultoraSync

Data: 09/11/2026. Responsável: Mary, análise de negócios.
Status: análise preparatória; recomendações de escopo ainda não aprovadas como plano de implementação.

## 1. Fontes e alcance

- Fonte principal: [registro da descoberta](../_bmad-output/brainstorming/brainstorm-rotina-revendedoras-2026-11-09/.memlog.md), linhas 9–74 na versão analisada.
- Planejamento anterior: [README](../README.md), [arquitetura e roadmap](PLANO_ARQUITETURAL_E_ROADMAP.md) e [plano do scanner](../artefatos/tcc_projetos_rio_verde_plan.md).
- O registro reúne relatos e preferências de Duda sobre uma rotina conhecida, além de interpretações do facilitador. Não equivale a observação direta, entrevista com todas as pessoas envolvidas, pesquisa de mercado ou teste do produto.
- Esta análise não verificou APIs, cobertura de bases externas, formatos de notas ou preços de mercado. Essas possibilidades permanecem em investigação.
- As entradas são cronológicas: respostas posteriores resolvem algumas dúvidas apontadas nas anteriores. Notas do facilitador não devem ser promovidas automaticamente a decisões da usuária.

## 2. Conclusão e premissa proposta

Há evidência suficiente para atualizar o problema e o público do briefing. Ainda não há evidência suficiente para prometer automações, lucro líquido exato ou redução de inadimplência.

**Premissa proposta:** ajudar revendedoras autônomas de cosméticos a centralizar encomendas e contas de clientes, controlar o estoque disponível e reservado e compreender o ganho associado aos pagamentos, reduzindo o esforço de registro e consulta.

O diferencial a testar é a continuidade das informações entre encomenda, recebimento, atendimento e pagamento. O código de barras é um meio de reduzir esforço dentro desse fluxo.

### Evidências que sustentam o problema

| Relato no registro | Consequência para o briefing |
|---|---|
| Pedidos ficam em mensagens, revistas, notas e memória; é preciso procurá-los quando a caixa chega (linhas 10–12 e 24). | Explicitar perda de contexto e retrabalho; organizar encomendas por cliente. |
| Filhos atendem sem localizar contas ou preços (linhas 12–13 e 29–32). | Atendimento compartilhado é parte do público de uso; informações precisam estar acessíveis em celular e computador. |
| Estoque é contado fisicamente e encomendas ficam misturadas à pronta-entrega (linhas 33–35). | Distinguir quantidade presente, reservada e disponível. |
| Validades são descobertas durante a faxina (linhas 58–59). | Há problema relatado; esforço do cadastro de validade ainda depende de teste. |
| Pagamentos são parciais e sem data combinada; a usuária deseja contas separadas por compra (linhas 16–19). | Evitar tratar toda conta aberta como atrasada ou impor parcelamento com vencimentos. |
| São necessários valores a receber e boletos a pagar (linhas 47–50). | Registrar também compromissos com as marcas, além das contas dos clientes. |

## 3. Decisões que podem entrar no briefing

### Público e uso

- Marcas iniciais: Natura, Eudora e O Boticário. Tupperware e DeMillus ficam para depois.
- Uso pelo celular e computador, pela revendedora e por quem ajuda no atendimento.
- Familiares envolvidos na gestão podem ter acesso completo. Pessoa contratada pode registrar vendas e pagamentos, com restrição inicial para fazer pedidos às marcas; preparar rascunho versus finalizar compra ainda precisa ser delimitado.

### Operação

- Encomendas devem estar vinculadas aos clientes e seus itens reservados, sem disponibilidade para outra venda.
- Recebimento exige confirmação das quantidades efetivas antes da entrada no estoque. Uma tela específica de conferência e controles de quantidade foram sugeridos; o desenho exato ainda será testado.
- Em falta de unidades, a revendedora escolhe quais clientes atender.
- Entrega e pagamento são acompanhados separadamente. Retirada parcial foi aceita quando a encomenda chega incompleta.
- Produtos ainda não recebidos aparecem no total da conta, com consulta alternativa excluindo esses itens.
- Produto confirmado como não entregável sai do valor devido. Se houver crédito por pagamento já realizado, o cliente escolhe devolução ou uso em compra futura.
- Manter o preço definido para produtos em estoque quando a revista mudar.
- Leitura de código de barras na chegada e na venda; cadastro manual deve continuar possível. Sugestões externas são conferidas antes de salvar.

### Clientes e financeiro

- Cadastro com nome, telefone e endereço opcional; obrigatoriedade do telefone ainda não foi estabelecida.
- Contas separadas por compra, pagamentos parciais vinculados à conta escolhida e possibilidade de não informar vencimento.
- Pix, dinheiro e cartão; cartão aprovado quita o valor correspondente na conta do cliente, sem significar depósito disponível.
- Taxa de cartão normalmente absorvida pela revendedora: informada inicialmente em cada pagamento; percentual padrão é possibilidade futura.
- Um boleto por pedido à marca no cenário inicial relatado, cadastrado manualmente com valor e vencimento e marcado como pago por ação da usuária.
- Ganho apresentado proporcionalmente aos pagamentos, sujeito à definição de custo e dos casos de ajuste abaixo.
- Recorrência: mesmo produto pedido pelo cliente pelo menos duas vezes, exibido no perfil com data do último pedido, para apoiar decisão manual de compra para pronta-entrega. A interpretação de duas ocasiões distintas foi introduzida no diálogo; deve ser explicitada na futura regra.

## 4. Mudanças necessárias em relação ao planejamento anterior

| Planejamento anterior | Tratamento recomendado na atualização |
|---|---|
| Scanner e consulta externa como centro do primeiro protótipo. | Reposicionar dentro do fluxo de clientes, encomendas e estoque. Preservar o teste de celular pareado como experimento técnico solicitado. |
| Redução de inadimplência como benefício anunciado. | Usar acompanhamento de saldos e pagamentos; efeito sobre inadimplência ainda não demonstrado. |
| Alertas de validade já incluídos no MVP. | Preservar necessidade e planejar teste do esforço de registro antes de confirmar obrigatoriedade e prioridade. |
| Régua de cobrança WhatsApp como funcionalidade definida. | Manter WhatsApp como canal relatado; critérios de cobrança e automação não foram definidos. |
| Frete e sacolas tratados como despesas presentes. | Diferenciar hipóteses anteriores de despesas relatadas: custo dos produtos e taxa de cartão foram identificados nesta descoberta. |
| Base externa e passagem obrigatória para aplicativo instalado. | Tratar como decisões técnicas a reavaliar; uso completo no celular e computador é a necessidade confirmada. |
| Custo zero e desempenho apresentados como garantias. | Preservar baixo custo como restrição do projeto e estabelecer verificações antes de anunciar resultados. |
| Vendas e parcelas como base do modelo anterior. | Revisar depois para incluir encomendas, pedidos às marcas, recebimentos, reservas e pagamentos sem vencimento obrigatório. |

## 5. Lacunas e conflitos que o briefing precisa tornar visíveis

| Ponto | Análise e encaminhamento recomendado |
|---|---|
| Custo individual com unidades misturadas | A preferência por custo real da unidade está registrada, mas não há procedimento para identificar a compra de origem. Manter como hipótese operacional. Não escolher média ou ordem de entrada silenciosamente. Isso não impede testar cadastro, pedidos e quantidades. |
| Preço da internet quando o custo é desconhecido | A finalidade declarada é saber quanto cobrar. Separar referência de venda de custo pago. A afirmação de deixar o ganho pendente foi uma orientação do facilitador, não aprovação explícita da usuária; decidir como mostrar ganho incompleto ou estimado antes de implementar o indicador. |
| Pagamento recebido antes da chegada ou entrega | A conta inclui itens ainda aguardados, mas não foi definido se antecipações já contam para ganho. Esclarecer esse caso junto de cancelamentos, devoluções e créditos. |
| Ganho no cartão | A aprovação quita a conta do cliente. Isso não resolve quando contar ganho no relatório: aprovação ou recebimento da operadora. A regra precisa de exemplo e definição de período. |
| Total sem itens pendentes | Está definido mostrar o cálculo alternativo. Falta definir como pagamentos já feitos serão abatidos dessa visualização sem produzir cobrança duplicada ou saldos enganosos. |
| Boleto pago e custo da mercadoria | Recomenda-se separar compromissos de caixa do custo dos produtos vendidos, para que pagar um boleto não desconte novamente um custo já considerado no ganho. Formalização pertence às regras financeiras. |
| Origem das encomendas | Importar um pedido feito à marca não garante saber qual item pertence a qual cliente. Preservar o vínculo por cliente na coleta das encomendas, mesmo que os itens da compra sejam importados depois. |
| Envio de pedidos às marcas | Desejo condicionado à viabilidade. O briefing deve prever operação sem depender dessa integração; pesquisa específica por marca antecede qualquer promessa. |
| Sugestões de foto e média de preços | Verificar identificação correta do produto, fontes e cálculo de média. Se só existir uma referência, não chamá-la de média. Falha da consulta não bloqueia o cadastro manual. |
| Desistência após chegada | Retorno à pronta-entrega foi proposto com incerteza sobre a prática atual. Não registrar como regra validada. |
| Histórico e correções | Preservar rastreabilidade de cancelamentos, estornos e correções é recomendação da análise, ainda sem detalhamento acordado; remover valor devido não exige apagar o histórico. |

Evitar a expressão “lucro líquido real” enquanto custos desconhecidos, despesas, taxas e critérios de reconhecimento não estiverem resolvidos. Usar uma descrição compatível com as informações efetivamente consideradas no cálculo.

## 6. Recorte recomendado e critérios do primeiro teste

**Prioridade expressa pela usuária:** estoque, pedidos e clientes, com código de barras.

**Recomendação da análise, ainda sujeita a acordo:** primeiro testar um fluxo completo e pequeno: cadastrar cliente → registrar encomenda → associar itens ao pedido à marca → conferir chegada → separar reservado/disponível → localizar produto pelo código → registrar entrega ou venda. Inclusão e profundidade de pagamentos, boletos, acessos e recorrência nesse primeiro teste ainda precisam ser acordadas, sem retirá-los da visão do produto.

O experimento deve permitir verificar se a pessoa consegue:

1. Encontrar o pedido de um cliente sem procurar novamente mensagens e revistas.
2. Consultar preço e quantidade disponível durante atendimento por outra pessoa autorizada.
3. Registrar recebimento parcial sem aumentar o estoque por unidades que não chegaram.
4. Distinguir itens reservados dos disponíveis e impedir venda de reserva de outro cliente.
5. Ler um produto conhecido e concluir cadastro manual quando a consulta externa falhar.

Registrar tempo, dificuldades, erros e ajuda necessária, além da percepção de esforço. Metas numéricas ainda serão definidas; não há resultados medidos nesta descoberta.

## 7. Como atualizar os documentos

1. Criar um briefing de produto conciso em `_bmad-output/planning-artifacts/`, pois os arquivos atuais são uma visão geral e planos técnicos, não um briefing único estruturado.
2. Levar ao briefing: problema, premissa, público, limites das evidências, prioridades confirmadas, benefícios a testar e hipóteses principais.
3. Levar a um complemento: regras detalhadas de recebimento, financeiro, permissões, exceções e evolução futura. Preservar o registro original da descoberta como fonte histórica.
4. Identificar claramente no briefing as recomendações de recorte que ainda exigem acordo, sem apresentá-las como decisões da usuária.
5. Após consolidar o briefing, alinhar README e revisar o roadmap e os modelos arquiteturais. Preservar a história das decisões anteriores, indicando quais foram substituídas.

Esta análise não altera os documentos anteriores nem fecha as lacunas apontadas. Ela fornece a base para uma atualização rastreável do briefing, sem repetir a entrevista inteira.
