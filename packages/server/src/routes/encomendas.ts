import type { FastifyPluginAsync } from 'fastify';
import {
  ItemConta,
  ContaCliente,
  Encomenda,
  gerarUuidV7,
  createProblemDetails,
  DomainError
} from '@consultorasync/core';

interface ItemEncomendaInput {
  produto_id: string;
  quantidade: number;
  preco_unitario_centavos?: number;
}

interface CriarEncomendaBody {
  cliente_id: string;
  descricao?: string | null;
  itens: ItemEncomendaInput[];
}

interface EncomendasQuery {
  cliente_id?: string;
  status?: string;
}

export const encomendasRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/encomendas - Criação atômica de encomenda e conta (FR-015, FR-016, AD-2, AD-3, NFR-001)
  fastify.post<{ Body: CriarEncomendaBody }>(
    '/api/encomendas',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { cliente_id, descricao, itens } = request.body || {};
      const session = request.session!;

      if (!cliente_id || typeof cliente_id !== 'string' || cliente_id.trim().length === 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Cliente Obrigatória', 'O cliente_id é obrigatório para registrar a encomenda.')
        );
      }

      if (descricao !== undefined && descricao !== null && typeof descricao !== 'string') {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Descrição Inválida', 'A descrição da encomenda deve ser um texto.')
        );
      }

      // Validação de isolamento e existência da cliente (FR-002, AD-1)
      const cliente = await request.tenantPrisma.cliente.findUnique({
        where: { id: cliente_id.trim() }
      });

      if (!cliente) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'CLIENTE_NAO_ENCONTRADA',
            'Cliente Não Encontrada',
            'A cliente selecionada não foi encontrada nesta operação.'
          )
        );
      }

      if (!Array.isArray(itens) || itens.length === 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'ITENS_OBRIGATORIOS',
            'Itens Obrigatórios',
            'Informe ao menos um produto para criar a encomenda.'
          )
        );
      }

      // Validação prévia de itens e produtos
      const produtosProcessados: Array<{
        produto: any;
        quantidade: number;
        precoUnitarioCentavos: number;
        custoUnitarioCentavos: number | null;
        origemCusto: any;
      }> = [];

      for (const itemInput of itens) {
        if (!itemInput || typeof itemInput !== 'object' || !itemInput.produto_id || typeof itemInput.produto_id !== 'string') {
          return reply.status(400).type('application/problem+json').send(
            createProblemDetails(400, 'BAD_REQUEST', 'Produto Obrigatório', 'Cada item deve possuir um produto_id válido.')
          );
        }

        const quantidade = itemInput.quantidade;
        if (!Number.isInteger(quantidade) || quantidade <= 0) {
          return reply.status(400).type('application/problem+json').send(
            createProblemDetails(
              400,
              'QUANTIDADE_INVALIDA',
              'Quantidade Inválida',
              'A quantidade encomendada deve ser um número inteiro maior que zero.'
            )
          );
        }

        const produto = await request.tenantPrisma.produto.findUnique({
          where: { id: itemInput.produto_id.trim() }
        });

        if (!produto) {
          return reply.status(404).type('application/problem+json').send(
            createProblemDetails(
              404,
              'PRODUTO_NAO_ENCONTRADO',
              'Produto Não Encontrado',
              `O produto de ID '${itemInput.produto_id}' não foi encontrado nesta operação.`
            )
          );
        }

        // Preço congelado (usa o do catálogo ou informado explicitamente se válido)
        let precoUnitario = produto.preco_venda_centavos;
        if (
          itemInput.preco_unitario_centavos !== undefined &&
          itemInput.preco_unitario_centavos !== null
        ) {
          if (!Number.isInteger(itemInput.preco_unitario_centavos) || itemInput.preco_unitario_centavos <= 0) {
            return reply.status(400).type('application/problem+json').send(
              createProblemDetails(
                400,
                'BAD_REQUEST',
                'Preço Unitário Inválido',
                'O preço unitário em centavos deve ser maior que zero.'
              )
            );
          }
          precoUnitario = itemInput.preco_unitario_centavos;
        }

        // Custo congelado conforme proveniência no catálogo (AD-2, FR-019)
        const custoUnitario = produto.custo_centavos;
        const origemCusto = produto.proveniencia_custo;

        produtosProcessados.push({
          produto,
          quantidade,
          precoUnitarioCentavos: precoUnitario,
          custoUnitarioCentavos: custoUnitario,
          origemCusto
        });
      }

      const encomendaId = gerarUuidV7();
      const contaId = gerarUuidV7();

      // Construção das entidades de domínio para validação pura
      const itensDominio: ItemConta[] = [];
      for (const p of produtosProcessados) {
        itensDominio.push(
          new ItemConta({
            id: gerarUuidV7(),
            operacaoId: session.operacaoId,
            contaId,
            encomendaId,
            produtoId: p.produto.id,
            quantidade: p.quantidade,
            precoUnitarioCentavos: p.precoUnitarioCentavos,
            custoUnitarioCentavos: p.custoUnitarioCentavos,
            origemCusto: p.origemCusto,
            statusEntrega: 'AGUARDANDO_FABRICA'
          })
        );
      }

      const contaDominio = new ContaCliente({
        id: contaId,
        operacaoId: session.operacaoId,
        clienteId: cliente.id,
        encomendaId,
        itens: itensDominio
      });

      const encomendaDominio = new Encomenda({
        id: encomendaId,
        operacaoId: session.operacaoId,
        clienteId: cliente.id,
        contaId,
        descricao: descricao || null,
        itens: itensDominio
      });

      // Transação atômica no banco de dados (NFR-001)
      const resultado = await (request.tenantPrisma as any).$transaction(async (tx: any) => {
        // 1. Cria Encomenda
        const encomendaCriada = await tx.encomenda.create({
          data: {
            id: encomendaDominio.id,
            operacao_id: session.operacaoId,
            cliente_id: cliente.id,
            descricao: encomendaDominio.descricao,
            status: encomendaDominio.status,
            criado_em: new Date(encomendaDominio.criadoEm)
          }
        });

        // 2. Cria Conta associada
        const contaCriada = await tx.conta.create({
          data: {
            id: contaDominio.id,
            operacao_id: session.operacaoId,
            cliente_id: cliente.id,
            encomenda_id: encomendaDominio.id,
            valor_total: contaDominio.valorTotalCentavos,
            total_pago: 0,
            status: contaDominio.status,
            criado_em: new Date(contaDominio.criadoEm)
          }
        });

        // 3. Cria Itens da Conta com status AGUARDANDO_FABRICA
        const itensCriados: any[] = [];
        for (const it of itensDominio) {
          const itemCriado = await tx.itemConta.create({
            data: {
              id: it.id,
              operacao_id: session.operacaoId,
              conta_id: contaCriada.id,
              encomenda_id: encomendaCriada.id,
              produto_id: it.produtoId,
              quantidade: it.quantidade,
              preco_unitario_centavos: it.precoUnitarioCentavos,
              custo_unitario_centavos: it.custoUnitarioCentavos,
              origem_custo: it.origemCusto,
              status_entrega: it.statusEntrega,
              criado_em: new Date(it.criadoEm)
            },
            include: {
              produto: true
            }
          });
          itensCriados.push(itemCriado);
        }

        // 4. Auditoria nominal (NFR-003)
        await tx.registroAuditoria.create({
          data: {
            id: gerarUuidV7(),
            operacao_id: session.operacaoId,
            operador_id: session.operadorId,
            operador_nome: session.operadorNome,
            acao: 'REGISTRAR_ENCOMENDA',
            detalhes: `Anotação de encomenda para a cliente ${cliente.nome}: ${encomendaDominio.quantidadeTotalItens} item(ns), total ${encomendaDominio.valorTotalFormatado}`,
            criado_em: new Date()
          }
        });

        return {
          encomenda: encomendaCriada,
          conta: contaCriada,
          itens: itensCriados
        };
      });

      return reply.status(201).send({
        id: resultado.encomenda.id,
        operacao_id: resultado.encomenda.operacao_id,
        cliente_id: resultado.encomenda.cliente_id,
        cliente_nome: cliente.nome,
        descricao: resultado.encomenda.descricao,
        status: resultado.encomenda.status,
        quantidade_total_itens: encomendaDominio.quantidadeTotalItens,
        valor_total_centavos: encomendaDominio.valorTotalCentavos,
        valor_total_formatado: encomendaDominio.valorTotalFormatado,
        criado_em: resultado.encomenda.criado_em.toISOString(),
        conta: {
          id: resultado.conta.id,
          valor_total: resultado.conta.valor_total,
          valor_total_formatado: contaDominio.valorTotalFormatado,
          total_pago: resultado.conta.total_pago,
          saldo_total_devido_centavos: contaDominio.calcularSaldoTotalDevidoCentavos(),
          saldo_total_devido_formatado: contaDominio.saldoTotalDevidoFormatado,
          saldo_cobravel_hoje_centavos: contaDominio.calcularSaldoCobravelHojeCentavos(),
          saldo_cobravel_hoje_formatado: contaDominio.saldoCobravelHojeFormatado,
          total_sem_aguardados_centavos: contaDominio.calcularTotalSemAguardadosCentavos(),
          status: resultado.conta.status,
          criado_em: resultado.conta.criado_em.toISOString()
        },
        itens: resultado.itens.map((it: any) => ({
          id: it.id,
          produto_id: it.produto_id,
          produto_nome: it.produto.nome,
          variante: it.produto.variante,
          quantidade: it.quantidade,
          preco_unitario_centavos: it.preco_unitario_centavos,
          preco_unitario_formatado: (it.preco_unitario_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          custo_unitario_centavos: it.custo_unitario_centavos,
          origem_custo: it.origem_custo,
          status_entrega: it.status_entrega,
          subtotal_centavos: it.quantidade * it.preco_unitario_centavos,
          subtotal_formatado: ((it.quantidade * it.preco_unitario_centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        }))
      });
    }
  );

  // GET /api/encomendas - Listagem de encomendas da operação (com filtros opcionais por cliente e status)
  fastify.get<{ Querystring: EncomendasQuery }>(
    '/api/encomendas',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { cliente_id, status } = request.query;

      const whereClause: any = {};
      if (cliente_id && cliente_id.trim().length > 0) {
        whereClause.cliente_id = cliente_id.trim();
      }
      if (status && status.trim().length > 0) {
        whereClause.status = status.trim();
      }

      const encomendas = await request.tenantPrisma.encomenda.findMany({
        where: whereClause,
        include: {
          cliente: true,
          contas: {
            include: {
              itens: {
                include: { produto: true }
              }
            }
          },
          itens: {
            include: { produto: true }
          }
        },
        orderBy: {
          criado_em: 'desc'
        }
      });

      return reply.status(200).send(
        encomendas.map((enc) => {
          const contaRelacionada = enc.contas[0];
          let saldoCobravelHoje = 0;
          let valorTotalConta = 0;
          let totalPagoConta = 0;

          if (contaRelacionada) {
            valorTotalConta = contaRelacionada.valor_total;
            totalPagoConta = contaRelacionada.total_pago;
            const itensValidos = contaRelacionada.itens.filter((i) => i.status_entrega !== 'CANCELADO');
            const totalSemAguardados = itensValidos
              .filter((i) => i.status_entrega !== 'AGUARDANDO_FABRICA')
              .reduce((acc, cur) => acc + cur.quantidade * cur.preco_unitario_centavos, 0);
            saldoCobravelHoje = Math.max(0, totalSemAguardados - totalPagoConta);
          }

          const totalItens = enc.itens.reduce((acc, cur) => acc + cur.quantidade, 0);
          const totalValor = enc.itens.reduce((acc, cur) => acc + cur.quantidade * cur.preco_unitario_centavos, 0);

          return {
            id: enc.id,
            operacao_id: enc.operacao_id,
            cliente_id: enc.cliente_id,
            cliente_nome: enc.cliente.nome,
            cliente_telefone: enc.cliente.telefone,
            descricao: enc.descricao,
            status: enc.status,
            quantidade_total_itens: totalItens,
            valor_total_centavos: totalValor,
            valor_total_formatado: (totalValor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            criado_em: enc.criado_em.toISOString(),
            conta: contaRelacionada
              ? {
                  id: contaRelacionada.id,
                  valor_total: valorTotalConta,
                  total_pago: totalPagoConta,
                  saldo_cobravel_hoje_centavos: saldoCobravelHoje,
                  status: contaRelacionada.status
                }
              : null,
            itens: enc.itens.map((it) => ({
              id: it.id,
              produto_id: it.produto_id,
              produto_nome: it.produto.nome,
              variante: it.produto.variante,
              quantidade: it.quantidade,
              preco_unitario_centavos: it.preco_unitario_centavos,
              preco_unitario_formatado: (it.preco_unitario_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
              custo_unitario_centavos: it.custo_unitario_centavos,
              origem_custo: it.origem_custo,
              status_entrega: it.status_entrega,
              subtotal_centavos: it.quantidade * it.preco_unitario_centavos,
              subtotal_formatado: ((it.quantidade * it.preco_unitario_centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            }))
          };
        })
      );
    }
  );

  // GET /api/encomendas/:id - Detalhes de uma encomenda específica
  fastify.get<{ Params: { id: string } }>(
    '/api/encomendas/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;

      const enc = await request.tenantPrisma.encomenda.findUnique({
        where: { id },
        include: {
          cliente: true,
          contas: {
            include: {
              itens: {
                include: { produto: true }
              }
            }
          },
          itens: {
            include: { produto: true }
          }
        }
      });

      if (!enc) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'ENCOMENDA_NAO_ENCONTRADA',
            'Encomenda Não Encontrada',
            'A encomenda solicitada não existe ou não pertence a esta operação.'
          )
        );
      }

      const contaRelacionada = enc.contas[0];
      let saldoCobravelHoje = 0;
      let valorTotalConta = 0;
      let totalPagoConta = 0;

      if (contaRelacionada) {
        valorTotalConta = contaRelacionada.valor_total;
        totalPagoConta = contaRelacionada.total_pago;
        const itensValidos = contaRelacionada.itens.filter((i) => i.status_entrega !== 'CANCELADO');
        const totalSemAguardados = itensValidos
          .filter((i) => i.status_entrega !== 'AGUARDANDO_FABRICA')
          .reduce((acc, cur) => acc + cur.quantidade * cur.preco_unitario_centavos, 0);
        saldoCobravelHoje = Math.max(0, totalSemAguardados - totalPagoConta);
      }

      const totalItens = enc.itens.reduce((acc, cur) => acc + cur.quantidade, 0);
      const totalValor = enc.itens.reduce((acc, cur) => acc + cur.quantidade * cur.preco_unitario_centavos, 0);

      return reply.status(200).send({
        id: enc.id,
        operacao_id: enc.operacao_id,
        cliente_id: enc.cliente_id,
        cliente_nome: enc.cliente.nome,
        cliente_telefone: enc.cliente.telefone,
        descricao: enc.descricao,
        status: enc.status,
        quantidade_total_itens: totalItens,
        valor_total_centavos: totalValor,
        valor_total_formatado: (totalValor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        criado_em: enc.criado_em.toISOString(),
        conta: contaRelacionada
          ? {
              id: contaRelacionada.id,
              valor_total: valorTotalConta,
              total_pago: totalPagoConta,
              saldo_cobravel_hoje_centavos: saldoCobravelHoje,
              status: contaRelacionada.status
            }
          : null,
        itens: enc.itens.map((it) => ({
          id: it.id,
          produto_id: it.produto_id,
          produto_nome: it.produto.nome,
          variante: it.produto.variante,
          quantidade: it.quantidade,
          preco_unitario_centavos: it.preco_unitario_centavos,
          preco_unitario_formatado: (it.preco_unitario_centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          custo_unitario_centavos: it.custo_unitario_centavos,
          origem_custo: it.origem_custo,
          status_entrega: it.status_entrega,
          subtotal_centavos: it.quantidade * it.preco_unitario_centavos,
          subtotal_formatado: ((it.quantidade * it.preco_unitario_centavos) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        }))
      });
    }
  );
};
