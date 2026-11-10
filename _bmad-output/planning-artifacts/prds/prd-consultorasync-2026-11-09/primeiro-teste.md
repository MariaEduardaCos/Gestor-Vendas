---
title: "Especificação de requisitos do primeiro teste — ConsultoraSync"
status: final
created: 2026-11-09
updated: 2026-11-09
---

# Especificação do primeiro teste — ConsultoraSync

## 1. Objetivo e escopo

Verificar um fluxo completo de cliente, encomenda, recebimento, reserva, estoque, venda, entrega e pagamento, usando código de barras onde houver produto identificado. Este documento especifica o teste e seus resultados esperados; nenhum cenário de software foi executado nesta elaboração.

A definição normativa dos requisitos está no [PRD completo](prd.md); as [decisões](decisoes.md) resolvem regras financeiras e de movimentação. Não copiar uma versão diferente da fórmula para a implementação. IDs deste recorte são os mesmos do produto completo.

**Incluídos:** FR-001 a FR-004 e FR-006 a FR-041. São 40 requisitos T1. NFR-001 a NFR-012 são aplicáveis nas condições descritas no PRD.

**Fora deste recorte:** perfil de contratado FR-005; boletos, resumo financeiro, relatório de ganho, recorrência, validade e percentual padrão de taxa FR-042 a FR-051 e FR-056; integrações condicionadas FR-052 a FR-055. O primeiro teste registra as bases de custo estimado/informado/desconhecido e taxas, mas não exige relatório de ganho. Sugestão externa só é exercitada se uma fonte tiver sido validada; falha ou ausência não impede o teste manual.

A experiência de leitor pareado integra T1; não substitui o atendimento completo no celular. Não há compra real enviada às marcas, confirmação bancária automática nem necessidade de dados de cartões.

## 2. Decisões confirmadas e regras operacionais propostas

- Percentual por marca incide sobre preço definido: R$ 100 com 30% corresponde a ganho de referência R$ 30 e custo estimado R$ 70; não é acréscimo sobre custo. Configurar percentual de teste sem afirmar que é o percentual praticado pela marca.
- Preservar parâmetros na transação. Não exigir identificação da compra física da unidade no modo de estimativa; mostrar origem estimada.
- Se não houver custo nem percentual, manter custo desconhecido; a venda e o pagamento continuam possíveis e ganho é não calculado.
- Ganho P2 conta no pagamento, inclusive antes da entrega e no cartão aprovado; não confundir quitação com depósito bancário.
- Entrada física ocorre na conferência; reserva não é saída; saída ocorre na entrega. Estoque inicial é contagem própria, não compra fictícia.
- Conta por compra, pagamento na conta escolhida, vencimento opcional, visão alternativa sem itens aguardados sobre a mesma conta.
- Cancelamento reduz total; excedente fica pendente de devolução ou crédito escolhido. Manter origem e não duplicar dinheiro.

D-01 a D-03 são escolhas diretas de Duda. D-04 a D-11 e D-13 são regras operacionais propostas para este teste, descritas com exemplos e ajustáveis por feedback. Antes de implementar cada comportamento, a história correspondente deve incluir seus exemplos e verificações; dependência externa não comprovada fica desabilitada.

## 3. Preparação

Usar ambiente de teste, sem comprar ou transferir dinheiro. Pessoas: uma revendedora e um familiar autorizado, com identificações distintas. Clientes fictícios Ana e Bia, sem representar pessoas entrevistadas. Marcas iniciais conforme briefing, sem inferir percentuais comerciais.

Preparar pelo menos: produto A com código legível, preço 100 e percentual de teste 30%; produto B sem código ou sem resultado externo, preço 50 e custo desconhecido; variante distinta de A; duas encomendas; compra à marca contendo itens para clientes e pronta-entrega. Separar um celular e um computador, conexão e câmera em contexto seguro, com alternativa de digitação.

