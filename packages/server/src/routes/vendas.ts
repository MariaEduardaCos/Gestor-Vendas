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

      const contasComStatus = contas.map((c: any) => ({
        ...c,
        status_entrega: calcularStatusEntregaConta(c.itens)
      }));

      return reply.send(contasComStatus);
    }
  );


  // POST /api/contas/:id/itens/:itemId/entregar - Confirmação de entrega física de item individual (FR-027, FR-028, FR-031, AD-3, NFR-001)
  fastify.post<{ Params: { id: string; itemId: string } }>(
    '/api/contas/:id/itens/:itemId/entregar',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id, itemId } = request.params;
      const session = request.session!;

      try {
        const resultado = await (request.tenantPrisma as any).$transaction(async (tx: any) => {
          // Busca o item da conta garantindo isolamento da operação
          const itemConta = await tx.itemConta.findFirst({
            where: {
              id: itemId.trim(),
              conta_id: id.trim(),
              operacao_id: session.operacaoId
            },
            include: {
              produto: true,
              conta: {
                include: { cliente: true }
              }
            }
          });

          if (!itemConta) {
            throw new DomainError(
              createProblemDetails(404, 'ITEM_NAO_ENCONTRADO', 'Item Não Encontrado', 'O item informado não foi encontrado nesta conta.')
            );
          }

          if (itemConta.status_entrega === 'ENTREGUE') {
            throw new DomainError(
              createProblemDetails(400, 'ITEM_JA_ENTREGUE', 'Item Já Entregue', 'Este produto já teve sua entrega física confirmada anteriormente.')
            );
          }

          if (itemConta.status_entrega === 'AGUARDANDO_FABRICA') {
            throw new DomainError(
              createProblemDetails(
                400,
                'ITEM_NAO_DISPONIVEL_PARA_ENTREGA',
                'Item Não Disponível para Entrega',
                'Este item ainda está aguardando a chegada da fábrica e não pode ser entregue fisicamente.'
              )
            );
          }

          if (itemConta.status_entrega !== 'RESERVADO_PRESENTE') {
            throw badRequestError(`Status de entrega "${itemConta.status_entrega}" não permite confirmação de entrega.`);
          }

          // Busca e atualiza o estoque físico com baixa estrita apenas na entrega (AD-3)
          const estoqueDb = await tx.estoqueItem.findFirst({
            where: {
              operacao_id: session.operacaoId,
              produto_id: itemConta.produto_id
            }
          });

          if (!estoqueDb) {
            throw badRequestError('Registro de estoque não encontrado para o produto.');
          }

          const itemEstoqueDomain = new EstoqueItem({
            id: estoqueDb.id,
            operacaoId: session.operacaoId,
            produtoId: itemConta.produto_id,
            presentes: estoqueDb.presentes,
            reservados: estoqueDb.reservados,
            prontaEntrega: estoqueDb.pronta_entrega
          });

          // Baixa física no armário: presentes -= qtd, reservados -= qtd, pronta_entrega inalterado
          itemEstoqueDomain.confirmarEntregaFisica(itemConta.quantidade);

          await tx.estoqueItem.update({
            where: { id: itemEstoqueDomain.id },
            data: {
              presentes: itemEstoqueDomain.presentes,
              reservados: itemEstoqueDomain.reservados,
              pronta_entrega: itemEstoqueDomain.prontaEntrega
            }
          });

          // Registra movimentação de saída por venda
          await tx.movimentacaoEstoque.create({
            data: {
              id: gerarUuidV7(),
              operacao_id: session.operacaoId,
              produto_id: itemConta.produto_id,
              estoque_item_id: itemEstoqueDomain.id,
              tipo: 'SAIDA_VENDA',
              quantidade: itemConta.quantidade,
              presentes_anterior: estoqueDb.presentes,
              presentes_posterior: itemEstoqueDomain.presentes,
              reservados_anterior: estoqueDb.reservados,
              reservados_posterior: itemEstoqueDomain.reservados,
              pronta_entrega_anterior: estoqueDb.pronta_entrega,
              pronta_entrega_posterior: itemEstoqueDomain.prontaEntrega,
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              detalhes: `Entrega física confirmada para cliente ${itemConta.conta.cliente.nome}: ${itemConta.quantidade} unidade(s)`
            }
          });

          // Atualiza status do item para ENTREGUE
          const itemAtualizado = await tx.itemConta.update({
            where: { id: itemConta.id },
            data: {
              status_entrega: 'ENTREGUE'
            }
          });

          // Registra auditoria da entrega
          await tx.registroAuditoria.create({
            data: {
              id: gerarUuidV7(),
              operacao_id: session.operacaoId,
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              acao: 'CONFIRMACAO_ENTREGA_ITEM',
              detalhes: JSON.stringify({
                conta_id: id,
                item_conta_id: itemId,
                produto_id: itemConta.produto_id,
                quantidade: itemConta.quantidade,
                cliente_id: itemConta.conta.cliente_id
              })
            }
          });

          // Carrega todos os itens da conta para calcular novo status consolidado
          const todosItens = await tx.itemConta.findMany({
            where: { conta_id: id, operacao_id: session.operacaoId }
          });

          const statusConsolidado = calcularStatusEntregaConta(todosItens);

          return {
            mensagem: 'Entrega física do item confirmada com sucesso.',
            item: itemAtualizado,
            status_entrega_conta: statusConsolidado,
            estoque_atualizado: {
              presentes: itemEstoqueDomain.presentes,
              reservados: itemEstoqueDomain.reservados,
              pronta_entrega: itemEstoqueDomain.prontaEntrega
            }
          };
        });

        return reply.status(200).send(resultado);
      } catch (err: any) {
        if (err instanceof DomainError) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Erro ao Confirmar Entrega', err.message || 'Erro inesperado.')
        );
      }
    }
  );

  // POST /api/contas/:id/entregar-tudo - Entrega de todos os itens disponíveis da conta (FR-027, FR-028, AD-3)
  fastify.post<{ Params: { id: string } }>(
    '/api/contas/:id/entregar-tudo',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const session = request.session!;

      try {
        const resultado = await (request.tenantPrisma as any).$transaction(async (tx: any) => {
          const conta = await tx.conta.findFirst({
            where: { id: id.trim(), operacao_id: session.operacaoId },
            include: {
              cliente: true,
              itens: { include: { produto: true } }
            }
          });

          if (!conta) {
            throw new DomainError(
              createProblemDetails(404, 'CONTA_NAO_ENCONTRADA', 'Conta Não Encontrada', 'A conta informada não foi encontrada nesta operação.')
            );
          }

          const itensReservados = conta.itens.filter((it: any) => it.status_entrega === 'RESERVADO_PRESENTE');

          if (itensReservados.length === 0) {
            const todosEntregues = conta.itens.every((it: any) => it.status_entrega === 'ENTREGUE');
            if (todosEntregues) {
              throw new DomainError(
                createProblemDetails(400, 'NENHUM_ITEM_PENDENTE_ENTREGA', 'Itens Já Entregues', 'Todos os itens disponíveis desta conta já foram entregues.')
              );
            }
            throw new DomainError(
              createProblemDetails(400, 'NENHUM_ITEM_DISPONIVEL', 'Nenhum Item Disponível', 'Não há itens com reserva presente disponíveis para entrega nesta conta.')
            );
          }

          const itensEntregues = [];

          for (const itemConta of itensReservados) {
            const estoqueDb = await tx.estoqueItem.findFirst({
              where: {
                operacao_id: session.operacaoId,
                produto_id: itemConta.produto_id
              }
            });

            if (!estoqueDb) {
              throw badRequestError(`Estoque não localizado para produto ${itemConta.produto.nome}`);
            }

            const itemEstoqueDomain = new EstoqueItem({
              id: estoqueDb.id,
              operacaoId: session.operacaoId,
              produtoId: itemConta.produto_id,
              presentes: estoqueDb.presentes,
              reservados: estoqueDb.reservados,
              prontaEntrega: estoqueDb.pronta_entrega
            });

            itemEstoqueDomain.confirmarEntregaFisica(itemConta.quantidade);

            await tx.estoqueItem.update({
              where: { id: itemEstoqueDomain.id },
              data: {
                presentes: itemEstoqueDomain.presentes,
                reservados: itemEstoqueDomain.reservados,
                pronta_entrega: itemEstoqueDomain.prontaEntrega
              }
            });

            await tx.movimentacaoEstoque.create({
              data: {
                id: gerarUuidV7(),
                operacao_id: session.operacaoId,
                produto_id: itemConta.produto_id,
                estoque_item_id: itemEstoqueDomain.id,
                tipo: 'SAIDA_VENDA',
                quantidade: itemConta.quantidade,
                presentes_anterior: estoqueDb.presentes,
                presentes_posterior: itemEstoqueDomain.presentes,
                reservados_anterior: estoqueDb.reservados,
                reservados_posterior: itemEstoqueDomain.reservados,
                pronta_entrega_anterior: estoqueDb.pronta_entrega,
                pronta_entrega_posterior: itemEstoqueDomain.prontaEntrega,
                operador_id: session.operadorId,
                operador_nome: session.operadorNome,
                detalhes: `Entrega física em lote para cliente ${conta.cliente.nome}: ${itemConta.quantidade} unidade(s) de ${itemConta.produto.nome}`
              }
            });

            const itAtualizado = await tx.itemConta.update({
              where: { id: itemConta.id },
              data: { status_entrega: 'ENTREGUE' }
            });

            itensEntregues.push(itAtualizado);
          }

          await tx.registroAuditoria.create({
            data: {
              id: gerarUuidV7(),
              operacao_id: session.operacaoId,
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              acao: 'CONFIRMACAO_ENTREGA_TOTAL',
              detalhes: JSON.stringify({
                conta_id: id,
                cliente_id: conta.cliente_id,
                quantidade_itens_entregues: itensEntregues.length
              })
            }
          });

          const todosItensAtualizados = await tx.itemConta.findMany({
            where: { conta_id: id, operacao_id: session.operacaoId }
          });

          const statusConsolidado = calcularStatusEntregaConta(todosItensAtualizados);

          return {
            mensagem: `${itensEntregues.length} item(ns) entregue(s) com sucesso.`,
            itens_entregues: itensEntregues,
            status_entrega_conta: statusConsolidado
          };
        });

        return reply.status(200).send(resultado);
      } catch (err: any) {
        if (err instanceof DomainError) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Erro ao Confirmar Entregas', err.message || 'Erro inesperado.')
        );
      }
    }
  );

  // POST /api/contas/:id/itens/:itemId/cancelar - Cancelamento de item não entregue com liberação de reserva para pronta-entrega (FR-029, D-09, AD-3, NFR-001, NFR-003)
  fastify.post<{ Params: { id: string; itemId: string }; Body: { motivo: string } }>(
    '/api/contas/:id/itens/:itemId/cancelar',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id, itemId } = request.params;
      const { motivo } = request.body || {};
      const session = request.session!;

      if (!motivo || typeof motivo !== 'string' || motivo.trim().length === 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'MOTIVO_OBRIGATORIO', 'Motivo Obrigatório', 'Informe o motivo do cancelamento do item.')
        );
      }

      try {
        const resultado = await (request.tenantPrisma as any).$transaction(async (tx: any) => {
          const itemConta = await tx.itemConta.findFirst({
            where: {
              id: itemId.trim(),
              conta_id: id.trim(),
              operacao_id: session.operacaoId
            },
            include: {
              produto: true,
              conta: {
                include: { cliente: true }
              }
            }
          });

          if (!itemConta) {
            throw new DomainError(
              createProblemDetails(404, 'ITEM_NAO_ENCONTRADO', 'Item Não Encontrado', 'O item informado não foi encontrado nesta conta.')
            );
          }

          if (itemConta.status_entrega === 'ENTREGUE') {
            throw new DomainError(
              createProblemDetails(400, 'ITEM_JA_ENTREGUE', 'Item Já Entregue', 'Produtos já entregues fisicamente ao cliente não podem ser cancelados por esta via.')
            );
          }

          if (itemConta.status_entrega === 'CANCELADO') {
            throw new DomainError(
              createProblemDetails(400, 'ITEM_JA_CANCELADO', 'Item Já Cancelado', 'Este item já foi cancelado anteriormente.')
            );
          }

          // Se estava reservado na estante/armário, libera a reserva de volta para a pronta-entrega (AD-3, FR-029)
          if (itemConta.status_entrega === 'RESERVADO_PRESENTE') {
            const estoqueDb = await tx.estoqueItem.findFirst({
              where: {
                operacao_id: session.operacaoId,
                produto_id: itemConta.produto_id
              }
            });

            if (!estoqueDb) {
              throw badRequestError('Registro de estoque não encontrado para o produto.');
            }

            const itemEstoqueDomain = new EstoqueItem({
              id: estoqueDb.id,
              operacaoId: session.operacaoId,
              produtoId: itemConta.produto_id,
              presentes: estoqueDb.presentes,
              reservados: estoqueDb.reservados,
              prontaEntrega: estoqueDb.pronta_entrega
            });

            // Liberação de reserva: reservados -= qtd, pronta_entrega += qtd, presentes inalterado!
            itemEstoqueDomain.cancelarReserva(itemConta.quantidade);

            await tx.estoqueItem.update({
              where: { id: itemEstoqueDomain.id },
              data: {
                presentes: itemEstoqueDomain.presentes,
                reservados: itemEstoqueDomain.reservados,
                pronta_entrega: itemEstoqueDomain.prontaEntrega
              }
            });

            await tx.movimentacaoEstoque.create({
              data: {
                id: gerarUuidV7(),
                operacao_id: session.operacaoId,
                produto_id: itemConta.produto_id,
                estoque_item_id: itemEstoqueDomain.id,
                tipo: 'CANCELAMENTO_RESERVA',
                quantidade: itemConta.quantidade,
                presentes_anterior: estoqueDb.presentes,
                presentes_posterior: itemEstoqueDomain.presentes,
                reservados_anterior: estoqueDb.reservados,
                reservados_posterior: itemEstoqueDomain.reservados,
                pronta_entrega_anterior: estoqueDb.pronta_entrega,
                pronta_entrega_posterior: itemEstoqueDomain.prontaEntrega,
                operador_id: session.operadorId,
                operador_nome: session.operadorNome,
                detalhes: `Cancelamento de item por desistência da cliente: ${motivo.trim()}`
              }
            });
          }

          // Atualiza status do item para CANCELADO
          const itemAtualizado = await tx.itemConta.update({
            where: { id: itemConta.id },
            data: { status_entrega: 'CANCELADO' }
          });

          // Recalcula o valor total da conta sem o item cancelado
          const itensAtivos = await tx.itemConta.findMany({
            where: {
              conta_id: id.trim(),
              operacao_id: session.operacaoId,
              status_entrega: { not: 'CANCELADO' }
            }
          });

          const novoValorTotal = itensAtivos.reduce(
            (acc: number, cur: any) => acc + cur.quantidade * cur.preco_unitario_centavos,
            0
          );

          let novoStatusConta = itemConta.conta.status;
          if (novoValorTotal === 0 && itemConta.conta.total_pago === 0) {
            novoStatusConta = 'CANCELADA';
          } else if (itemConta.conta.total_pago >= novoValorTotal && novoValorTotal > 0) {
            novoStatusConta = 'QUITADA';
          }

          const contaAtualizada = await tx.conta.update({
            where: { id: id.trim() },
            data: {
              valor_total: novoValorTotal,
              status: novoStatusConta
            }
          });

          // Se houver excedente contábil pago pela cliente (total_pago > novoValorTotal), emite obrigação contábil
          let excedenteCentavos = 0;
          if (itemConta.conta.total_pago > novoValorTotal) {
            excedenteCentavos = itemConta.conta.total_pago - novoValorTotal;

            await tx.excedentePendente.create({
              data: {
                id: gerarUuidV7(),
                operacao_id: session.operacaoId,
                conta_id: id,
                cliente_id: itemConta.conta.cliente_id,
                valor_centavos: excedenteCentavos,
                origem: 'CANCELAMENTO_ITEM',
                status: 'PENDENTE',
                operador_id: session.operadorId,
                operador_nome: session.operadorNome,
                criado_em: new Date()
              }
            });

            await tx.registroAuditoria.create({
              data: {
                id: gerarUuidV7(),
                operacao_id: session.operacaoId,
                operador_id: session.operadorId,
                operador_nome: session.operadorNome,
                acao: 'OBRIGACAO_CONTABIL_EXCEDENTE_CANCELAMENTO',
                detalhes: JSON.stringify({
                  conta_id: id,
                  cliente_id: itemConta.conta.cliente_id,
                  cliente_nome: itemConta.conta.cliente.nome,
                  excedente_centavos: excedenteCentavos,
                  motivo: motivo.trim()
                })
              }
            });
          }

          // Auditoria nominal do cancelamento (NFR-003)
          await tx.registroAuditoria.create({
            data: {
              id: gerarUuidV7(),
              operacao_id: session.operacaoId,
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              acao: 'CANCELAMENTO_ITEM_CONTA',
              detalhes: JSON.stringify({
                conta_id: id,
                item_conta_id: itemId,
                produto_id: itemConta.produto_id,
                quantidade: itemConta.quantidade,
                motivo: motivo.trim(),
                novo_valor_total_conta: novoValorTotal,
                excedente_gerado: excedenteCentavos
              })
            }
          });

          return {
            mensagem: 'Item cancelado com sucesso e reserva física liberada para pronta-entrega.',
            item: itemAtualizado,
            conta: contaAtualizada,
            excedente_gerado_centavos: excedenteCentavos
          };
        });

        return reply.status(200).send(resultado);
      } catch (err: any) {
        if (err instanceof DomainError) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Erro ao Cancelar Item', err.message || 'Erro inesperado.')
        );
      }
    }
  );
};

export function calcularStatusEntregaConta(itens: Array<{ status_entrega: string }>): string {
  const itensAtivos = itens.filter((i) => i.status_entrega !== 'CANCELADO');
  if (itensAtivos.length === 0) return 'SEM_ITENS';

  const todosEntregues = itensAtivos.every((i) => i.status_entrega === 'ENTREGUE');
  if (todosEntregues) return 'ENTREGUE';

  const algumEntregue = itensAtivos.some((i) => i.status_entrega === 'ENTREGUE');
  const algumPendente = itensAtivos.some(
    (i) => i.status_entrega === 'AGUARDANDO_FABRICA' || i.status_entrega === 'RESERVADO_PRESENTE'
  );

  if (algumEntregue && algumPendente) return 'PARCIALMENTE_ENTREGUE';

  const todosAguardandoFabrica = itensAtivos.every((i) => i.status_entrega === 'AGUARDANDO_FABRICA');
  if (todosAguardandoFabrica) return 'AGUARDANDO_FABRICA';

  const algumReservado = itensAtivos.some((i) => i.status_entrega === 'RESERVADO_PRESENTE');
  if (algumReservado) return 'DISPONIVEL_RETIRADA';

  return 'PENDENTE';
}

