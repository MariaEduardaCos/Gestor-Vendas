# Complemento do briefing — ConsultoraSync

Data: 09/11/2026. Acompanha o [briefing](brief.md). Preserva regras e questões abertas sem transformar tudo em compromisso do primeiro protótipo.

## Organização da entrega

**Primeiro teste autorizado:** clientes, encomendas vinculadas, associação ao pedido à marca, código de barras e cadastro manual, conferência, reservas, disponibilidade, vendas, entregas, contas e pagamentos parciais. Acesso pelo celular e computador e experimento de celular pareado como leitor.

**Necessidades previstas, com sequência a definir:** boletos, visão financeira inicial, ganho após resolver lacunas, configuração de acessos, recorrência e experiência de registro de validade. O acesso usado no teste deve ser adequado às pessoas participantes.

**Investigações e evoluções:** integrações, importação de notas/pedidos/boletos, dados externos ampliados, percentual padrão de taxa e eventual aplicativo instalado. Tupperware e DeMillus para depois. Miniloja, coleta de revistas e cobrança automática são ideias históricas fora do primeiro teste.

## Clientes e acesso

- Cadastro: nome, telefone e endereço opcional. Obrigatoriedade do telefone ainda não definida.
- Revendedora e filhos que ajudam na gestão: acesso completo desejado. Pessoa contratada pode registrar vendas e pagamentos, com restrição inicial para fazer pedidos às marcas. Preparar rascunho versus finalizar compra ainda precisa de definição.
- Uso pelo celular e computador; funcionamento sem internet não foi definido.
- Recorrência: mesmo produto pedido pelo cliente pelo menos duas vezes, exibido no perfil com data do último pedido para apoiar compra para pronta-entrega. Interpretar como duas ocasiões distintas foi orientação apresentada no diálogo; período de análise e cancelamentos ainda precisam de definição. Não gerar encomenda nem compra automática.

## Encomendas, compras e estoque

- Separar encomenda do cliente, pedido de compra à marca e recebimento. Essa organização recomendada foi incorporada ao primeiro teste.
- Preservar o vínculo dos itens aos clientes: uma futura importação da compra à marca pode não informar de quem é cada produto.
- Preferência por montar pedidos no sistema e enviar à marca se viável. Alternativa inicial: comprar no site e registrar dados no sistema; importação automática será investigada.
- Cadastrar estoque existente por código de barras; apresentar sugestões externas quando disponíveis, com conferência e ajuste antes de salvar. Se a busca falhar, cadastrar manualmente nome, quantidade e preço de venda.
- Revista ou acréscimo sobre custo foram propostos como formas de precificação. Preço externo pode orientar venda, não comprovar custo. Manter preço definido quando a revista mudar.
- Conferência aberta por ação específica: lista com caixas de seleção e edição de quantidades ou botões “+” e “−” são propostas de interface a testar.
- Confirmar recebimento pelas quantidades reais antes de atualizar estoque. Distinguir unidades presentes, reservadas e disponíveis; não vender a outra pessoa itens reservados. Em falta, a revendedora escolhe quais clientes atender.
- Retirada parcial apenas quando a encomenda chega incompleta; acompanhar itens entregues e aguardados.
- Desistência após chegada: retorno à pronta-entrega é proposta provisória, não prática confirmada.
- Validade: problema relatado; esforço do registro será avaliado no teste, sem obrigatoriedade definida.

## Contas, pagamentos e compromissos

- Contas separadas por compra, pagamentos parciais na conta escolhida e vencimento opcional. Conta aberta sem data não é automaticamente atrasada.
- Entrega e pagamento separados. Mostrar saldo restante e situações como entregue com pagamento pendente ou parcialmente pago.
- Total da encomenda inclui itens ainda não recebidos; permitir cálculo alternativo sem eles. Abatimento dos pagamentos nessa visualização precisa de exemplo acordado.
- Quando a marca confirmar que não entregará um produto, seu valor será retirado da conta do cliente. Se houver pagamento excedente, devolver ou, por escolha do cliente, manter crédito para compra futura.
- Pix, dinheiro e cartão. A aprovação do pagamento no cartão quita o valor correspondente na conta do cliente, independentemente do depósito posterior.
- Taxa do cartão geralmente absorvida pela revendedora, informada por pagamento inicialmente. Percentual padrão é possibilidade futura.
- WhatsApp é canal relatado; frequência, texto, momento e automação de cobrança não foram definidos.
- Visão desejada: valores a receber e a pagar. Um boleto por pedido no cenário relatado, cadastrado com valor e vencimento e marcado manualmente como pago. Preenchimento automático é possibilidade futura.