Usar instâncias independentes ou repor os dados de cada cenário para evitar que resultados anteriores mudem suas pré-condições. Documentar data, versão do sistema, ambiente, tamanhos de tela, dados usados e conectividade. Dados de teste podem ser simulados; validação do leitor exige também códigos de produtos físicos reais e registro do modelo do aparelho.

## 4. Cenários de aceitação

### CT-01 — Acesso individual e isolamento (FR-001, FR-002)

**Dado** revendedora e familiar autorizados e outra operação de teste. **Quando** cada pessoa acessa contas e confirma um registro. **Então** o histórico identifica a pessoa, os dados da mesma operação são compartilhados e os da outra não ficam acessíveis nem por endereço/identificador conhecido. Sem sessão, não exibir dados de clientes.

### CT-02 — Cadastro e perfil (FR-003, FR-004)

**Dado** nome e nenhum telefone/endereço. **Quando** cadastrar Ana e uma homônima. **Então** ambas existem separadamente; buscar nome permite distinguir identidades. Perfil exibe compras separadas, sem exigir contato completo.

### CT-03 — Produto, variante e preço (FR-006, FR-010)

**Dado** duas variantes de mesmo nome. **Quando** cadastrar códigos e preços e depois consultar nova revista. **Então** variantes não se fundem e preço salvo não muda sem confirmação explícita. Produto sem código pode ser encontrado pelo nome.

### CT-04 — Percentual e origem do custo (FR-011, FR-012, FR-019)

**Dado** produto A com B=100 e percentual da marca 30%. **Quando** confirmar uma transação. **Então** guardar custo estimado 70 e origem percentual, sem identificar custo como comprovado. Mudar percentual para 25% afeta novas transações, não a anterior. Em outra transação com custo informado, origem deve ser distinta.

### CT-05 — Custo desconhecido (FR-012)

**Dado** produto B sem custo nem percentual. **Quando** cadastrar preço de venda e vender. **Então** permitir o fluxo e preservar estado desconhecido, sem custo zero. A futura apresentação do ganho deve ser não calculado para esse item.

### CT-06 — Leitura e alternativa manual (FR-007, FR-008, FR-009)

**Dado** código cadastrado, código desconhecido e câmera sem permissão. **Quando** ler ou digitar cada caso. **Então** localizar o conhecido; oferecer cadastro manual do desconhecido; permitir digitação com câmera negada. Segurar o código na câmera não multiplica quantidade. Ler sozinho não confirma movimentação.

### CT-07 — Estoque inicial (FR-013)

**Dado** produto sem estoque. **Quando** contar e confirmar 5 unidades e repetir a mesma confirmação após recarga. **Então** há 5 presentes e disponíveis, sem compra fictícia, com um movimento de origem. Uma nova correção é ajuste justificado, não repetição oculta da carga inicial.

### CT-08 — Pareamento (FR-014)

**Dado** sessão do computador e celular autorizados. **Quando** parear, ler A, desconectar e reconectar. **Então** o computador recebe identificação uma vez por ação validada; não cria venda. Sessão expirada ou alheia é recusada, e encerramento impede novos eventos. Acesso à câmera é testado no dispositivo real, sem exceção insegura do navegador.

### CT-09 — Encomenda e compra à marca (FR-015 a FR-019)

**Dado** Ana pede 1 A e Bia pede 1 A. **Quando** registrar encomendas e associar a uma compra à marca com mais 1 A para pronta-entrega. **Então** compra agregada tem 3, encomendas mantêm seus clientes e contas próprias. Há 3 esperados e nenhum presente antes da chegada. Rascunho não entra no saldo a receber.

### CT-10 — Conferência parcial (FR-020, FR-021)

**Dado** compra de 3 A sem recebimentos. **Quando** informar chegada de 2 e confirmar. **Então** há 2 presentes e 1 aguardado. Repetição da mesma confirmação não gera mais 2. Posterior chegada de 1 totaliza 3, não 5. Quantidade negativa ou acima do pendente exige correção explícita, não entrada silenciosa.

