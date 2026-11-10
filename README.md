# ConsultoraSync — TCC em Engenharia de Software

Sistema proposto para ajudar revendedoras autônomas de cosméticos a centralizar encomendas e contas de clientes, controlar a pronta-entrega e compreender o ganho associado aos pagamentos, reduzindo o esforço de registro e consulta.

O [briefing de produto](_bmad-output/planning-artifacts/briefs/brief-consultorasync-2026-11-09/brief.md) é a referência atual de escopo. O [complemento](_bmad-output/planning-artifacts/briefs/brief-consultorasync-2026-11-09/addendum.md) reúne regras, pendências e evolução.

## Problema e público

Na rotina relatada por Duda, pedidos ficam dispersos em mensagens, revistas, notas e memória. Quem ajuda no atendimento nem sempre encontra preços e contas; o estoque é contado fisicamente e encomendas ficam misturadas à pronta-entrega.

O foco inicial é Natura, Eudora e O Boticário, com uso pelo celular e computador pela revendedora e por quem ajuda na operação. Tupperware e DeMillus ficam para depois. Os relatos orientam o protótipo; ainda não constituem validação ampla do público.

## Primeiro teste funcional

1. Cadastrar clientes e vincular encomendas à compra feita à marca.
2. Identificar produtos por código de barras na chegada e na venda, com cadastro manual quando necessário.
3. Conferir quantidades recebidas antes de atualizar o estoque.
4. Distinguir produtos disponíveis e reservados para cada cliente.
5. Registrar vendas, entregas, contas separadas por compra e pagamentos parciais por Pix, dinheiro e cartão.

O experimento de celular como leitor pareado ao computador permanece previsto. O celular também deve permitir atendimento completo. Dados externos são sugestões para conferir; o fluxo básico não depende de integração às marcas.

## Necessidades previstas e pontos a validar

Também foram levantados boletos das marcas, visão de valores a receber e a pagar, ganho proporcional aos pagamentos, acessos por função e produtos recorrentes no perfil. A sequência dessas entregas será definida após o teste prioritário.

Fotos e referências de preço, importação de documentos e envio de pedidos às marcas dependem de investigação. Registro de validade precisa ser testado. Para unidades misturadas, o caminho inicial usa custo estimado pelo preço definido e percentual por marca, identificado como estimativa. Sem base de custo, o ganho fica não calculado. Preço de venda externo não comprova custo de compra.

Baixo custo é uma restrição do TCC. Tecnologias, infraestrutura e desempenho serão verificados no planejamento técnico; não há garantia atual de custo zero, cobertura de bases externas ou aplicativo instalado como destino obrigatório.

## Documentação

- [Especificação do primeiro teste](_bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/primeiro-teste.md)
- [PRD completo](_bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/prd.md)
- [Decisões e fórmulas](_bmad-output/planning-artifacts/prds/prd-consultorasync-2026-11-09/decisoes.md)

- [Briefing atual](_bmad-output/planning-artifacts/briefs/brief-consultorasync-2026-11-09/brief.md)
- [Regras e pendências](_bmad-output/planning-artifacts/briefs/brief-consultorasync-2026-11-09/addendum.md)
- [Registro da descoberta](_bmad-output/brainstorming/brainstorm-rotina-revendedoras-2026-11-09/.memlog.md)
- [Análise preparatória](docs/ANALISE_DESCOBERTA_PARA_BRIEFING.md)
- [Plano arquitetural anterior — revisão pendente](docs/PLANO_ARQUITETURAL_E_ROADMAP.md)
- [Histórico de decisões](docs/HISTORICO_CONVERSA_E_DECISOES.md)
- [Proposta original do scanner](artefatos/tcc_projetos_rio_verde_plan.md)

O plano arquitetural e a proposta original do scanner preservam a concepção anterior e devem ser reconciliados com o briefing antes da implementação.
