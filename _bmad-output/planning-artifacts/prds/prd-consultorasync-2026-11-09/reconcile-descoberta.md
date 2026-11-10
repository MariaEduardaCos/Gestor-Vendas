# Reconciliação — descoberta e respostas posteriores

Fonte: registro da descoberta em `_bmad-output/brainstorming/brainstorm-rotina-revendedoras-2026-11-09/.memlog.md`, confrontado com `prd.md`, `primeiro-teste.md`, `decisoes.md` e `addendum.md` deste diretório.

## Veredito

O núcleo da descoberta está representado e as respostas posteriores prevalecem corretamente sobre as preferências anteriores. Não encontrei omissão material de necessidade confirmada no fluxo T1. Há um desalinhamento de requisito P2 e uma ressalva sobre a situação das regras propostas; nenhum exige repetir a descoberta inteira.

## Respostas posteriores reconciliadas

- **Percentual sobre preço definido:** D-01 e FR-011 usam B=100 e 30% para obter ganho de referência 30 e custo estimado 70, sem confundir com acréscimo sobre custo. Percentuais reais por marca não foram inventados. O exemplo é dado de cálculo e teste.
- **Custo desconhecido:** D-02, FR-012, FR-046 e CF-03 permitem registrar venda e pagamento, deixando ganho não calculado sem converter custo ausente em zero.
- **Ganho no pagamento, mesmo antes da entrega:** D-03, FR-045 e CF-01 preservam a escolha; entrega não reconhece o mesmo ganho novamente.
- **Cartão aprovado:** FR-035 e D-03 quitam o valor bruto correspondente e não exigem depósito da operadora. Taxa não reduz o saldo quitado do cliente.
- **Preferência anterior por custo individual:** D-01 explicita sua substituição pelo caminho estimado por marca. As unidades misturadas não são usadas como justificativa para selecionar silenciosamente média ou ordem de entrada.

## Conteúdo da descoberta preservado

- Cliente, encomenda e compra à marca separados; vínculo dos itens aos clientes mantido mesmo em compra agregada.
- Entrada somente após conferência; recebimento parcial; escolha da revendedora em falta; reserva protegida e saída única na entrega.
- Entrega independente de pagamento; retirada parcial condicionada à chegada incompleta.
- Conta por compra; pagamentos parciais na conta escolhida; vencimento opcional; visão sem itens aguardados; excedente, devolução e crédito com escolha do cliente.
- Código na entrada e venda; confirmação dos dados sugeridos; cadastro manual como alternativa.
- Marcas iniciais, dois tipos de dispositivo e atendimento pelos familiares.
- Boletos, visão financeira, recorrência e validade representados no produto completo, sem expandir silenciosamente o primeiro teste.
- Origem limitada das evidências, pesquisa externa não realizada e integrações condicionadas identificadas.

## Achados e recomendações

### 1. Bloqueio de venda de vencido está mais forte em D-14 que em FR-051

**Local:** `decisoes.md`, D-14; `prd.md`, FR-051.

D-14 determina que registrar vencido não deve efetivar venda. FR-051 exige sinalização e baixa de perda, mas sua aceitação não verifica impedir venda de unidade com validade conhecida vencida. A descoberta não confirmou essa política: ela é proposta operacional P2, corretamente identificada como tal.

**Recomendação:** alinhar FR-051 e seu critério de aceitação à política proposta D-14, ou retirar a afirmação normativa de bloqueio enquanto se define a política. Não a apresentar como decisão já confirmada de Duda. Sem efeito sobre T1, que não depende do registro de validade.

### 2. Regras propostas são especificadas, mas não devem ser chamadas de políticas aprovadas

**Local:** `primeiro-teste.md`, §2 “Regras já resolvidas”; `decisoes.md`, introdução e “Liberação dos comportamentos”; `prd.md`, §9.

Os documentos distinguem D-01 a D-03 das regras operacionais `[ASSUMPTION]` e exigem exemplos antes de codificar o comportamento afetado. Isso é compatível com produzir um PRD determinístico sem atribuir novas decisões à usuária. Contudo, o título “Regras já resolvidas” pode ser lido como aprovação de todas as políticas, especialmente D-07, D-09 e D-10, cujas operações foram propostas para tratar crédito, desistência e acesso.

**Recomendação:** preferir “Regras confirmadas e propostas operacionais” no recorte e manter o acordo explícito de validação dos exemplos antes da implementação afetada. A aprovação da fórmula percentual não confirma automaticamente as demais propostas. Este ponto é de apresentação do grau de decisão, não necessidade de nova entrevista geral.

## Limites desta reconciliação

Não houve teste de software, revisão exaustiva das fórmulas ou validação de integração. A tarefa foi reconciliar o conteúdo fornecido pela usuária, distinguindo-o das interpretações do facilitador e das propostas do PRD. As hipóteses de telefone opcional, recorrência em compras distintas, acesso do contratado, desenho de conferência e políticas de correção permanecem identificadas, em vez de serem registradas como falas confirmadas.