### CT-11 — Falta de unidades e reserva (FR-022, FR-023, FR-025)

**Dado** duas encomendas aguardam e chegou 1 unidade. **Quando** conferir chegada. **Então** exigir destinação escolhida pela revendedora; se destinada a Ana, mostrar 1 presente, 1 reservado e 0 disponível. Bia continua aguardando, sem reserva física inexistente.

### CT-12 — Venda e entrega sem saída dupla (FR-026, FR-027, FR-031)

**Dado** 2 disponíveis. **Quando** confirmar venda de 1 sem retirada. **Então** presentes=2, reservados=1 e disponíveis=1. Ao entregar, presentes=1, reservados=0 e disponíveis=1. Confirmar entrega novamente não faz nova saída. Conta pode continuar aberta.

### CT-13 — Entrega parcial (FR-028, FR-031)

**Dado** encomenda com 2 itens distintos e apenas um recebido. **Quando** entregar o recebido. **Então** mostrar parcialmente entregue e manter o outro aguardado; pagamento é independente. Se ambos já chegaram, fluxo inicial exige entrega integral, sem liberação parcial silenciosa.

### CT-14 — Cancelamento e contagem (FR-024, FR-029, FR-030)

**Dado** item reservado presente e outro ainda aguardado. **Quando** cancelar o primeiro por desistência confirmada e o segundo por indisponibilidade definitiva da marca. **Então** primeiro fica disponível, segundo não gera estoque; ambos saem do valor devido na quantidade cancelada. Tentar reduzir presentes abaixo de reservas existentes exige resolução dos vínculos afetados. Não permitir usar esse comando para devolver fisicamente item já entregue.

### CT-15 — Conta escolhida e vencimento (FR-032, FR-034, FR-036)

**Dado** contas de Ana com totais 100 e 80, sem vencimento. **Quando** receber 40 na segunda. **Então** saldos 100 e 40, segunda parcialmente paga e nenhuma classificada como atrasada. Valor acima do saldo é recusado no fluxo de pagamento, sem criar crédito acidental.

### CT-16 — Consulta sem itens aguardados (FR-033)

**Dado** conta total 150, recebidos 100 e pagamento 40. **Quando** alternar visão. **Então** saldo completo=110 e sem aguardados=60. Com pagamento acumulado 120, mostrar 30 e 0 respectivamente, com 20 já pagos em relação a aguardados, sem gerar crédito ou nova conta.

### CT-17 — Cartão e taxa (FR-035, FR-041)

**Dado** saldo 100. **Quando** confirmar pagamento no cartão de 100 e taxa absorvida 3. **Então** saldo=0, pagamento bruto=100, líquido da taxa=97; não aguardar depósito. Taxa negativa ou maior que bruto é recusada. Confirmação não faz cobrança real pela maquininha.

### CT-18 — Estorno e histórico (FR-037)

**Dado** conta 100 com pagamento 40. **Quando** corrigir por estorno justificado. **Então** saldo volta a 100, pagamento original permanece no histórico e operador é identificado. Se houver crédito dependente utilizado, impedir desfazer só a origem e informar dependências a reverter.

### CT-19 — Excedente e devolução (FR-038, FR-039)

**Dado** conta 100 paga em 100. **Quando** cancelar item não entregue de 30. **Então** total=70 e excedente=30, sem apagar pagamento. Ao confirmar devolução de 30, excedente=0 e não existe crédito simultâneo de 30. Não ocorre transferência bancária automática.

### CT-20 — Crédito e destino (FR-040, FR-041)

**Dado** excedente 30 escolhido pelo cliente como crédito. **Quando** converter e aplicar 20 em outra conta do mesmo cliente, de total 80. **Então** carteira=10, saldo destino=60 e novo recebimento externo=0. Não aplicar em cliente diferente nem permitir usar os mesmos 20 novamente.