## Ganho e decisões de cálculo

- Ganho proporcional aos pagamentos. Exemplo sem taxas e com custo conhecido: venda de R$ 100, custo de R$ 70 e pagamento de R$ 50 corresponde a R$ 15 de ganho; restante reconhecido na quitação.
- Custos dos produtos e taxas de cartão foram identificados. Frete e sacolas eram hipóteses anteriores, não confirmadas nesta rotina; não presumir ausência definitiva de outras despesas.
- Na elaboração do PRD, Duda substituiu a preferência provisória por custo individual pelo caminho de estimativa por percentual da marca sobre preço definido: 100 com 30% gera custo estimado 70. Sem dado nem percentual configurado, ganho não calculado; estimativa não é custo real comprovado.

## Pendências de detalhamento

| Pendência | Encaminhamento |
|---|---|
| Custo de unidades misturadas | Resolvido para o caminho inicial por estimativa por marca; ver D-01 no PRD. Não apresentar como ganho exato. |
| Produto antigo sem custo conhecido | Duda confirmou no PRD ganho não calculado quando não houver custo informado nem estimativa válida; ver D-02. |
| Antecipação e cartão | Duda confirmou reconhecimento no pagamento, mesmo antes da entrega; cartão aprovado conta como pago. Ver D-03. |
| Créditos, devoluções e cancelamentos | Definir ajustes, estornos e aplicação de crédito sem duplicar ganho. |
| Ganho versus caixa | Não descontar novamente o custo já considerado no ganho ao pagar boleto da compra. Distinguir ganho, recebimentos e compromissos. |
| Preço e foto externos | Verificar produto e variante, cobertura, fontes e qualidade. Uma referência não constitui média. |
| Correções e acessos | Delimitar ações restritas e correções de vendas, pagamentos e estoque. Preservar histórico é recomendação a detalhar. |
| Primeiro estoque e saídas | Definir confirmação do estoque existente e evitar entrada duplicada ou saída contada tanto na venda quanto na entrega. |

Essas pendências não impedem teste do fluxo prioritário com custos conhecidos e cenários controlados. Devem ser resolvidas antes de implementar os comportamentos afetados.

## Destinação dos aprendizados

| Conteúdo da descoberta | Destino |
|---|---|
| Rotina, dores, público, marcas e dispositivos (linhas 9–15, 22–35) | Problema e público no briefing; detalhamento neste complemento. |
| Contas, pedidos, recebimentos, reservas e exceções (linhas 16–21, 24–26, 36–50) | Fluxo no briefing; regras e pendências neste complemento. |
| Ganho, custo e validade (linhas 51–59) | Limites no briefing; cálculo e hipóteses neste complemento. |
| Prioridade, recorrência e cadastro assistido (linhas 60–68) | Recorte no briefing; regras e evolução neste complemento. |
| Cartão e taxas (linhas 69–72) | Pagamentos no briefing; regras e pendências neste complemento. |
| Encerramento e síntese (linhas 73–74) | Contexto, sem novos requisitos. |
| Questões intermediárias depois respondidas | Histórico preservado; não contar como lacunas atuais. |
| Interpretações do facilitador | Recomendações ou pendências, não confirmações da usuária. |

Fontes: [descoberta](../../../brainstorming/brainstorm-rotina-revendedoras-2026-11-09/.memlog.md), [análise](../../../../docs/ANALISE_DESCOBERTA_PARA_BRIEFING.md) e [registro da atualização](.memlog.md). Numeração relativa à versão da descoberta com 74 linhas.

## Detalhamento e decisões posteriores

As [decisões do PRD](../../prds/prd-consultorasync-2026-11-09/decisoes.md) resolvem as pendências operacionais restantes por regras propostas explicitamente identificadas. Integrações continuam condicionadas à verificação; o [recorte T1](../../prds/prd-consultorasync-2026-11-09/primeiro-teste.md) preserva o fluxo manual independente.
