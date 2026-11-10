# Reconciliação — briefing, complemento e análise preparatória

Fontes: briefing e complemento em `../../briefs/brief-consultorasync-2026-11-09/`, análise em `../../../../docs/ANALISE_DESCOBERTA_PARA_BRIEFING.md`.

Documentos reconciliados: `prd.md`, `primeiro-teste.md`, `decisoes.md` e `addendum.md` desta pasta. Leitura realizada sobre os rascunhos disponíveis nesta rodada; não constitui teste do software.

## Veredito

Não foram encontradas lacunas materiais de cobertura das fontes que bloqueiem a organização do PRD. O recorte T1 preserva o fluxo autorizado; o produto completo representa as necessidades adicionais como P2 ou INV, sem prometer integrações ou financeiro completo no primeiro teste.

As novas respostas de Duda prevalecem sobre as pendências do briefing: percentual por marca sobre preço definido, custo desconhecido com ganho não calculado e reconhecimento no pagamento antes da entrega, incluindo cartão aprovado. D-01 a D-03 registram essas decisões e os cenários correspondentes aparecem no primeiro teste ou nos contratos financeiros P2. Não tratar o antigo método de custo individual como requisito atual.

## Cobertura verificada

- Cliente, endereço opcional, consulta de contas separadas, uso por familiar e acesso em celular/computador: FR-001 a FR-005, UJ-3 e D-10.
- Leitura na chegada/venda, sugestões conferidas, alternativa manual, código sem resultado e preço preservado: FR-006 a FR-014 e FR-019; fontes externas condicionadas em FR-052/053.
- Vínculo encomenda–cliente–compra à marca, recebimento parcial, escolha em falta de unidades e quantidades esperadas distintas do estoque físico: FR-015 a FR-024 e D-08.
- Estoque presente/reservado/disponível, retirada parcial condicionada à chegada incompleta e separação de entrega/pagamento: FR-025 a FR-031.
- Pagamentos parciais na conta escolhida, vencimento opcional, cartão bruto distinto de taxa, cálculo sem itens aguardados, cancelamento e escolha entre devolução/crédito: FR-032 a FR-041 e D-04 a D-07.
- Boletos manuais com vencimento e quitação manual, ganho proporcional, recorrência, validade opcional e padrão futuro de taxa: FR-042 a FR-051 e FR-056.
- Integrações a investigar, ausência de promessa de ganho líquido exato, baixo custo como restrição e avaliação sem generalização estatística: FR-052 a FR-055, NFRs, limites e avaliação.

## Hipóteses preservadas como hipóteses

A obrigatoriedade apenas do nome, interpretação de recorrência por compras distintas, alcance da restrição do contratado, liberação da reserva por desistência e mecanismos de estorno não aparecem como falsas confirmações da usuária: estão identificados em D-04 em diante como regras operacionais propostas. Isso atende à recomendação central da análise preparatória.

A organização preserva detalhes em documentos complementares e não repete perguntas antigas como pendências quando decisões posteriores as resolveram.

## Lacunas e solução recomendada

Não há lacuna material das fontes a corrigir nesta reconciliação. Não acrescentar por inferência exigências como compra mínima automática, WhatsApp automático, integração de marca ou obrigatoriedade de validade: não foram confirmadas como funções do primeiro teste.

Antes de transformar as regras operacionais em histórias, apresentar seus exemplos a Duda como previsto em `decisoes.md`. Essa etapa valida as políticas inferidas, não reabre as três fórmulas já confirmadas nem exige repetir a descoberta inteira. Verificações técnicas de câmera, pareamento e fontes externas mantêm seus próprios critérios de liberação; cobertura documental não comprova viabilidade.
