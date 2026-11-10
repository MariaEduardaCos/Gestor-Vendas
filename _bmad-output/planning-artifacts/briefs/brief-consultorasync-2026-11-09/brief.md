---
title: "Briefing de produto — ConsultoraSync"
status: draft
created: 2026-11-09
updated: 2026-11-09
---

# Briefing de produto — ConsultoraSync

## Propósito e problema

Ajudar revendedoras autônomas de cosméticos a centralizar encomendas e contas de clientes, controlar a pronta-entrega e compreender o ganho associado aos pagamentos, reduzindo o esforço de registro e consulta. O ConsultoraSync é um projeto de TCC em Engenharia de Software.

Na rotina relatada por Duda, encomendas ficam dispersas entre mensagens, revistas, notas e memória. Quando os produtos chegam, é necessário procurar novamente o que cada cliente pediu. Os produtos encomendados ficam misturados aos de pronta-entrega; a disponibilidade é consultada por contagem física. Os filhos que ajudam no atendimento nem sempre encontram preços e contas. Produtos vencidos são descobertos durante a faxina.

A proposta é conectar as informações desde a encomenda até a entrega e o pagamento. O código de barras apoiará a identificação dos produtos na chegada e na venda. A redução de retrabalho será avaliada no teste; ainda não é resultado demonstrado.

## Público e contexto

O foco inicial são revendedoras que combinam encomendas com compras seletivas para pronta-entrega de Natura, Eudora e O Boticário. A revendedora e quem ajuda na gestão usarão celular e computador. Foi identificada também a necessidade de acesso limitado para pessoa contratada.

A base é o relato de Duda sobre uma rotina conhecida e suas escolhas para o sistema. Não há validação ampla do público ou pesquisa competitiva. O valor a testar é a continuidade das informações entre pedido, recebimento, estoque, atendimento e pagamento.

## Primeiro teste funcional

Duda priorizou o controle de estoque, pedidos e clientes, com leitura de código de barras para identificar produtos e autorizou incorporar o fluxo recomendado, incluindo contas dos clientes e pagamentos.

| Parte do fluxo | O que será testado |
|---|---|
| Clientes e encomendas | Cadastrar nome, telefone e endereço opcional; registrar produtos por cliente e associá-los à compra feita à marca. |
| Cadastro e identificação | Ler código de barras na entrada e venda; conferir sugestões externas quando disponíveis; permitir cadastro manual sem depender da busca. |
| Recebimento e reserva | Confirmar quantidades recebidas antes da entrada no estoque; reservar encomendas e distinguir itens disponíveis. Em falta de unidades, a revendedora escolhe quem atender. |
| Atendimento e entrega | Consultar preço e disponibilidade; registrar vendas e entregas, sem confundir retirada com pagamento. |
| Contas e pagamentos | Manter contas separadas por compra, pagamentos parciais por Pix, dinheiro e cartão e consulta de saldos, com vencimento opcional. |

O fluxo básico não dependerá de integração com marcas. Registrar a compra feita no site é a alternativa inicial; importar dados ou enviar pedidos diretamente exige investigação. O celular pareado como leitor do computador permanece um experimento técnico solicitado, sem limitar o celular a esse papel.

## Necessidades previstas além do teste prioritário

O produto também prevê boletos das marcas com valor, vencimento e confirmação manual de pagamento; visão de valores a receber e a pagar; ganho proporcional aos pagamentos, considerando custos conhecidos e taxas; e produtos recorrentes no perfil do cliente com data do último pedido. Inicialmente, o acesso da pessoa contratada deverá impedir que ela faça pedidos às marcas.

A sequência dessas entregas será definida após o teste prioritário. Não se promete todo o financeiro no primeiro protótipo. O esforço do registro de validade será avaliado no uso.

## Limites e decisões abertas

- Preço de venda, custo de compra e dinheiro recebido são distintos. Referência da internet pode sugerir quanto cobrar, mas não comprova o custo pago.
- Para o caminho inicial, Duda definiu custo estimado pelo preço do produto e percentual por marca: preço 100 e percentual 30% correspondem a custo estimado 70. Sem custo informado nem percentual válido, o ganho fica não calculado. Isso substitui a preferência provisória por identificar o custo individual de unidades misturadas.
- O ganho é reconhecido proporcionalmente ao confirmar pagamento, inclusive antes da entrega; cartão aprovado conta como pago. Cancelamentos, devoluções e créditos seguem as regras detalhadas no PRD, sem duplicar valores.
- Busca de fotos e preços, integrações e importação de documentos são possibilidades, não dependências garantidas. O teste deve funcionar com cadastro manual.
- Tupperware e DeMillus ficam para depois. Miniloja, coleta de revistas e cobrança automática não integram o primeiro teste. Não há promessa de lucro líquido exato ou redução de inadimplência.

## Avaliação do primeiro teste

Verificar se a revendedora e quem a ajuda conseguem encontrar encomendas sem procurar mensagens e revistas, consultar preços e disponibilidade, conferir recebimentos parciais, preservar reservas e registrar pagamentos sem perder o saldo de cada compra. Comparar leitura de códigos e cadastro manual, incluindo produto não encontrado na busca.

Registrar tempo, erros, ajuda necessária e percepção de esforço com produtos e tarefas reais. Metas numéricas e adequação da avaliação acadêmica serão acordadas antes da execução, inclusive com o orientador. Baixo custo é uma restrição; custo zero, desempenho e qualidade das integrações ainda dependem de verificação.

## Fontes

As regras, pendências e destinação dos aprendizados estão no [complemento](addendum.md). Fontes: [descoberta](../../../brainstorming/brainstorm-rotina-revendedoras-2026-11-09/.memlog.md), [análise preparatória](../../../../docs/ANALISE_DESCOBERTA_PARA_BRIEFING.md) e [registro da atualização](.memlog.md).

## Detalhamento posterior de requisitos

O [PRD completo](../../prds/prd-consultorasync-2026-11-09/prd.md) e o [primeiro teste](../../prds/prd-consultorasync-2026-11-09/primeiro-teste.md) detalham este briefing. As [decisões do PRD](../../prds/prd-consultorasync-2026-11-09/decisoes.md) registram as respostas posteriores sobre custo estimado, ganho desconhecido e reconhecimento no pagamento, prevalecendo sobre hipóteses anteriores.
