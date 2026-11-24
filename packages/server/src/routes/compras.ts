import type { FastifyPluginAsync } from 'fastify';
import { travarEstoque } from '../db/bloqueio-estoque.js';
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

/** Junta ao espelho os dados que a revendedora digita no site da marca: nome, códigos e foto. */
function espelhoComProdutos<T extends { produtoId: string }>(
  espelho: T[],
  produtos: Array<{ id: string; nome: string; variante: string | null; codigo_revista: string | null; codigo_barras: string | null; imagem_url: string | null }>
) {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  return espelho.map((linha) => {
    const p = porId.get(linha.produtoId);
    return {
      ...linha,
      produtoNome: p?.nome ?? 'Produto',
      variante: p?.variante ?? null,
      codigoRevista: p?.codigo_revista ?? null,
      codigoBarras: p?.codigo_barras ?? null,
      imagemUrl: p?.imagem_url ?? null
    };
  });
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
        codigo_revista: item.produto.codigo_revista,
        codigo_barras: item.produto.codigo_barras,
        imagem_url: item.produto.imagem_url,
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

      const espelho = espelhoComProdutos(
        domainCompra.gerarEspelhoPorProduto(),
        await request.tenantPrisma.produto.findMany({ where: { id: { in: itensProcessados.map((i) => i.produto_id) } } })
      );

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

      const espelho = espelhoComProdutos(domainCompra.gerarEspelhoPorProduto(), compra.itens.map((it) => it.produto));

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

  // GET /api/compras-marca/:id/conferencia - Dados da compra para a conferência de caixa (FR-020, UX-DR2)
  fastify.get<{ Params: { id: string } }>(
    '/api/compras-marca/:id/conferencia',
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
            'O registro de compra informado não foi localizado nesta operação.'
          )
        );
      }

      if (compra.status === 'CANCELADA') {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'COMPRA_CANCELADA',
            'Compra Cancelada',
            'Não é possível conferir uma compra que foi cancelada.'
          )
        );
      }

      const itensConferencia = compra.itens.map((it) => {
        const falta = it.quantidade_cancelada_falta || 0;
        const pendente = Math.max(0, it.quantidade - it.quantidade_recebida - falta);
        return {
          item_compra_id: it.id,
          produto_id: it.produto_id,
          produto_nome: it.produto.nome,
          variante: it.produto.variante,
          codigo_barras: it.produto.codigo_barras,
          destinacao: it.destinacao,
          cliente_id: it.cliente_id,
          cliente_nome: it.cliente?.nome || null,
          encomenda_id: it.encomenda_id,
          item_conta_id: it.item_conta_id,
          quantidade_pedida: it.quantidade,
          quantidade_recebida: it.quantidade_recebida,
          quantidade_cancelada_falta: falta,
          quantidade_pendente: pendente
        };
      });

      return reply.send({
        compra_id: compra.id,
        marca_id: compra.marca_id,
        marca_nome: compra.marca.nome,
        numero_pedido: compra.numero_pedido,
        status: compra.status,
        data_pedido: compra.data_pedido.toISOString(),
        total_itens_pedidos: compra.itens.reduce((acc, i) => acc + i.quantidade, 0),
        total_itens_recebidos: compra.itens.reduce((acc, i) => acc + i.quantidade_recebida, 0),
        total_itens_cancelados_falta: compra.itens.reduce((acc, i) => acc + (i.quantidade_cancelada_falta || 0), 0),
        itens: itensConferencia
      });
    }
  );

  // POST /api/compras-marca/:id/conferencia - Confirmação de conferência com Idempotência (FR-020, AD-3, AD-7, NFR-001)
  fastify.post<{
    Params: { id: string };
    Body: {
      idempotency_key?: string;
      itens_conferidos: Array<{
        item_compra_id: string;
        quantidade: number;
        destinacao?: 'CLIENTE' | 'PRONTA_ENTREGA';
        cliente_id?: string | null;
        item_conta_id?: string | null;
      }>;
    };
  }>(
    '/api/compras-marca/:id/conferencia',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const session = request.session!;

      // 1. Extração da Chave de Idempotência (AD-7)
      const idempotencyKey =
        request.body?.idempotency_key ||
        (request.headers['idempotency-key'] as string) ||
        (request.headers['x-idempotency-key'] as string);

      if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'IDEMPOTENCY_KEY_OBRIGATORIA',
            'Chave de Idempotência Obrigatória',
            'A confirmação de conferência de caixa exige o envio de uma chave de idempotência válida (AD-7).'
          )
        );
      }

      const chaveNormalizada = idempotencyKey.trim();

      // 2. Consulta prévia de Idempotência existente (AD-7, NFR-008)
      const registroExistente = await request.tenantPrisma.registroIdempotencia.findUnique({
        where: {
          operacao_id_chave: {
            operacao_id: session.operacaoId,
            chave: chaveNormalizada
          }
        }
      });

      if (registroExistente) {
        // Retorna a resposta previamente computada sem reexecutar mutações
        return reply
          .status(registroExistente.status_code)
          .type('application/json')
          .send(JSON.parse(registroExistente.resposta_json));
      }

      // 3. Validação da Compra
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
            'A compra informada não foi localizada nesta operação.'
          )
        );
      }

      if (compra.status === 'CONFERIDA') {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'COMPRA_JA_CONFERIDA',
            'Compra Já Conferida',
            'Esta compra já foi totalmente conferida anteriormente.'
          )
        );
      }

      if (compra.status === 'CANCELADA') {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'COMPRA_CANCELADA',
            'Compra Cancelada',
            'Não é possível realizar conferência em compra cancelada.'
          )
        );
      }

      const { itens_conferidos } = request.body || {};
      if (!Array.isArray(itens_conferidos) || itens_conferidos.length === 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'ITENS_OBRIGATORIOS',
            'Itens de Conferência Obrigatórios',
            'Informe ao menos um item conferido na caixa.'
          )
        );
      }

      // 4. Validação de cada item conferido
      const mapaItensCompra = new Map(compra.itens.map((it) => [it.id, it]));
      const itensValidados: Array<{
        itemCompra: typeof compra.itens[0];
        quantidadeConferida: number;
        destinacao: 'CLIENTE' | 'PRONTA_ENTREGA';
        clienteId: string | null;
        itemContaId: string | null;
      }> = [];

      for (const itemInput of itens_conferidos) {
        if (!itemInput || !itemInput.item_compra_id) {
          return reply.status(400).type('application/problem+json').send(
            createProblemDetails(
              400,
              'ITEM_INVALIDO',
              'Item Inválido',
              'Cada item de conferência deve indicar o item_compra_id.'
            )
          );
        }

        const itemCompra = mapaItensCompra.get(itemInput.item_compra_id.trim());
        if (!itemCompra) {
          return reply.status(404).type('application/problem+json').send(
            createProblemDetails(
              404,
              'ITEM_COMPRA_NAO_ENCONTRADO',
              'Item Não Pertence a esta Compra',
              `O item ${itemInput.item_compra_id} não pertence à compra informada.`
            )
          );
        }

        const qtd = itemInput.quantidade;
        if (!Number.isInteger(qtd) || qtd <= 0) {
          return reply.status(400).type('application/problem+json').send(
            createProblemDetails(
              400,
              'QUANTIDADE_INVALIDA',
              'Quantidade Inválida',
              `A quantidade conferida para o produto "${itemCompra.produto.nome}" deve ser um número inteiro maior que zero.`
            )
          );
        }

        const pendente = itemCompra.quantidade - itemCompra.quantidade_recebida;
        if (qtd > pendente) {
          return reply.status(400).type('application/problem+json').send(
            createProblemDetails(
              400,
              'EXCEDENTE_NAO_PERMITIDO',
              'Quantidade Excedente Não Permitida',
              `Não é permitido conferir ${qtd} un para "${itemCompra.produto.nome}". O saldo pendente da compra é de apenas ${pendente} un.`
            )
          );
        }

        const destinacaoFinal = itemInput.destinacao || (itemCompra.destinacao as any);
        const clienteIdFinal = itemInput.cliente_id || itemCompra.cliente_id;
        const itemContaIdFinal = itemInput.item_conta_id || itemCompra.item_conta_id;

        itensValidados.push({
          itemCompra,
          quantidadeConferida: qtd,
          destinacao: destinacaoFinal,
          clienteId: clienteIdFinal,
          itemContaId: itemContaIdFinal
        });
      }

      // 5. Transação Atômica de Atualização de Estoque, Compra e Idempotência (AD-3, AD-7, NFR-001)
      const resultadoConferencia = await (fastify.prisma as any).$transaction(async (tx: any) => {
        const movimentacoesRegistradas: any[] = [];
        const itensAtualizados: any[] = [];

        for (const validado of itensValidados) {
          const { itemCompra, quantidadeConferida, destinacao, clienteId, itemContaId } = validado;

          // A. Atualiza quantidade_recebida no ItemCompraMarca
          const itemAtualizado = await tx.itemCompraMarca.update({
            where: { id: itemCompra.id },
            data: {
              quantidade_recebida: itemCompra.quantidade_recebida + quantidadeConferida
            }
          });
          itensAtualizados.push(itemAtualizado);

          // B. Obter ou Criar EstoqueItem (Invariante AD-3: Presentes = Reservados + ProntaEntrega)
          await travarEstoque(tx, session.operacaoId, itemCompra.produto_id);
          let estoque = await tx.estoqueItem.findUnique({
            where: {
              operacao_id_produto_id: {
                operacao_id: session.operacaoId,
                produto_id: itemCompra.produto_id
              }
            }
          });

          if (!estoque) {
            estoque = await tx.estoqueItem.create({
              data: {
                id: gerarUuidV7(),
                operacao_id: session.operacaoId,
                produto_id: itemCompra.produto_id,
                presentes: 0,
                reservados: 0,
                pronta_entrega: 0
              }
            });
          }

          const presentesAnterior = estoque.presentes;
          const reservadosAnterior = estoque.reservados;
          const prontaEntregaAnterior = estoque.pronta_entrega;

          // Entrada física de frascos na mesa/estante: presentes sempre soma a quantidade conferida
          const presentesPosterior = presentesAnterior + quantidadeConferida;
          let reservadosPosterior = reservadosAnterior;
          let prontaEntregaPosterior = prontaEntregaAnterior;

          if (destinacao === 'CLIENTE' && clienteId) {
            // Reserva física nominal para cliente (FR-022, Story 3.2):
            // O frasco está presente mas reservado para a dona
            reservadosPosterior = reservadosAnterior + quantidadeConferida;

            // Atualiza status do ItemConta para RESERVADO_PRESENTE
            if (itemContaId) {
              await tx.itemConta.update({
                where: { id: itemContaId },
                data: { status_entrega: 'RESERVADO_PRESENTE' }
              });
            }
          } else {
            // Destinação pronta-entrega: frasco disponível livremente para venda
            prontaEntregaPosterior = prontaEntregaAnterior + quantidadeConferida;
          }

          // Checagem estrita da invariante física AD-3
          if (presentesPosterior !== reservadosPosterior + prontaEntregaPosterior) {
            throw new Error(
              `Violação de Invariante de Estoque (AD-3): Presentes (${presentesPosterior}) != Reservados (${reservadosPosterior}) + ProntaEntrega (${prontaEntregaPosterior})`
            );
          }

          // Atualiza registro no estoque
          await tx.estoqueItem.update({
            where: { id: estoque.id },
            data: {
              presentes: presentesPosterior,
              reservados: reservadosPosterior,
              pronta_entrega: prontaEntregaPosterior
            }
          });

          // Registra movimentação de estoque
          const mov = await tx.movimentacaoEstoque.create({
            data: {
              id: gerarUuidV7(),
              operacao_id: session.operacaoId,
              produto_id: itemCompra.produto_id,
              estoque_item_id: estoque.id,
              tipo: 'ENTRADA_COMPRA_MARCA',
              quantidade: quantidadeConferida,
              presentes_anterior: presentesAnterior,
              presentes_posterior: presentesPosterior,
              reservados_anterior: reservadosAnterior,
              reservados_posterior: reservadosPosterior,
              pronta_entrega_anterior: prontaEntregaAnterior,
              pronta_entrega_posterior: prontaEntregaPosterior,
              compra_id: compra.id,
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              detalhes: JSON.stringify({
                produto_nome: itemCompra.produto.nome,
                destinacao,
                cliente_id: clienteId,
                compra_id: compra.id
              })
            }
          });
          movimentacoesRegistradas.push(mov);
        }

        // C. Atualiza status geral da CompraMarca
        const itensTotais = await tx.itemCompraMarca.findMany({
          where: { compra_id: compra.id }
        });
        const todosRecebidos = itensTotais.every(
          (it: any) => (it.quantidade_recebida + (it.quantidade_cancelada_falta || 0)) >= it.quantidade
        );
        const novoStatusCompra = todosRecebidos ? 'CONFERIDA' : 'CONFERENCIA_EM_ANDAMENTO';

        const compraAtualizada = await tx.compraMarca.update({
          where: { id: compra.id },
          data: { status: novoStatusCompra }
        });

        // D. Registro de Auditoria nominal (NFR-003, AD-1)
        await tx.registroAuditoria.create({
          data: {
            id: gerarUuidV7(),
            operacao_id: session.operacaoId,
            operador_id: session.operadorId,
            operador_nome: session.operadorNome,
            acao: 'CONFERIR_COMPRA_MARCA',
            detalhes: JSON.stringify({
              compra_id: compra.id,
              marca_id: compra.marca_id,
              marca_nome: compra.marca.nome,
              novo_status: novoStatusCompra,
              total_itens_conferidos: itensValidados.reduce((acc, i) => acc + i.quantidadeConferida, 0),
              idempotency_key: chaveNormalizada
            })
          }
        });

        // E. Resposta a ser retornada e cacheada
        const respostaPayload = {
          compra_id: compraAtualizada.id,
          status_compra: compraAtualizada.status,
          total_itens_conferidos_neste_lote: itensValidados.reduce(
            (acc, i) => acc + i.quantidadeConferida,
            0
          ),
          conferencia_concluida: todosRecebidos,
          itens_conferidos: itensValidados.map((v) => ({
            item_compra_id: v.itemCompra.id,
            produto_id: v.itemCompra.produto_id,
            produto_nome: v.itemCompra.produto.nome,
            quantidade_conferida: v.quantidadeConferida,
            destinacao: v.destinacao,
            cliente_id: v.clienteId
          }))
        };

        // F. Salvar Registro de Idempotência (AD-7)
        await tx.registroIdempotencia.create({
          data: {
            id: gerarUuidV7(),
            operacao_id: session.operacaoId,
            chave: chaveNormalizada,
            recurso: 'CONFERENCIA_COMPRA',
            status_code: 200,
            resposta_json: JSON.stringify(respostaPayload)
          }
        });

        return respostaPayload;
      });

      return reply.status(200).send(resultadoConferencia);
    }
  );

  // POST /api/compras-marca/:id/falta-fabrica - Tratamento de falta definitiva da fábrica com ajuste contábil (FR-024, Refinamento Elicitação, AD-5, AD-7)
  fastify.post<{
    Params: { id: string };
    Body: {
      idempotency_key?: string;
      item_compra_id: string;
      quantidade_em_falta: number;
      motivo?: string;
    };
  }>(
    '/api/compras-marca/:id/falta-fabrica',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const session = request.session!;

      // 1. Idempotência (AD-7)
      const idempotencyKey =
        request.body?.idempotency_key ||
        (request.headers['idempotency-key'] as string) ||
        (request.headers['x-idempotency-key'] as string);

      if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'IDEMPOTENCY_KEY_OBRIGATORIA',
            'Chave de Idempotência Obrigatória',
            'O registro de falta da fábrica exige o envio de uma chave de idempotência válida (AD-7).'
          )
        );
      }

      const chaveNormalizada = idempotencyKey.trim();

      // 2. Consulta de Idempotência prévia
      const registroExistente = await request.tenantPrisma.registroIdempotencia.findFirst({
        where: { chave: chaveNormalizada }
      });

      if (registroExistente) {
        return reply
          .status(registroExistente.status_code)
          .type('application/json')
          .send(JSON.parse(registroExistente.resposta_json));
      }

      // 3. Validação da Compra e Item
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
            'A compra informada não foi localizada nesta operação.'
          )
        );
      }

      if (compra.status === 'CANCELADA') {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'COMPRA_CANCELADA',
            'Compra Cancelada',
            'Não é possível registrar falta para compra cancelada.'
          )
        );
      }

      const { item_compra_id, quantidade_em_falta, motivo } = request.body || {};

      if (!item_compra_id || typeof item_compra_id !== 'string') {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'ITEM_OBRIGATORIO',
            'Item da Compra Obrigatório',
            'Informe o item_compra_id afetado pela falta de fábrica.'
          )
        );
      }

      const itemCompra = compra.itens.find((it) => it.id === item_compra_id.trim());
      if (!itemCompra) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'ITEM_NAO_ENCONTRADO',
            'Item Não Encontrado na Compra',
            'O item informado não pertence a este registro de compra.'
          )
        );
      }

      if (!Number.isInteger(quantidade_em_falta) || quantidade_em_falta <= 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'QUANTIDADE_INVALIDA',
            'Quantidade Inválida',
            'A quantidade em falta deve ser um número inteiro maior que zero.'
          )
        );
      }

      const faltaAtual = itemCompra.quantidade_cancelada_falta || 0;
      const pendenteReal = itemCompra.quantidade - itemCompra.quantidade_recebida - faltaAtual;

      if (quantidade_em_falta > pendenteReal) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'FALTA_EXCEDE_PENDENCIA',
            'Quantidade de Falta Excede Pendência',
            `Não é possível cancelar ${quantidade_em_falta} un em falta para "${itemCompra.produto.nome}". O saldo pendente é de apenas ${pendenteReal} un.`
          )
        );
      }

      // 4. Transação Atômica: cancelamento de saldo, sem baixa de estoque (AD-3), ajuste de conta de cliente e emissão de obrigação contábil (AD-5, FR-024)
      const resultadoFalta = await (fastify.prisma as any).$transaction(async (tx: any) => {
        // A. Atualiza ItemCompraMarca
        await tx.itemCompraMarca.update({
          where: { id: itemCompra.id },
          data: {
            quantidade_cancelada_falta: faltaAtual + quantidade_em_falta
          }
        });

        let ajusteContaCliente: any = null;
        let obrigacaoContabil: any = null;

        // B. Se for encomenda de cliente, ajustar ItemConta e Conta
        if (itemCompra.item_conta_id) {
          const itemConta = await tx.itemConta.findUnique({
            where: { id: itemCompra.item_conta_id },
            include: { conta: true }
          });

          if (itemConta) {
            // Atualiza status do ItemConta para CANCELADO_FALTA_FABRICA
            await tx.itemConta.update({
              where: { id: itemConta.id },
              data: {
                status_entrega: 'CANCELADO_FALTA_FABRICA'
              }
            });

            // Valor do item cancelado a abater da conta
            const valorAbatimentoCentavos = itemConta.preco_unitario_centavos * quantidade_em_falta;
            const contaAtual = itemConta.conta;
            const novoValorTotalConta = Math.max(0, contaAtual.valor_total - valorAbatimentoCentavos);

            // Verifica se a conta já tinha pagamentos registrados que agora superam o novo valor total (AD-5, FR-024)
            let excedenteCentavos = 0;
            if (contaAtual.total_pago > novoValorTotalConta) {
              excedenteCentavos = contaAtual.total_pago - novoValorTotalConta;
              obrigacaoContabil = {
                tipo: 'ESTORNO_OU_CREDITO_PENDENTE',
                cliente_id: contaAtual.cliente_id,
                conta_id: contaAtual.id,
                excedente_centavos: excedenteCentavos,
                excedente_formatado: `R$ ${(excedenteCentavos / 100).toFixed(2).replace('.', ',')}`,
                motivo: motivo || 'Falta comunicada pela fábrica em produto encomendado e já pago.'
              };

              // Registrar auditoria de obrigação contábil
              await tx.registroAuditoria.create({
                data: {
                  id: gerarUuidV7(),
                  operacao_id: session.operacaoId,
                  operador_id: session.operadorId,
                  operador_nome: session.operadorNome,
                  acao: 'OBRIGACAO_CONTABIL_EXCEDENTE_FALTA',
                  detalhes: JSON.stringify(obrigacaoContabil)
                }
              });

              // Criar entidade ExcedentePendente para resolução transparente (FR-038, AD-5)
              await tx.excedentePendente.create({
                data: {
                  id: gerarUuidV7(),
                  operacao_id: session.operacaoId,
                  conta_id: contaAtual.id,
                  cliente_id: contaAtual.cliente_id,
                  valor_centavos: excedenteCentavos,
                  origem: 'FALTA_FABRICA',
                  status: 'PENDENTE',
                  operador_id: session.operadorId,
                  operador_nome: session.operadorNome,
                  criado_em: new Date()
                }
              });
            }

            // Atualiza a Conta
            const novoStatusConta =
              novoValorTotalConta === 0
                ? 'QUITADA'
                : contaAtual.total_pago >= novoValorTotalConta
                ? 'QUITADA'
                : contaAtual.total_pago > 0
                ? 'PAGA_PARCIAL'
                : 'ABERTA';

            await tx.conta.update({
              where: { id: contaAtual.id },
              data: {
                valor_total: novoValorTotalConta,
                status: novoStatusConta
              }
            });

            ajusteContaCliente = {
              conta_id: contaAtual.id,
              cliente_id: contaAtual.cliente_id,
              valor_anterior_centavos: contaAtual.valor_total,
              valor_novo_centavos: novoValorTotalConta,
              abatimento_centavos: valorAbatimentoCentavos,
              excedente_centavos: excedenteCentavos
            };
          }
        }

        // C. Checar se a compra está totalmente concluída (todos os itens recebidos ou cancelados)
        const itensTotais = await tx.itemCompraMarca.findMany({
          where: { compra_id: compra.id }
        });
        const todosResolvidos = itensTotais.every(
          (it: any) => (it.quantidade_recebida + (it.quantidade_cancelada_falta || 0)) >= it.quantidade
        );
        const novoStatusCompra = todosResolvidos ? 'CONFERIDA' : 'CONFERENCIA_EM_ANDAMENTO';

        await tx.compraMarca.update({
          where: { id: compra.id },
          data: { status: novoStatusCompra }
        });

        // D. Auditoria nominal
        await tx.registroAuditoria.create({
          data: {
            id: gerarUuidV7(),
            operacao_id: session.operacaoId,
            operador_id: session.operadorId,
            operador_nome: session.operadorNome,
            acao: 'REGISTRAR_FALTA_FABRICA',
            detalhes: JSON.stringify({
              compra_id: compra.id,
              item_compra_id: itemCompra.id,
              produto_nome: itemCompra.produto.nome,
              quantidade_cancelada_falta: quantidade_em_falta,
              motivo: motivo || 'Falta comunicada pela fábrica',
              novo_status_compra: novoStatusCompra,
              ajuste_conta_cliente: ajusteContaCliente,
              obrigacao_contabil: obrigacaoContabil
            })
          }
        });

        // E. Resposta a persistir no registro de idempotência
        const respostaPayload = {
          compra_id: compra.id,
          status_compra: novoStatusCompra,
          item_compra_id: itemCompra.id,
          produto_nome: itemCompra.produto.nome,
          quantidade_cancelada_falta: quantidade_em_falta,
          quantidade_total_falta_item: faltaAtual + quantidade_em_falta,
          conferencia_concluida: todosResolvidos,
          ajuste_conta_cliente: ajusteContaCliente,
          obrigacao_contabil: obrigacaoContabil
        };

        await tx.registroIdempotencia.create({
          data: {
            id: gerarUuidV7(),
            operacao_id: session.operacaoId,
            chave: chaveNormalizada,
            recurso: 'FALTA_FABRICA_COMPRA',
            status_code: 200,
            resposta_json: JSON.stringify(respostaPayload)
          }
        });

        return respostaPayload;
      });

      return reply.status(200).send(resultadoFalta);
    }
  );
};