Em conta paga com meios mistos, testar também cancelamento: total 100 pago com 60 em dinheiro e 40 em crédito, reduzido para 50, gera excedente 50; apenas 30 são elegíveis à devolução em dinheiro, e 20 retornam à carteira de crédito. Converter todo o excedente em crédito por escolha produz 50 em carteira, não devolução em dinheiro.

### CT-21 — Concorrência e recuperação (FR-020, FR-026, FR-027, FR-034; NFR-001)

**Dado** uma última unidade e duas sessões. **Quando** ambas tentam confirmar venda. **Então** apenas uma confirma e a outra recebe situação atualizada, sem conta ou pagamento parcial órfão. Após queda de conexão em uma confirmação, consultar resultado e repetir sem duplicar. Recarregar mantém fatos confirmados.

### CT-22 — Dispositivos, falhas e qualidade (NFR-002 a NFR-012)

Executar cadastro, consulta, venda e pagamento em celular e computador; testar rótulos, teclado e texto de situações; medir busca interna com massa de teste; negar câmera e indisponibilizar busca externa; demonstrar recuperação de cópia. Registrar resultados reais, sem preencher metas como aprovadas antes de medir. Sem rede antes do envio, informar não envio; se a conexão cair após envio, mostrar resultado desconhecido e consultar a confirmação anterior antes de repetir com segurança.

## 5. Condição de conclusão e evidências

Antes de implementar cada comportamento afetado, incluir a decisão correspondente e seus cenários na história. Toda condição INV continua bloqueada até evidência de viabilidade; a operação manual permanece o caminho T1.

Para concluir o teste, todos os cenários T1 devem ter resultado registrado. Erro de saldo, reserva, privacidade ou duplicação bloqueia aceite, independentemente de velocidade. Falha apenas de fonte externa não reprova o fluxo manual; registrar limitação e não alegar busca automática validada. O experimento de pareamento precisa de resultado próprio, distinto do sucesso da digitação.

Registrar por cenário: data, versão, responsável, pré-condições, passos, resultado esperado, observado, evidência e situação aprovado/reprovado/não executado. Em avaliação de uso, registrar tarefas concluídas, tempo, ajuda, erros e percepção de esforço. Critérios propostos devem ser demonstrados a Duda; alterações geram revisão de requisitos sem apagar a versão anterior.

## 6. Contratos financeiros para P2

Estes exemplos resolvem requisitos do produto completo, não ampliam o aceite funcional T1 para exigir o relatório de ganho:

- **CF-01:** B=100, percentual 30%, custo estimado 70, pagamento 50 → ganho estimado 15. Antes da entrega o resultado é igual; entrega não soma novamente.
- **CF-02:** mesmo pagamento 50 no cartão com taxa 2 → ganho estimado após taxa 13; conta reduz em 50.
- **CF-03:** sem custo nem percentual → venda e pagamento registrados, ganho não calculado, sem assumir custo zero.
- **CF-04:** preço/percentual mudam depois da venda → custo e percentual congelados na conta permanecem; mudanças só em novas transações.
- **CF-05:** venda paga de 100 e custo estimado 70, cancelada integralmente → ganho revertido e excedente 100. Converter em crédito e aplicar 60 em nova conta de 100 com custo estimado 80 → ganho destino 12, carteira 40 e entrada nova de dinheiro 0.
- **CF-06:** conta de 100 com custo 70 quitada em 3 pagamentos → ganho acumulado, sem taxa, termina em 30, inclusive após arredondamento de parcelas. Repetição não aumenta total.
- **CF-07:** pagamento estornado ou taxa não devolvida → reverter ganho do principal e conservar despesa de taxa efetivamente não devolvida, registrando ajuste datado.
- **CF-08:** pagar boleto à marca → obrigação quitada sem descontar novamente o custo já usado no ganho.
- **CF-09:** venda de 100 com custo informado 120 paga integralmente → perda de 20 antes de taxas, sem truncar para zero. Cancelar integralmente conta paga zera total e ganho válido sem divisão por zero, mantendo excedente a resolver.

