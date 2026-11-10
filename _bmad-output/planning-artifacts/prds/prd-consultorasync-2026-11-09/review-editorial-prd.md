# Revisão editorial — PRD e primeiro teste

Os documentos orientam Duda e o desenvolvimento do TCC sobre o produto conhecido, o recorte do primeiro teste e os critérios de aceitação. Público humano, Português do Brasil.

Passes executados nesta ordem: estrutura e prosa. Modelos: Estratégico/Contexto para o PRD, com corpo de referência para os requisitos; Tutorial/Guia para o primeiro teste, com cenários consultáveis individualmente. Preservar IDs, exemplos, distinção T1/P2/INV e separação entre confirmações e propostas operacionais.

Contagem pelo script `word_metrics.py`: PRD, **4.582 palavras**; primeiro teste, **2.173 palavras**. Não foi definido limite de extensão. A redação direta e repetível dos requisitos é adequada e não precisa de cortes cosméticos.

| Pass | Original Text | Revised Text | Changes |
|---|---|---|---|
| structure | `prd.md`, §7 “Escopo, limites e evolução”, após o catálogo de 56 requisitos e os NFRs | **MOVE** para depois de §1, mantendo IDs de requisitos e referências estáveis | A diferença entre produto completo e teste prioritário é a principal decisão de leitura. Apresentar os limites antes do catálogo reduz o risco de interpretar P2/INV como compromisso do primeiro teste. Impacto: 0 palavras; apenas reposicionamento. |
| structure | `primeiro-teste.md`, §5 “Contratos financeiros para P2”, 218 palavras, antes da condição de conclusão T1 | **MOVE** para depois da atual §6, como seção final de referência para P2 | Faz o fluxo de leitura T1 terminar em sua condição de conclusão e evidências; os contratos futuros permanecem acessíveis e explicitamente separados. Impacto: 0 palavras; apenas reposicionamento. |
| prose | `prd.md`, §2: “Celular e computador são superfícies completas de atendimento.” | “O atendimento completo deve poder ser realizado pelo celular e pelo computador.” | Substitui “superfícies” por descrição compreensível para Duda, sem alterar a abrangência. |
| prose | `prd.md`, §2: “receber parcelas sem perder o saldo de cada compra” | “registrar pagamentos parciais sem perder o saldo de cada compra” | Evita sugerir parcelamento com prestações e datas previamente combinadas, quando o restante do texto trata pagamentos parciais e vencimento opcional. |
| prose | `prd.md`, FR-016, aceitação: “confirmar encomenda conta itens aguardados, sem tratar isso como entrada física” | “confirmar uma encomenda inclui os itens ainda aguardados no total da conta, sem gerar entrada no estoque físico” | Esclarece o sentido de “conta”, que podia ser lido como verbo de contagem de quantidade ou criação de estoque. |
| prose | `prd.md`, FR-032: “principal dos pagamentos confirmados antes das taxas e após estornos/devoluções” | “valor bruto dos pagamentos confirmados, descontados os estornos e as devoluções, sem deduzir taxas do saldo quitado pelo cliente” | Evita depender do termo financeiro “principal” e deixa explícito o tratamento já definido para a taxa. Não modifica a fórmula D-04. |
| prose | `primeiro-teste.md`, §2: “Se não houver custo nem percentual, manter custo desconhecido; venda e recebimento continuam possíveis” | “Se não houver custo nem percentual, manter custo desconhecido; a venda e o pagamento continuam possíveis” | Usa “pagamento” para dinheiro e preserva “recebimento” como chegada física dos produtos, conforme o vocabulário do PRD. |
| prose | `prd.md`, FR-025: “mostrar preço, presentes, reservados e disponíveis” | “mostrar preço e quantidades presentes, reservadas e disponíveis” | Explicita que se trata de quantidades de produtos, sem depender de substantivos implícitos. |

Resumo: duas recomendações de estrutura e seis ajustes de clareza. Nenhum corte de conteúdo proposto; redução estrutural de **0 palavras (0%)**. Os movimentos preservam os exemplos e critérios de aceitação; não há perda de contexto ou de evidência. Não foram examinadas fórmulas nem criadas políticas nesta revisão editorial.
