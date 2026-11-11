import type { FastifyPluginAsync } from 'fastify';
import {
  gerarUuidV7,
  createProblemDetails,
  DomainError,
  EstoqueItem,
  badRequestError
} from '@consultorasync/core';

interface ItemVendaInput {
  produto_id: string;
  quantidade: number;
  entrega_imediata?: boolean;
  preco_unitario_centavos?: number;
}

interface CriarVendaBody {
  cliente_id: string;
  itens: ItemVendaInput[];
  idempotency_key?: string;
  observacoes?: string | null;
}

export const vendasRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/vendas - Venda de Pronta-Entrega com Bloqueio de Concorrência e Reserva Imediata (FR-026, FR-027, AD-3, AD-7, NFR-001, NFR-003)
  fastify.post<{ Body: CriarVendaBody }>(
    '/api/vendas',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { cliente_id, itens, idempotency_key, observacoes } = request.body || {};
      const session = request.session!;

      // 1. Idempotência preventiva (AD-7)
      if (idempotency_key && typeof idempotency_key === 'string' && idempotency_key.trim().length > 0) {
        const registroExistente = await request.tenantPrisma.registroIdempotencia.findFirst({
          where: {
            operacao_id: session.operacaoId,
            chave: idempotency_key.trim()
          }
        });

        if (registroExistente) {
          try {
            const payload = JSON.parse(registroExistente.resposta_json);
            return reply.status(registroExistente.status_code).send(payload);
          } catch {
            // Em caso de falha de parse, segue fluxo
          }
        }
      }

      // 2. Validação da cliente (FR-002, AD-1)
      if (!cliente_id || typeof cliente_id !== 'string' || cliente_id.trim().length === 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Cliente Obrigatória', 'O cliente_id é obrigatório para registrar a venda.')
        );
      }

      const cliente = await request.tenantPrisma.cliente.findUnique({
        where: { id: cliente_id.trim() }
      });

      if (!cliente) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(404, 'CLIENTE_NAO_ENCONTRADA', 'Cliente Não Encontrada', 'A cliente informada não foi encontrada nesta operação.')
        );
      }

      // 3. Validação dos itens
      if (!Array.isArray(itens) || itens.length === 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'ITENS_OBRIGATORIOS', 'Itens Obrigatórios', 'Informe ao menos um produto da pronta-entrega para a venda.')
        );
      }

      // 4. Execução atômica da transação com bloqueio de estoque e concorrência (NFR-001, AD-3, FR-026)
      try {
        const resultado = await (request.tenantPrisma as any).$transaction(async (tx: any) => {
          let valorTotalCentavos = 0;
          const itensProcessados: Array<{
            produtoId: string;
            nomeProduto: string;
            quantidade: number;
            precoUnitarioCentavos: number;
            custoUnitarioCentavos: number | null;
            origemCusto: string;
            statusEntrega: string;
            entregaImediata: boolean;
            estoqueItemId: string;
            presentesAnt: number;
            presentesPos: number;
            reservadosAnt: number;
            reservadosPos: number;
            prontaEntregaAnt: number;
            prontaEntregaPos: number;
          }> = [];

          for (const itemInput of itens) {
            if (!itemInput || typeof itemInput !== 'object' || !itemInput.produto_id) {
              throw badRequestError('Cada item deve conter um produto_id válido.');
            }

            const quantidade = itemInput.quantidade;
            if (!Number.isInteger(quantidade) || quantidade <= 0) {
              throw badRequestError('A quantidade vendida deve ser um número inteiro maior que zero.');
            }

            // Busca produto na mesma operação
            const produto = await tx.produto.findUnique({
              where: { id: itemInput.produto_id.trim() }
            });

            if (!produto) {
              throw new DomainError(
                createProblemDetails(404, 'PRODUTO_NAO_ENCONTRADO', 'Produto Não Encontrado', `O produto informado (${itemInput.produto_id}) não existe nesta operação.`)
              );
            }

            // Busca estoque atual do produto
            const estoqueDb = await tx.estoqueItem.findFirst({
              where: {
                operacao_id: session.operacaoId,
                produto_id: produto.id
              }
            });

            const prontaEntregaAtual = estoqueDb ? estoqueDb.pronta_entrega : 0;
            const presentesAtual = estoqueDb ? estoqueDb.presentes : 0;
            const reservadosAtual = estoqueDb ? estoqueDb.reservados : 0;

            if (!estoqueDb || prontaEntregaAtual < quantidade) {
              throw new DomainError(
                createProblemDetails(
                  400,
                  'ESTOQUE_INSUFICIENTE_PRONTA_ENTREGA',
                  'Estoque Insuficiente',
                  `Você tem apenas ${prontaEntregaAtual} unidade(s) na pronta-entrega que acabou de ser reservada.`
                )
              );
            }

            // Instancia o domínio para aplicar a regra de transição e invariantes
            const itemDomain = new EstoqueItem({
              id: estoqueDb.id,
              operacaoId: session.operacaoId,
              produtoId: produto.id,
              presentes: presentesAtual,
              reservados: reservadosAtual,
              prontaEntrega: prontaEntregaAtual
            });

            const entregaImediata = Boolean(itemInput.entrega_imediata);
            let statusEntrega: string;

            if (entregaImediata) {
              // Entrega imediata: saída física no ato (FR-027, AD-3)
              itemDomain.efetuarSaidaImediata(quantidade);
              statusEntrega = 'ENTREGUE';
            } else {
              // Retirada posterior: reserva imediata sem saída física (FR-026, AD-3)
              itemDomain.reservarProntaEntrega(quantidade);
              statusEntrega = 'RESERVADO_PRESENTE';
            }

            // Atualiza estoque no banco
            await tx.estoqueItem.update({
              where: { id: itemDomain.id },
              data: {
                presentes: itemDomain.presentes,
                reservados: itemDomain.reservados,
                pronta_entrega: itemDomain.prontaEntrega
              }
            });

            // Registra movimentação do estoque com rastreabilidade nominal (NFR-003)
            await tx.movimentacaoEstoque.create({
              data: {
                id: gerarUuidV7(),
                operacao_id: session.operacaoId,
                produto_id: produto.id,
                estoque_item_id: itemDomain.id,
                tipo: entregaImediata ? 'SAIDA_VENDA' : 'RESERVA',
                quantidade,
                presentes_anterior: presentesAtual,
                presentes_posterior: itemDomain.presentes,
                reservados_anterior: reservadosAtual,
                reservados_posterior: itemDomain.reservados,
                pronta_entrega_anterior: prontaEntregaAtual,
                pronta_entrega_posterior: itemDomain.prontaEntrega,
                operador_id: session.operadorId,
                operador_nome: session.operadorNome,
                detalhes: entregaImediata
                  ? `Venda com entrega imediata para cliente ${cliente.nome}: ${quantidade} unidade(s)`
                  : `Venda de pronta-entrega com reserva nominal para cliente ${cliente.nome}: ${quantidade} unidade(s)`
              }
            });

            const precoUnitario = itemInput.preco_unitario_centavos && itemInput.preco_unitario_centavos > 0
              ? itemInput.preco_unitario_centavos
              : produto.preco_venda_centavos;

            const custoUnitario = produto.custo_centavos ?? null;
            const origemCusto = produto.proveniencia_custo ?? 'DESCONHECIDO';

            valorTotalCentavos += quantidade * precoUnitario;

            itensProcessados.push({
              produtoId: produto.id,
              nomeProduto: produto.nome,
              quantidade,
              precoUnitarioCentavos: precoUnitario,
              custoUnitarioCentavos: custoUnitario,
              origemCusto,
              statusEntrega,
              entregaImediata,
              estoqueItemId: itemDomain.id,
              presentesAnt: presentesAtual,
              presentesPos: itemDomain.presentes,
              reservadosAnt: reservadosAtual,
              reservadosPos: itemDomain.reservados,
              prontaEntregaAnt: prontaEntregaAtual,
              prontaEntregaPos: itemDomain.prontaEntrega
            });
          }

          // Criação da Conta da Cliente
          const contaId = gerarUuidV7();
          const conta = await tx.conta.create({
            data: {
              id: contaId,
              operacao_id: session.operacaoId,
              cliente_id: cliente.id,
              encomenda_id: null,
              valor_total: valorTotalCentavos,
              total_pago: 0,
              status: 'ABERTA'
            }
          });

          // Criação dos itens da conta
          const itensCriados = [];
          for (const itemProc of itensProcessados) {
            const itemContaId = gerarUuidV7();
            const itemConta = await tx.itemConta.create({
              data: {
                id: itemContaId,
                operacao_id: session.operacaoId,
                conta_id: contaId,
                encomenda_id: null,
                produto_id: itemProc.produtoId,
                quantidade: itemProc.quantidade,
                preco_unitario_centavos: itemProc.precoUnitarioCentavos,
                custo_unitario_centavos: itemProc.custoUnitarioCentavos,
                origem_custo: itemProc.origemCusto,
                status_entrega: itemProc.statusEntrega
              }
            });

            itensCriados.push({
              ...itemConta,
              nome_produto: itemProc.nomeProduto
            });
          }

          // Auditoria de transação (NFR-003)
          await tx.registroAuditoria.create({
            data: {
              id: gerarUuidV7(),
              operacao_id: session.operacaoId,
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              acao: 'CRIACAO_VENDA',
              detalhes: JSON.stringify({
                conta_id: contaId,
                cliente_id: cliente.id,
                cliente_nome: cliente.nome,
                valor_total: valorTotalCentavos,
                observacoes: observacoes ?? null,
                itens: itensCriados.map((it) => ({
                  id: it.id,
                  produto_id: it.produto_id,
                  quantidade: it.quantidade,
                  preco_unitario_centavos: it.preco_unitario_centavos,
                  status_entrega: it.status_entrega
                }))
              })
            }
          });

          const payloadRetorno = {
            conta: {
              ...conta,
              cliente_nome: cliente.nome,
              itens: itensCriados
            },
            itens_processados: itensProcessados
          };

          // Salva registro de idempotência se solicitado (AD-7)
          if (idempotency_key && typeof idempotency_key === 'string' && idempotency_key.trim().length > 0) {
            await tx.registroIdempotencia.create({
              data: {
                id: gerarUuidV7(),
                operacao_id: session.operacaoId,
                chave: idempotency_key.trim(),
                recurso: 'CRIAR_VENDA',
                resposta_json: JSON.stringify(payloadRetorno),
                status_code: 201
              }
            });
          }

          return payloadRetorno;
        });

        return reply.status(201).send(resultado);
      } catch (err: any) {
        if (err instanceof DomainError) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Erro ao Processar Venda', err.message || 'Erro inesperado na venda.')
        );
      }
    }
  );

  // GET /api/vendas - Listagem de contas/vendas da operação com itens
  fastify.get(
    '/api/vendas',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const session = request.session!;

      const contas = await request.tenantPrisma.conta.findMany({
        where: {
          operacao_id: session.operacaoId
        },
        include: {
          cliente: {
            select: { id: true, nome: true, telefone: true }
          },
          itens: {
            include: {
              produto: {
                select: { id: true, nome: true, variante: true, codigo_barras: true }
              }
            }
          }
        },
        orderBy: { criado_em: 'desc' }
      });

      return reply.send(contas);
    }
  );
};
