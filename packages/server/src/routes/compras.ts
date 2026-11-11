import type { FastifyPluginAsync } from 'fastify';
import {
  CompraMarca,
  ItemCompraMarca,
  gerarUuidV7,
  createProblemDetails,
  DomainError
} from '@consultorasync/core';

interface ItemCompraInput {
  produto_id: string;
  destinacao: 'CLIENTE' | 'PRONTA_ENTREGA';
  quantidade: number;
  cliente_id?: string | null;
  encomenda_id?: string | null;
  item_conta_id?: string | null;
  custo_unitario_centavos?: number | null;
}

interface CriarCompraBody {
  marca_id: string;
  numero_pedido?: string | null;
  observacoes?: string | null;
  itens: ItemCompraInput[];
}

interface ComprasQuery {
  marca_id?: string;
  status?: string;
}

interface PendenciasQuery {
  marca_id?: string;
}

export const comprasRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/compras-marca/pendencias - Encomendas pendentes de fábrica para a marca (FR-017, FR-018)
  fastify.get<{ Querystring: PendenciasQuery }>(
    '/api/compras-marca/pendencias',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { marca_id } = request.query;
      const operacaoId = request.session!.operacaoId;

      // Buscar itens de conta com status AGUARDANDO_FABRICA
      const itensPendentes = await request.tenantPrisma.itemConta.findMany({
        where: {
          operacao_id: operacaoId,
          status_entrega: 'AGUARDANDO_FABRICA',
          produto: marca_id ? { marca_id: marca_id.trim() } : undefined
        },
        include: {
          produto: {
            include: {
              marca: true
            }
          },
          conta: {
            include: {
              cliente: true
            }
          },
          encomenda: true
        },
        orderBy: { criado_em: 'asc' }
      });

      const pendenciasFormatadas = itensPendentes.map((item) => ({
        item_conta_id: item.id,
        encomenda_id: item.encomenda_id,
        cliente_id: item.conta.cliente.id,
        cliente_nome: item.conta.cliente.nome,
        produto_id: item.produto_id,
        produto_nome: item.produto.nome,
        variante: item.produto.variante,
        marca_id: item.produto.marca_id,
        marca_nome: item.produto.marca?.nome || null,
        quantidade: item.quantidade,
        custo_unitario_centavos: item.custo_unitario_centavos,
        origem_custo: item.origem_custo,
        criado_em: item.criado_em.toISOString()
      }));

      return reply.send({
        pendencias: pendenciasFormatadas,
        total_itens: pendenciasFormatadas.reduce((acc, p) => acc + p.quantidade, 0)
      });
    }
  );

  // POST /api/compras-marca - Registro de compra à marca com consolidação e vínculo nominal (FR-017, FR-018, AD-1, AD-3, NFR-003)
  fastify.post<{ Body: CriarCompraBody }>(
    '/api/compras-marca',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { marca_id, numero_pedido, observacoes, itens } = request.body || {};
      const session = request.session!;

      if (!marca_id || typeof marca_id !== 'string' || marca_id.trim().length === 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Marca Obrigatória', 'O marca_id é obrigatório para registrar a compra.')
        );
      }

      // Validação de isolamento e existência da marca
      const marca = await request.tenantPrisma.marca.findUnique({
        where: { id: marca_id.trim() }
      });

      if (!marca) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'MARCA_NAO_ENCONTRADA',
            'Marca Não Encontrada',
            'A marca selecionada não foi encontrada nesta operação.'
          )
        );
      }

      if (!Array.isArray(itens) || itens.length === 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'ITENS_OBRIGATORIOS',
            'Itens Obrigatórios',
            'Informe ao menos um item para registrar a compra à marca.'
          )
        );
      }

      // Validação e resolução de dados de produtos e clientes
      const itensProcessados: Array<{
        produto_id: string;
        produto_nome: string;
        destinacao: 'CLIENTE' | 'PRONTA_ENTREGA';
        quantidade: number;
        cliente_id: string | null;
        cliente_nome: string | null;
        encomenda_id: string | null;
        item_conta_id: string | null;
        custo_unitario_centavos: number | null;
        origem_custo: 'TABELA_ORIGINAL' | 'ESTIMADO_PERCENTUAL' | 'DESCONHECIDO';
      }> = [];

      for (const itemInput of itens) {
        if (!itemInput || typeof itemInput !== 'object' || !itemInput.produto_id) {
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
              'A quantidade do item deve ser um número inteiro maior que zero.'
            )
          );
        }

        if (itemInput.destinacao !== 'CLIENTE' && itemInput.destinacao !== 'PRONTA_ENTREGA') {
          return reply.status(400).type('application/problem+json').send(
            createProblemDetails(
              400,
              'DESTINACAO_INVALIDA',
              'Destinação Inválida',
              'A destinação deve ser obrigatoriamente "CLIENTE" ou "PRONTA_ENTREGA".'
            )
          );
        }

        // Buscar produto na operação e validar pertinência à marca
        const produto = await request.tenantPrisma.produto.findUnique({
          where: { id: itemInput.produto_id.trim() }
        });

        if (!produto) {
          return reply.status(404).type('application/problem+json').send(
            createProblemDetails(
              404,
              'PRODUTO_NAO_ENCONTRADO',
              'Produto Não Encontrado',
              `O produto ${itemInput.produto_id} não foi encontrado na operação.`
            )
          );
        }

        if (produto.marca_id !== marca.id) {
          return reply.status(400).type('application/problem+json').send(
            createProblemDetails(
              400,
              'PRODUTO_MARCA_INCOMPATIVEL',
              'Produto de Marca Incompatível',
              `O produto "${produto.nome}" pertence a outra marca ou não está vinculado à marca desta compra.`
            )
          );
        }

        let clienteId: string | null = null;
        let clienteNome: string | null = null;

        if (itemInput.destinacao === 'CLIENTE') {
          if (!itemInput.cliente_id || typeof itemInput.cliente_id !== 'string' || itemInput.cliente_id.trim().length === 0) {
            return reply.status(400).type('application/problem+json').send(
              createProblemDetails(
                400,
                'CLIENTE_OBRIGATORIO',
                'Cliente Obrigatório para Vínculo',
                `O item do produto "${produto.nome}" com destinação CLIENTE exige a identificação nominal de uma cliente.`
              )
            );
          }

          const cliente = await request.tenantPrisma.cliente.findUnique({
            where: { id: itemInput.cliente_id.trim() }
          });

          if (!cliente) {
            return reply.status(404).type('application/problem+json').send(
              createProblemDetails(
                404,
                'CLIENTE_NAO_ENCONTRADA',
                'Cliente Não Encontrada',
                `A cliente ${itemInput.cliente_id} não foi encontrada na operação.`
              )
            );
          }

          clienteId = cliente.id;
          clienteNome = cliente.nome;
        }

        // Determinação de custo
        let custoUnitarioCentavos: number | null = itemInput.custo_unitario_centavos ?? null;
        let origemCusto: 'TABELA_ORIGINAL' | 'ESTIMADO_PERCENTUAL' | 'DESCONHECIDO' = 'DESCONHECIDO';

        if (custoUnitarioCentavos !== null && custoUnitarioCentavos !== undefined) {
          if (!Number.isInteger(custoUnitarioCentavos) || custoUnitarioCentavos < 0) {
            return reply.status(400).type('application/problem+json').send(
              createProblemDetails(
                400,
                'CUSTO_INVALIDO',
                'Custo Unitário Inválido',
                'O custo unitário em centavos deve ser um número inteiro não negativo.'
              )
            );
          }
          origemCusto = 'TABELA_ORIGINAL';
        } else if (produto.custo_centavos !== null && produto.custo_centavos !== undefined) {
          custoUnitarioCentavos = produto.custo_centavos;
          origemCusto = (produto.proveniencia_custo as any) || 'TABELA_ORIGINAL';
        } else if (marca.percentual_padrao !== null && marca.percentual_padrao !== undefined) {
          custoUnitarioCentavos = Math.round(produto.preco_venda_centavos * (1 - marca.percentual_padrao / 100));
          origemCusto = 'ESTIMADO_PERCENTUAL';
        }

        itensProcessados.push({
          produto_id: produto.id,
          produto_nome: produto.nome,
          destinacao: itemInput.destinacao,
          quantidade,
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          encomenda_id: itemInput.encomenda_id?.trim() || null,
          item_conta_id: itemInput.item_conta_id?.trim() || null,
          custo_unitario_centavos: custoUnitarioCentavos,
          origem_custo: origemCusto
        });
      }

      // Execução atômica da transação
      const compraId = gerarUuidV7();

      const resultado = await (fastify.prisma as any).$transaction(async (tx: any) => {
        // Criar CompraMarca
        const compraCriada = await tx.compraMarca.create({
          data: {
            id: compraId,
            operacao_id: session.operacaoId,
            marca_id: marca.id,
            numero_pedido: numero_pedido?.trim() || null,
            observacoes: observacoes?.trim() || null,
            status: 'PEDIDO_REGISTRADO',
            data_pedido: new Date()
          }
        });

        // Criar itens da compra
        const itensCriados = await Promise.all(
          itensProcessados.map((item) =>
            tx.itemCompraMarca.create({
              data: {
                id: gerarUuidV7(),
                operacao_id: session.operacaoId,
                compra_id: compraId,
                produto_id: item.produto_id,
                destinacao: item.destinacao,
                quantidade: item.quantidade,
                quantidade_recebida: 0,
                cliente_id: item.cliente_id,
                encomenda_id: item.encomenda_id,
                item_conta_id: item.item_conta_id,
                custo_unitario_centavos: item.custo_unitario_centavos,
                origem_custo: item.origem_custo
              }
            })
          )
        );

        // Registro de Auditoria nominal (NFR-003, AD-1)
        await tx.registroAuditoria.create({
          data: {
            id: gerarUuidV7(),
            operacao_id: session.operacaoId,
            operador_id: session.operadorId,
            operador_nome: session.operadorNome,
            acao: 'REGISTRAR_COMPRA_MARCA',
            detalhes: JSON.stringify({
              compra_id: compraId,
              marca_id: marca.id,
              marca_nome: marca.nome,
              numero_pedido: compraCriada.numero_pedido,
              total_itens: itensProcessados.reduce((acc, i) => acc + i.quantidade, 0),
              total_produtos_distintos: new Set(itensProcessados.map((i) => i.produto_id)).size,
              clientes_vinculados: itensProcessados.filter((i) => i.cliente_id).map((i) => i.cliente_id)
            })
          }
        });

        return { compra: compraCriada, itens: itensCriados };
      });

      // Construção do objeto de domínio puro para computação do espelho
      const domainItens = itensProcessados.map(
        (i) =>
          new ItemCompraMarca({
            operacaoId: session.operacaoId,
            compraId,
            produtoId: i.produto_id,
            destinacao: i.destinacao,
            clienteId: i.cliente_id,
            clienteNome: i.cliente_nome,
            encomendaId: i.encomenda_id,
            itemContaId: i.item_conta_id,
            quantidade: i.quantidade,
            custoUnitarioCentavos: i.custo_unitario_centavos,
            origemCusto: i.origem_custo
          })
      );

      const domainCompra = new CompraMarca({
        id: compraId,
        operacaoId: session.operacaoId,
        marcaId: marca.id,
        marcaNome: marca.nome,
        numeroPedido: resultado.compra.numero_pedido,
        observacoes: resultado.compra.observacoes,
        status: resultado.compra.status as any,
        dataPedido: resultado.compra.data_pedido.toISOString(),
        itens: domainItens
      });

      const espelho = domainCompra.gerarEspelhoPorProduto();

      return reply.status(201).send({
        id: domainCompra.id,
        operacao_id: domainCompra.operacaoId,
        marca_id: domainCompra.marcaId,
        marca_nome: domainCompra.marcaNome,
        numero_pedido: domainCompra.numeroPedido,
        observacoes: domainCompra.observacoes,
        status: domainCompra.status,
        data_pedido: domainCompra.dataPedido,
        quantidade_total_itens: domainCompra.quantidadeTotalItens,
        quantidade_itens_clientes: domainCompra.quantidadeItensClientes,
        quantidade_itens_pronta_entrega: domainCompra.quantidadeItensProntaEntrega,
        custo_total_estimado_centavos: domainCompra.custoTotalEstimadoCentavos,
        custo_total_estimado_formatado: domainCompra.custoTotalEstimadoFormatado,
        espelho_produtos: espelho,
        itens: resultado.itens.map((it: any, idx: number) => ({
          id: it.id,
          produto_id: it.produto_id,
          produto_nome: itensProcessados[idx].produto_nome,
          destinacao: it.destinacao,
          quantidade: it.quantidade,
          quantidade_recebida: it.quantidade_recebida,
          cliente_id: it.cliente_id,
          cliente_nome: itensProcessados[idx].cliente_nome,
          encomenda_id: it.encomenda_id,
          item_conta_id: it.item_conta_id,
          custo_unitario_centavos: it.custo_unitario_centavos,
          origem_custo: it.origem_custo
        }))
      });
    }
  );

  // GET /api/compras-marca - Listagem de compras da operação
  fastify.get<{ Querystring: ComprasQuery }>(
    '/api/compras-marca',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { marca_id, status } = request.query;
      const operacaoId = request.session!.operacaoId;

      const compras = await request.tenantPrisma.compraMarca.findMany({
        where: {
          operacao_id: operacaoId,
          marca_id: marca_id ? marca_id.trim() : undefined,
          status: status ? status.trim() : undefined
        },
        include: {
          marca: true,
          itens: {
            include: {
              produto: true,
              cliente: true
            }
          }
        },
        orderBy: { data_pedido: 'desc' }
      });

      const response = compras.map((compra) => {
        const totalItens = compra.itens.reduce((acc, it) => acc + it.quantidade, 0);
        const totalClientes = compra.itens
          .filter((it) => it.destinacao === 'CLIENTE')
          .reduce((acc, it) => acc + it.quantidade, 0);
        const totalPe = compra.itens
          .filter((it) => it.destinacao === 'PRONTA_ENTREGA')
          .reduce((acc, it) => acc + it.quantidade, 0);
        const custoTotalCentavos = compra.itens.reduce(
          (acc, it) => acc + (it.custo_unitario_centavos ?? 0) * it.quantidade,
          0
        );

        return {
          id: compra.id,
          operacao_id: compra.operacao_id,
          marca_id: compra.marca_id,
          marca_nome: compra.marca.nome,
          numero_pedido: compra.numero_pedido,
          observacoes: compra.observacoes,
          status: compra.status,
          data_pedido: compra.data_pedido.toISOString(),
          quantidade_total_itens: totalItens,
          quantidade_itens_clientes: totalClientes,
          quantidade_itens_pronta_entrega: totalPe,
          custo_total_centavos: custoTotalCentavos,
          custo_total_formatado: (custoTotalCentavos / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          }),
          itens_count: compra.itens.length
        };
      });

      return reply.send(response);
    }
  );

  // GET /api/compras-marca/:id - Consulta de compra com espelho consolidado (FR-017, FR-018)
  fastify.get<{ Params: { id: string } }>(
    '/api/compras-marca/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const operacaoId = request.session!.operacaoId;

      const compra = await request.tenantPrisma.compraMarca.findUnique({
        where: { id: id.trim() },
        include: {
          marca: true,
          itens: {
            include: {
              produto: true,
              cliente: true
            }
          }
        }
      });

      if (!compra) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'COMPRA_NAO_ENCONTRADA',
            'Compra Não Encontrada',
            'O registro de compra não foi localizado nesta operação.'
          )
        );
      }

      // Reconstrução do domínio puro para gerar o espelho
      const domainItens = compra.itens.map(
        (it) =>
          new ItemCompraMarca({
            id: it.id,
            operacaoId: it.operacao_id,
            compraId: it.compra_id,
            produtoId: it.produto_id,
            destinacao: it.destinacao as any,
            clienteId: it.cliente_id,
            clienteNome: it.cliente?.nome || null,
            encomendaId: it.encomenda_id,
            itemContaId: it.item_conta_id,
            quantidade: it.quantidade,
            quantidadeRecebida: it.quantidade_recebida,
            custoUnitarioCentavos: it.custo_unitario_centavos,
            origemCusto: it.origem_custo as any
          })
      );

      const domainCompra = new CompraMarca({
        id: compra.id,
        operacaoId: compra.operacao_id,
        marcaId: compra.marca_id,
        marcaNome: compra.marca.nome,
        numeroPedido: compra.numero_pedido,
        observacoes: compra.observacoes,
        status: compra.status as any,
        dataPedido: compra.data_pedido.toISOString(),
        itens: domainItens
      });

      const espelho = domainCompra.gerarEspelhoPorProduto();

      return reply.send({
        id: domainCompra.id,
        operacao_id: domainCompra.operacaoId,
        marca_id: domainCompra.marcaId,
        marca_nome: domainCompra.marcaNome,
        numero_pedido: domainCompra.numeroPedido,
        observacoes: domainCompra.observacoes,
        status: domainCompra.status,
        data_pedido: domainCompra.dataPedido,
        quantidade_total_itens: domainCompra.quantidadeTotalItens,
        quantidade_itens_clientes: domainCompra.quantidadeItensClientes,
        quantidade_itens_pronta_entrega: domainCompra.quantidadeItensProntaEntrega,
        custo_total_estimado_centavos: domainCompra.custoTotalEstimadoCentavos,
        custo_total_estimado_formatado: domainCompra.custoTotalEstimadoFormatado,
        espelho_produtos: espelho,
        itens: compra.itens.map((it) => ({
          id: it.id,
          produto_id: it.produto_id,
          produto_nome: it.produto.nome,
          variante: it.produto.variante,
          destinacao: it.destinacao,
          quantidade: it.quantidade,
          quantidade_recebida: it.quantidade_recebida,
          cliente_id: it.cliente_id,
          cliente_nome: it.cliente?.nome || null,
          encomenda_id: it.encomenda_id,
          item_conta_id: it.item_conta_id,
          custo_unitario_centavos: it.custo_unitario_centavos,
          origem_custo: it.origem_custo
        }))
      });
    }
  );
};
