import type { FastifyPluginAsync } from 'fastify';
import {
  EstoqueItem,
  MovimentacaoEstoque,
  gerarUuidV7,
  createProblemDetails
} from '@consultorasync/core';

interface EstoqueInicialBody {
  produto_id: string;
  quantidade: number;
  observacao?: string;
}

export const estoqueRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/estoque/inicial - Lançamento de contagem física inicial por produto
  fastify.post<{ Body: EstoqueInicialBody }>(
    '/api/estoque/inicial',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { produto_id, quantidade, observacao } = request.body || {};
      const session = request.session!;

      if (!produto_id || typeof produto_id !== 'string' || produto_id.trim() === '') {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'BAD_REQUEST',
            'Dados Inválidos',
            'O produto_id é obrigatório para lançar o estoque inicial.'
          )
        );
      }

      // Validação estrita de quantidade inteira não negativa (NFR-001)
      if (
        quantidade === undefined ||
        quantidade === null ||
        typeof quantidade !== 'number' ||
        !Number.isInteger(quantidade) ||
        quantidade < 0
      ) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'BAD_REQUEST',
            'Quantidade Inválida',
            'A quantidade inicial de estoque deve ser um número inteiro não negativo (ex: 0, 1, 5).'
          )
        );
      }

      // Busca produto garantindo isolamento multi-inquilino (AD-1)
      const produto = await request.tenantPrisma.produto.findUnique({
        where: { id: produto_id.trim() }
      });

      if (!produto) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Produto Não Encontrado',
            'O produto informado não foi encontrado ou não pertence a esta operação.'
          )
        );
      }

      const estoqueExistente = await request.tenantPrisma.estoqueItem.findFirst({
        where: { produto_id: produto.id }
      });

      // Não permite redefinir contagem inicial se houver reservas ativas
      if (estoqueExistente && estoqueExistente.reservados > 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'BAD_REQUEST',
            'Operação Não Permitida',
            'Não é permitido redefinir contagem inicial com reservas ativas.'
          )
        );
      }

      let itemDomain: EstoqueItem;
      let presentesAnt = 0;
      let reservadosAnt = 0;
      let prontaEntregaAnt = 0;

      try {
        if (estoqueExistente) {
          presentesAnt = estoqueExistente.presentes;
          reservadosAnt = estoqueExistente.reservados;
          prontaEntregaAnt = estoqueExistente.pronta_entrega;

          itemDomain = new EstoqueItem({
            id: estoqueExistente.id,
            operacaoId: session.operacaoId,
            produtoId: produto.id,
            presentes: estoqueExistente.presentes,
            reservados: estoqueExistente.reservados,
            prontaEntrega: estoqueExistente.pronta_entrega,
            criadoEm: estoqueExistente.criado_em.toISOString(),
            atualizadoEm: estoqueExistente.atualizado_em.toISOString()
          });
          itemDomain.lancarEstoqueInicial(quantidade);
        } else {
          itemDomain = EstoqueItem.criarInicial({
            id: gerarUuidV7(),
            operacaoId: session.operacaoId,
            produtoId: produto.id,
            quantidade
          });
        }
      } catch (err: any) {
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Erro de Domínio', err.message || 'Erro ao calcular estoque.')
        );
      }

      // Cria a movimentação de domínio assegurando compraId = null e operador nominal (FR-013, NFR-003)
      let movDomain: MovimentacaoEstoque;
      try {
        movDomain = new MovimentacaoEstoque({
          id: gerarUuidV7(),
          operacaoId: session.operacaoId,
          produtoId: produto.id,
          estoqueItemId: itemDomain.id,
          tipo: 'ESTOQUE_INICIAL',
          quantidade,
          presentesAnterior: presentesAnt,
          presentesPosterior: itemDomain.presentes,
          reservadosAnterior: reservadosAnt,
          reservadosPosterior: itemDomain.reservados,
          prontaEntregaAnterior: prontaEntregaAnt,
          prontaEntregaPosterior: itemDomain.prontaEntrega,
          compraId: null,
          operadorId: session.operadorId,
          operadorNome: session.operadorNome,
          detalhes: observacao?.trim() || `Lançamento inicial de estoque: ${quantidade} unidade(s) físicas na estante`
        });
      } catch (err: any) {
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Erro de Movimentação', err.message || 'Erro ao registrar movimentação.')
        );
      }

      // Persistência atômica via transação com proteção da invariante
      const { estoquePersistido, movPersistida } = await (request.tenantPrisma as any).$transaction(
        async (tx: any) => {
          let ep;
          if (estoqueExistente) {
            ep = await tx.estoqueItem.update({
              where: { id: itemDomain.id },
              data: {
                presentes: itemDomain.presentes,
                reservados: itemDomain.reservados,
                pronta_entrega: itemDomain.prontaEntrega,
                atualizado_em: new Date(itemDomain.atualizadoEm)
              }
            });
          } else {
            ep = await tx.estoqueItem.create({
              data: {
                id: itemDomain.id,
                operacao_id: session.operacaoId,
                produto_id: produto.id,
                presentes: itemDomain.presentes,
                reservados: itemDomain.reservados,
                pronta_entrega: itemDomain.prontaEntrega,
                criado_em: new Date(itemDomain.criadoEm),
                atualizado_em: new Date(itemDomain.atualizadoEm)
              }
            });
          }

          const mp = await tx.movimentacaoEstoque.create({
            data: {
              id: movDomain.id,
              operacao_id: session.operacaoId,
              produto_id: produto.id,
              estoque_item_id: itemDomain.id,
              tipo: movDomain.tipo,
              quantidade: movDomain.quantidade,
              presentes_anterior: movDomain.presentesAnterior,
              presentes_posterior: movDomain.presentesPosterior,
              reservados_anterior: movDomain.reservadosAnterior,
              reservados_posterior: movDomain.reservadosPosterior,
              pronta_entrega_anterior: movDomain.prontaEntregaAnterior,
              pronta_entrega_posterior: movDomain.prontaEntregaPosterior,
              compra_id: null,
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              detalhes: movDomain.detalhes,
              criado_em: new Date(movDomain.criadoEm)
            }
          });

          // Auditoria nominal com operador e timestamp UTC (NFR-003)
          await tx.registroAuditoria.create({
            data: {
              id: gerarUuidV7(),
              operacao_id: session.operacaoId,
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              acao: 'LANCAR_ESTOQUE_INICIAL',
              detalhes: `Estoque inicial: ${produto.nome} definido para ${quantidade} unidades (${quantidade} presentes, ${quantidade} pronta-entrega, 0 reservadas).`,
              criado_em: new Date()
            }
          });

          return { estoquePersistido: ep, movPersistida: mp };
        }
      );

      return reply.status(200).send({
        id: estoquePersistido.id,
        operacao_id: estoquePersistido.operacao_id,
        produto_id: estoquePersistido.produto_id,
        presentes: estoquePersistido.presentes,
        reservados: estoquePersistido.reservados,
        pronta_entrega: estoquePersistido.pronta_entrega,
        criado_em: estoquePersistido.criado_em.toISOString(),
        atualizado_em: estoquePersistido.atualizado_em.toISOString(),
        movimentacao: {
          id: movPersistida.id,
          tipo: movPersistida.tipo,
          quantidade: movPersistida.quantidade,
          presentes_anterior: movPersistida.presentes_anterior,
          presentes_posterior: movPersistida.presentes_posterior,
          reservados_anterior: movPersistida.reservados_anterior,
          reservados_posterior: movPersistida.reservados_posterior,
          pronta_entrega_anterior: movPersistida.pronta_entrega_anterior,
          pronta_entrega_posterior: movPersistida.pronta_entrega_posterior,
          compra_id: movPersistida.compra_id,
          operador_id: movPersistida.operador_id,
          operador_nome: movPersistida.operador_nome,
          detalhes: movPersistida.detalhes,
          criado_em: movPersistida.criado_em.toISOString()
        }
      });
    }
  );

  // POST /api/estoque/:produtoId/ajuste - Ajuste Justificado de Inventário com Trava de Segurança (FR-030, Refinamento Elicitação, AD-3, NFR-001, NFR-003)
  fastify.post<{ Params: { produtoId: string }; Body: { nova_contagem_presentes: number; justificativa: string } }>(
    '/api/estoque/:produtoId/ajuste',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { produtoId } = request.params;
      const { nova_contagem_presentes, justificativa } = request.body || {};
      const session = request.session!;

      if (!Number.isInteger(nova_contagem_presentes) || nova_contagem_presentes < 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'CONTAGEM_INVALIDA', 'Contagem Inválida', 'A nova contagem física deve ser um número inteiro maior ou igual a zero.')
        );
      }

      if (!justificativa || typeof justificativa !== 'string' || justificativa.trim().length === 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'JUSTIFICATIVA_OBRIGATORIA', 'Justificativa Obrigatória', 'Informe a justificativa do ajuste de inventário.')
        );
      }

      const produto = await request.tenantPrisma.produto.findUnique({
        where: { id: produtoId.trim() }
      });

      if (!produto) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(404, 'PRODUTO_NAO_ENCONTRADO', 'Produto Não Encontrado', 'O produto informado não existe nesta operação.')
        );
      }

      const estoqueExistente = await request.tenantPrisma.estoqueItem.findFirst({
        where: { produto_id: produto.id }
      });

      if (!estoqueExistente) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'ESTOQUE_INEXISTENTE', 'Estoque Inexistente', 'Este produto ainda não possui registro de estoque inicial.')
        );
      }

      // Trava de segurança impeditiva (FR-030, AD-3): Bloqueia redução abaixo de reservas ativas!
      if (nova_contagem_presentes < estoqueExistente.reservados) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'AJUSTE_ABAIXO_DE_RESERVAS',
            'Ajuste Bloqueado por Reservas Ativas',
            `Não é permitido reduzir a contagem física para ${nova_contagem_presentes} unidade(s) pois existem ${estoqueExistente.reservados} unidade(s) reservadas ativas para clientes. Resolva ou desvincule as reservas antes de ajustar.`
          )
        );
      }

      // Aplica regra de domínio
      const itemDomain = new EstoqueItem({
        id: estoqueExistente.id,
        operacaoId: session.operacaoId,
        produtoId: produto.id,
        presentes: estoqueExistente.presentes,
        reservados: estoqueExistente.reservados,
        prontaEntrega: estoqueExistente.pronta_entrega
      });

      itemDomain.ajustarContagemFisica(nova_contagem_presentes, justificativa.trim());

      const diferenca = Math.abs(nova_contagem_presentes - estoqueExistente.presentes);

      const { estoqueAtualizado, movAtualizada } = await (request.tenantPrisma as any).$transaction(async (tx: any) => {
        const ep = await tx.estoqueItem.update({
          where: { id: itemDomain.id },
          data: {
            presentes: itemDomain.presentes,
            reservados: itemDomain.reservados,
            pronta_entrega: itemDomain.prontaEntrega
          }
        });

        const mp = await tx.movimentacaoEstoque.create({
          data: {
            id: gerarUuidV7(),
            operacao_id: session.operacaoId,
            produto_id: produto.id,
            estoque_item_id: itemDomain.id,
            tipo: 'AJUSTE_BALANCO',
            quantidade: diferenca,
            presentes_anterior: estoqueExistente.presentes,
            presentes_posterior: itemDomain.presentes,
            reservados_anterior: estoqueExistente.reservados,
            reservados_posterior: itemDomain.reservados,
            pronta_entrega_anterior: estoqueExistente.pronta_entrega,
            pronta_entrega_posterior: itemDomain.prontaEntrega,
            operador_id: session.operadorId,
            operador_nome: session.operadorNome,
            detalhes: justificativa.trim()
          }
        });

        await tx.registroAuditoria.create({
          data: {
            id: gerarUuidV7(),
            operacao_id: session.operacaoId,
            operador_id: session.operadorId,
            operador_nome: session.operadorNome,
            acao: 'AJUSTE_INVENTARIO',
            detalhes: JSON.stringify({
              produto_id: produto.id,
              produto_nome: produto.nome,
              contagem_anterior: estoqueExistente.presentes,
              nova_contagem: nova_contagem_presentes,
              justificativa: justificativa.trim()
            })
          }
        });

        return { estoqueAtualizado: ep, movAtualizada: mp };
      });

      return reply.status(200).send({
        id: estoqueAtualizado.id,
        produto_id: estoqueAtualizado.produto_id,
        presentes: estoqueAtualizado.presentes,
        reservados: estoqueAtualizado.reservados,
        pronta_entrega: estoqueAtualizado.pronta_entrega,
        movimentacao: movAtualizada
      });
    }
  );

  // GET /api/estoque/:produtoId - Consulta estoque e extrato de um produto específico
  fastify.get<{ Params: { produtoId: string } }>(
    '/api/estoque/:produtoId',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { produtoId } = request.params;
      const session = request.session!;

      const produto = await request.tenantPrisma.produto.findUnique({
        where: { id: produtoId }
      });

      if (!produto) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Produto Não Encontrado',
            'O produto solicitado não existe ou não pertence a esta operação.'
          )
        );
      }

      const estoque = await request.tenantPrisma.estoqueItem.findFirst({
        where: { produto_id: produto.id },
        include: {
          movimentacoes: {
            orderBy: { criado_em: 'desc' }
          }
        }
      });

      // Cálculo de frascos aguardados da fábrica (FR-025, UX-DR3)
      const itensContaAguardando = await request.tenantPrisma.itemConta.findMany({
        where: {
          produto_id: produto.id,
          status_entrega: 'AGUARDANDO_FABRICA'
        }
      });
      const aguardandoClientes = itensContaAguardando.reduce((acc, it) => acc + it.quantidade, 0);

      const itensCompraProntaEntrega = await request.tenantPrisma.itemCompraMarca.findMany({
        where: {
          produto_id: produto.id,
          destinacao: 'PRONTA_ENTREGA',
          compra: {
            status: { in: ['PEDIDO_REGISTRADO', 'CONFERENCIA_EM_ANDAMENTO'] }
          }
        }
      });
      const aguardandoProntaEntrega = itensCompraProntaEntrega.reduce(
        (acc, it) => acc + Math.max(0, it.quantidade - it.quantidade_recebida - (it.quantidade_cancelada_falta || 0)),
        0
      );

      const aguardandoFabrica = aguardandoClientes + aguardandoProntaEntrega;

      if (!estoque) {
        return reply.status(200).send({
          id: null,
          operacao_id: session.operacaoId,
          produto_id: produto.id,
          presentes: 0,
          reservados: 0,
          pronta_entrega: 0,
          aguardando_fabrica: aguardandoFabrica,
          criado_em: null,
          atualizado_em: null,
          movimentacoes: []
        });
      }

      return reply.status(200).send({
        id: estoque.id,
        operacao_id: estoque.operacao_id,
        produto_id: estoque.produto_id,
        presentes: estoque.presentes,
        reservados: estoque.reservados,
        pronta_entrega: estoque.pronta_entrega,
        aguardando_fabrica: aguardandoFabrica,
        criado_em: estoque.criado_em.toISOString(),
        atualizado_em: estoque.atualizado_em.toISOString(),
        movimentacoes: estoque.movimentacoes.map((m) => ({
          id: m.id,
          tipo: m.tipo,
          quantidade: m.quantidade,
          presentes_anterior: m.presentes_anterior,
          presentes_posterior: m.presentes_posterior,
          reservados_anterior: m.reservados_anterior,
          reservados_posterior: m.reservados_posterior,
          pronta_entrega_anterior: m.pronta_entrega_anterior,
          pronta_entrega_posterior: m.pronta_entrega_posterior,
          compra_id: m.compra_id,
          operador_id: m.operador_id,
          operador_nome: m.operador_nome,
          detalhes: m.detalhes,
          criado_em: m.criado_em.toISOString()
        }))
      });
    }
  );

  // GET /api/estoque/:produtoId/extrato - Extrato detalhado de movimentações do produto
  fastify.get<{ Params: { produtoId: string } }>(
    '/api/estoque/:produtoId/extrato',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { produtoId } = request.params;

      const produto = await request.tenantPrisma.produto.findUnique({
        where: { id: produtoId }
      });

      if (!produto) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Produto Não Encontrado',
            'O produto solicitado não existe ou não pertence a esta operação.'
          )
        );
      }

      const movimentacoes = await request.tenantPrisma.movimentacaoEstoque.findMany({
        where: { produto_id: produto.id },
        orderBy: { criado_em: 'desc' }
      });

      return reply.status(200).send(
        movimentacoes.map((m) => ({
          id: m.id,
          tipo: m.tipo,
          quantidade: m.quantidade,
          presentes_anterior: m.presentes_anterior,
          presentes_posterior: m.presentes_posterior,
          reservados_anterior: m.reservados_anterior,
          reservados_posterior: m.reservados_posterior,
          pronta_entrega_anterior: m.pronta_entrega_anterior,
          pronta_entrega_posterior: m.pronta_entrega_posterior,
          compra_id: m.compra_id,
          operador_id: m.operador_id,
          operador_nome: m.operador_nome,
          detalhes: m.detalhes,
          criado_em: m.criado_em.toISOString()
        }))
      );
    }
  );

  // GET /api/estoque - Lista de todos os itens em estoque na operação
  fastify.get(
    '/api/estoque',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const itens = await request.tenantPrisma.estoqueItem.findMany({
        include: {
          produto: {
            include: {
              marca: true
            }
          }
        },
        orderBy: [
          { produto: { nome: 'asc' } }
        ]
      });

      // Agregações de aguardando fábrica (FR-025, UX-DR3)
      const itensContaAguardando = await request.tenantPrisma.itemConta.findMany({
        where: {
          status_entrega: 'AGUARDANDO_FABRICA'
        }
      });
      const aguardandoMap: Record<string, number> = {};
      for (const it of itensContaAguardando) {
        aguardandoMap[it.produto_id] = (aguardandoMap[it.produto_id] || 0) + it.quantidade;
      }

      const itensCompraProntaEntrega = await request.tenantPrisma.itemCompraMarca.findMany({
        where: {
          destinacao: 'PRONTA_ENTREGA',
          compra: {
            status: { in: ['PEDIDO_REGISTRADO', 'CONFERENCIA_EM_ANDAMENTO'] }
          }
        }
      });
      for (const it of itensCompraProntaEntrega) {
        const pendente = Math.max(0, it.quantidade - it.quantidade_recebida - (it.quantidade_cancelada_falta || 0));
        aguardandoMap[it.produto_id] = (aguardandoMap[it.produto_id] || 0) + pendente;
      }

      return reply.status(200).send(
        itens.map((item) => ({
          id: item.id,
          operacao_id: item.operacao_id,
          produto_id: item.produto_id,
          produto_nome: item.produto.nome,
          produto_variante: item.produto.variante,
          produto_codigo_barras: item.produto.codigo_barras,
          marca_nome: item.produto.marca?.nome ?? null,
          presentes: item.presentes,
          reservados: item.reservados,
          pronta_entrega: item.pronta_entrega,
          aguardando_fabrica: aguardandoMap[item.produto_id] || 0,
          criado_em: item.criado_em.toISOString(),
          atualizado_em: item.atualizado_em.toISOString()
        }))
      );
    }
  );
};
