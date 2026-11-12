# Especificação da Story 5.1: Saldo Individual por Conta e Projeção da "Visão Sem Itens Aguardados"

**Story ID:** 5.1  
**Épico:** 5 - Gestão de Contas, Cobrança Transparente, Pagamentos e Resolução de Excedentes  
**Status:** In-Progress  
**Data:** 11 de Novembro de 2026  
**Requisitos Cobertos:** FR-032, FR-033, AD-4, UX-DR6, NFR-001, NFR-003, NFR-006, NFR-010  

---

## 1. Contexto e Motivação
Na revenda porta-a-porta, uma cliente pode comprar pronta-entrega e fazer encomendas de ciclos diferentes, resultando em múltiplas contas ativas. Misturar os saldos dessas contas gera desconfiança e descontrole contábil.
Além disso, quando uma cliente encomenda vários produtos e a fábrica entrega apenas parte do pedido, a cliente frequentemente deseja retirar e pagar apenas os produtos que já chegaram, deixando os itens em aberto para quando a fábrica entregar.
A **Story 5.1** implementa:
1. **Extrato e Saldo Individual por Conta (FR-032, AD-4):** Cada conta preserva seu próprio valor total, total pago e saldo devedor individual, sendo proibido consolidar ou transferir débitos sem autorização explícita.
2. **Projeção da "Visão Sem Itens Aguardados" (FR-033, AD-4, UX-DR6):** Um toggle interativo na interface da conta que projeta em tempo de execução:
   - `total_sem_aguardados_centavos`: soma dos subtotais dos itens com status diferente de `AGUARDANDO_FABRICA` e `CANCELADO` (ou seja, `RESERVADO_PRESENTE` e `ENTREGUE`).
   - `saldo_cobravel_hoje_centavos`: $\max(0, \text{total\_sem\_aguardados\_centavos} - \text{total\_pago\_centavos})$.
   - Não cria uma nova conta no banco de dados, preservando a imutabilidade do compromisso original e informando a revendedora e a cliente de forma acolhedora.

---

## 2. Critérios de Aceitação Detalhados
- **AC 5.1.1 (Saldos Isolados por Conta):**
  - Dada uma cliente com duas contas (ex: R$ 100,00 e R$ 80,00), a consulta das contas da cliente retorna cada registro individualmente com seus valores e status independentes.
- **AC 5.1.2 (Projeção "Apenas o que Já Chegou"):**
  - Em uma conta de R$ 150,00 contendo R$ 100,00 em itens presentes/entregues e R$ 50,00 aguardando fábrica:
    - O valor total da conta permanece R$ 150,00.
    - Se a cliente já pagou R$ 30,00, o saldo devedor total é R$ 120,00.
    - O valor cobrável hoje sem aguardados é projetado como: R$ 100,00 - R$ 30,00 = R$ 70,00.
    - Se a cliente já tiver pago R$ 110,00, o saldo cobrável hoje é R$ 0,00 (não negativado).
- **AC 5.1.3 (Toggle no Frontend com Texto Acolhedor UX-DR6):**
  - Na ficha da cliente, ao alternar para "Apenas o que Já Chegou", a interface exibe badge explicativa: *"Cobrança Justa: Considerando apenas R$ X,XX em produtos disponíveis ou entregues"*.

---

## 3. Endpoints da API
- `GET /api/contas/:id`: retorna os detalhes da conta, seus itens, status da entrega consolidado e campos projetados:
  - `valor_total_centavos`
  - `total_pago_centavos`
  - `saldo_devedor_centavos`
  - `total_sem_aguardados_centavos`
  - `saldo_cobravel_hoje_centavos`
  - `itens_aguardando_count`
  - `itens_presentes_count`
- `GET /api/clientes/:id/contas`: lista todas as contas da cliente com as mesmas projeções em tempo de execução.
