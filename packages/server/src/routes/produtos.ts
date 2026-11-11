import type { FastifyPluginAsync } from 'fastify';
import {
  Produto,
  Centavos,
  gerarUuidV7,
  createProblemDetails,
  type ProvenienciaCusto
} from '@consultorasync/core';

interface ProdutoBody {
  marca_id?: string | null;
  nome: string;
  variante?: string | null;
  codigo_barras?: string | null;
  preco_venda_centavos: number;
  custo_manual_centavos?: number | null;
  custo_centavos?: number | null;
  proveniencia_custo?: ProvenienciaCusto;
}

interface ProdutosQuery {
  busca?: string;
  q?: string;
  codigo_barras?: string;
  marca_id?: string;
}

export const produtosRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/produtos - Cadastrar produto ou variante com cálculo dinâmico de custo
  fastify.post<{ Body: ProdutoBody }>(
    '/api/produtos',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const {
        marca_id,
        nome,
        variante,
        codigo_barras,
        preco_venda_centavos,
        custo_manual_centavos,
        custo_centavos,
        proveniencia_custo
      } = request.body || {};
      const session = request.session!;

      let marcaPercentualPadrao: number | null = null;
      let marcaNome: string | null = null;

      if (marca_id && marca_id.trim().length > 0) {
        const marca = await request.tenantPrisma.marca.findUnique({
          where: { id: marca_id.trim() }
        });

        if (!marca) {
          return reply.status(404).type('application/problem+json').send(
            createProblemDetails(
              404,
              'MARCA_NAO_ENCONTRADA',
              'Marca Não Encontrada',
              'A marca selecionada não foi encontrada ou não pertence a esta operação.'
            )
          );
        }

        marcaPercentualPadrao = marca.percentual_padrao;
        marcaNome = marca.nome;
      }

      let produtoDomain: Produto;
      try {
        produtoDomain = new Produto({
          id: gerarUuidV7(),
          operacaoId: session.operacaoId,
          marcaId: marca_id,
          nome,
          variante,
          codigoBarras: codigo_barras,
          precoVendaCentavos: preco_venda_centavos,
          custoManualCentavos: custo_manual_centavos,
          percentualDescontoMarca: marcaPercentualPadrao,
          custoCentavos: custo_centavos,
          provenienciaCusto: proveniencia_custo
        });
      } catch (err: any) {
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Dados Inválidos', err.message || 'Erro ao validar produto.')
        );
      }

      const produto = await request.tenantPrisma.produto.create({
        data: {
          id: produtoDomain.id,
          operacao_id: session.operacaoId,
          marca_id: produtoDomain.marcaId,
          nome: produtoDomain.nome,
          variante: produtoDomain.variante,
          codigo_barras: produtoDomain.codigoBarras,
          preco_venda_centavos: produtoDomain.precoVendaCentavos,
          custo_centavos: produtoDomain.custoCentavos,
          proveniencia_custo: produtoDomain.provenienciaCusto,
          criado_em: new Date(produtoDomain.criadoEm),
          atualizado_em: new Date(produtoDomain.atualizadoEm)
        },
        include: {
          marca: true
        }
      });

      // Auditoria nominal com operador e timestamp UTC (NFR-003)
      await request.tenantPrisma.registroAuditoria.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: session.operacaoId,
          operador_id: session.operadorId,
          operador_nome: session.operadorNome,
          acao: 'CADASTRAR_PRODUTO',
          detalhes: `Cadastro de produto: ${produto.nome}${produto.variante ? ` (${produto.variante})` : ''} - Preço: ${produtoDomain.precoVendaFormatado} - Custo: ${produtoDomain.custoFormatado} (${produto.proveniencia_custo}) (ID: ${produto.id})`,
          criado_em: new Date()
        }
      });

      return reply.status(201).send({
        id: produto.id,
        operacao_id: produto.operacao_id,
        marca_id: produto.marca_id,
        marca_nome: produto.marca?.nome ?? marcaNome,
        nome: produto.nome,
        variante: produto.variante,
        codigo_barras: produto.codigo_barras,
        preco_venda_centavos: produto.preco_venda_centavos,
        preco_venda_formatado: produtoDomain.precoVendaFormatado,
        custo_centavos: produto.custo_centavos,
        custo_formatado: produtoDomain.custoFormatado,
        proveniencia_custo: produto.proveniencia_custo,
        criado_em: produto.criado_em.toISOString(),
        atualizado_em: produto.atualizado_em.toISOString()
      });
    }
  );

  // GET /api/produtos - Listagem e busca de produtos no catálogo (< 2s)
  fastify.get<{ Querystring: ProdutosQuery }>(
    '/api/produtos',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const termo = (request.query.busca || request.query.q || '').trim();
      const codigoBarras = request.query.codigo_barras?.trim();
      const marcaId = request.query.marca_id?.trim();

      const whereClause: any = {};

      if (codigoBarras && codigoBarras.length > 0) {
        whereClause.codigo_barras = codigoBarras;
      }

      if (marcaId && marcaId.length > 0) {
        whereClause.marca_id = marcaId;
      }

      if (termo.length > 0) {
        whereClause.OR = [
          { nome: { contains: termo } },
          { variante: { contains: termo } },
          { codigo_barras: { contains: termo } },
          { marca: { nome: { contains: termo } } }
        ];
      }

      const produtos = await request.tenantPrisma.produto.findMany({
        where: whereClause,
        include: {
          marca: true
        },
        orderBy: [
          { nome: 'asc' },
          { variante: 'asc' }
        ]
      });

      return reply.status(200).send(
        produtos.map((p) => {
          const precoFormatado = Centavos.deInteiro(p.preco_venda_centavos).paraFormatado();
          const custoFormatado = p.custo_centavos !== null
            ? Centavos.deInteiro(p.custo_centavos).paraFormatado()
            : 'Desconhecido';

          return {
            id: p.id,
            operacao_id: p.operacao_id,
            marca_id: p.marca_id,
            marca_nome: p.marca?.nome ?? null,
            nome: p.nome,
            variante: p.variante,
            codigo_barras: p.codigo_barras,
            preco_venda_centavos: p.preco_venda_centavos,
            preco_venda_formatado: precoFormatado,
            custo_centavos: p.custo_centavos,
            custo_formatado: custoFormatado,
            proveniencia_custo: p.proveniencia_custo,
            criado_em: p.criado_em.toISOString(),
            atualizado_em: p.atualizado_em.toISOString()
          };
        })
      );
    }
  );

  // GET /api/produtos/codigo/:codigo - Busca direta por código de barras (milissegundos)
  fastify.get<{ Params: { codigo: string } }>(
    '/api/produtos/codigo/:codigo',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { codigo } = request.params;
      const codigoNormalizado = (codigo || '').trim();

      const produto = await request.tenantPrisma.produto.findFirst({
        where: {
          codigo_barras: codigoNormalizado
        },
        include: {
          marca: true
        }
      });

      if (!produto) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Produto Não Encontrado',
            `Nenhum produto cadastrado com o código de barras '${codigoNormalizado}' nesta operação.`
          )
        );
      }

      const precoFormatado = Centavos.deInteiro(produto.preco_venda_centavos).paraFormatado();
      const custoFormatado = produto.custo_centavos !== null
        ? Centavos.deInteiro(produto.custo_centavos).paraFormatado()
        : 'Desconhecido';

      return reply.status(200).send({
        id: produto.id,
        operacao_id: produto.operacao_id,
        marca_id: produto.marca_id,
        marca_nome: produto.marca?.nome ?? null,
        nome: produto.nome,
        variante: produto.variante,
        codigo_barras: produto.codigo_barras,
        preco_venda_centavos: produto.preco_venda_centavos,
        preco_venda_formatado: precoFormatado,
        custo_centavos: produto.custo_centavos,
        custo_formatado: custoFormatado,
        proveniencia_custo: produto.proveniencia_custo,
        criado_em: produto.criado_em.toISOString(),
        atualizado_em: produto.atualizado_em.toISOString()
      });
    }
  );

  // GET /api/produtos/:id - Obter detalhes do produto por ID
  fastify.get<{ Params: { id: string } }>(
    '/api/produtos/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;

      const produto = await request.tenantPrisma.produto.findUnique({
        where: { id },
        include: {
          marca: true
        }
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

      const precoFormatado = Centavos.deInteiro(produto.preco_venda_centavos).paraFormatado();
      const custoFormatado = produto.custo_centavos !== null
        ? Centavos.deInteiro(produto.custo_centavos).paraFormatado()
        : 'Desconhecido';

      return reply.status(200).send({
        id: produto.id,
        operacao_id: produto.operacao_id,
        marca_id: produto.marca_id,
        marca_nome: produto.marca?.nome ?? null,
        nome: produto.nome,
        variante: produto.variante,
        codigo_barras: produto.codigo_barras,
        preco_venda_centavos: produto.preco_venda_centavos,
        preco_venda_formatado: precoFormatado,
        custo_centavos: produto.custo_centavos,
        custo_formatado: custoFormatado,
        proveniencia_custo: produto.proveniencia_custo,
        criado_em: produto.criado_em.toISOString(),
        atualizado_em: produto.atualizado_em.toISOString()
      });
    }
  );

  // PUT /api/produtos/:id - Editar produto/variante e atualizar precificação
  fastify.put<{ Params: { id: string }; Body: ProdutoBody & { recalcular_custo_por_marca?: boolean } }>(
    '/api/produtos/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const {
        marca_id,
        nome,
        variante,
        codigo_barras,
        preco_venda_centavos,
        custo_manual_centavos,
        custo_centavos,
        proveniencia_custo,
        recalcular_custo_por_marca
      } = request.body || {};
      const session = request.session!;

      const existente = await request.tenantPrisma.produto.findUnique({
        where: { id },
        include: {
          marca: true
        }
      });

      if (!existente) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Produto Não Encontrado',
            'O produto solicitado não existe ou não pertence a esta operação.'
          )
        );
      }

      let marcaPercentualPadrao = existente.marca?.percentual_padrao ?? null;
      let novaMarcaId = existente.marca_id;

      if (marca_id !== undefined) {
        novaMarcaId = marca_id && marca_id.trim().length > 0 ? marca_id.trim() : null;
        if (novaMarcaId) {
          const marca = await request.tenantPrisma.marca.findUnique({
            where: { id: novaMarcaId }
          });
          if (!marca) {
            return reply.status(404).type('application/problem+json').send(
              createProblemDetails(
                404,
                'MARCA_NAO_ENCONTRADA',
                'Marca Não Encontrada',
                'A marca selecionada não foi encontrada ou não pertence a esta operação.'
              )
            );
          }
          marcaPercentualPadrao = marca.percentual_padrao;
        } else {
          marcaPercentualPadrao = null;
        }
      }

      let produtoDomain: Produto;
      try {
        produtoDomain = new Produto({
          id: existente.id,
          operacaoId: existente.operacao_id,
          marcaId: existente.marca_id,
          nome: existente.nome,
          variante: existente.variante,
          codigoBarras: existente.codigo_barras,
          precoVendaCentavos: existente.preco_venda_centavos,
          custoCentavos: existente.custo_centavos,
          provenienciaCusto: existente.proveniencia_custo as ProvenienciaCusto,
          criadoEm: existente.criado_em.toISOString(),
          atualizadoEm: existente.atualizado_em.toISOString()
        });

        const novoPreco = preco_venda_centavos ?? existente.preco_venda_centavos;

        if (custo_manual_centavos !== undefined && custo_manual_centavos !== null) {
          produtoDomain.atualizar({
            nome,
            marcaId: novaMarcaId,
            variante,
            codigoBarras: codigo_barras,
            precoVendaCentavos: novoPreco,
            custoManualCentavos: custo_manual_centavos
          });
        } else if (custo_manual_centavos === null) {
          produtoDomain.atualizar({
            nome,
            marcaId: novaMarcaId,
            variante,
            codigoBarras: codigo_barras,
            precoVendaCentavos: novoPreco,
            custoManualCentavos: null,
            percentualDescontoMarca: marcaPercentualPadrao
          });
        } else if (custo_centavos !== undefined && proveniencia_custo !== undefined) {
          produtoDomain.atualizar({
            nome,
            marcaId: novaMarcaId,
            variante,
            codigoBarras: codigo_barras,
            precoVendaCentavos: novoPreco,
            custoCentavos: custo_centavos,
            provenienciaCusto: proveniencia_custo
          });
        } else {
          // Nenhum parâmetro de custo passado na requisição:
          // Se o produto já possuía custo manual, preserva o custo manual existente
          if (existente.proveniencia_custo === 'INFORMADO_MANUAL') {
            produtoDomain.atualizar({
              nome,
              marcaId: novaMarcaId,
              variante,
              codigoBarras: codigo_barras,
              precoVendaCentavos: novoPreco,
              custoManualCentavos: existente.custo_centavos
            });
          } else if (existente.proveniencia_custo === 'ESTIMADO_PERCENTUAL') {
            // Se o preço mudou ou a marca mudou, recalcula usando o desconto da marca
            produtoDomain.atualizar({
              nome,
              marcaId: novaMarcaId,
              variante,
              codigoBarras: codigo_barras,
              precoVendaCentavos: novoPreco,
              percentualDescontoMarca: marcaPercentualPadrao
            });
          } else {
            // Se era DESCONHECIDO, só calcula se uma nova marca com percentual foi associada
            if (marca_id !== undefined && marcaPercentualPadrao !== null) {
              produtoDomain.atualizar({
                nome,
                marcaId: novaMarcaId,
                variante,
                codigoBarras: codigo_barras,
                precoVendaCentavos: novoPreco,
                percentualDescontoMarca: marcaPercentualPadrao
              });
            } else {
              produtoDomain.atualizar({
                nome,
                marcaId: novaMarcaId,
                variante,
                codigoBarras: codigo_barras,
                precoVendaCentavos: novoPreco
              });
            }
          }
        }
      } catch (err: any) {
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Dados Inválidos', err.message || 'Erro ao atualizar produto.')
        );
      }

      const atualizado = await request.tenantPrisma.produto.update({
        where: { id },
        data: {
          nome: produtoDomain.nome,
          marca_id: produtoDomain.marcaId,
          variante: produtoDomain.variante,
          codigo_barras: produtoDomain.codigoBarras,
          preco_venda_centavos: produtoDomain.precoVendaCentavos,
          custo_centavos: produtoDomain.custoCentavos,
          proveniencia_custo: produtoDomain.provenienciaCusto,
          atualizado_em: new Date()
        },
        include: {
          marca: true
        }
      });

      // Auditoria nominal com operador e timestamp UTC
      await request.tenantPrisma.registroAuditoria.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: session.operacaoId,
          operador_id: session.operadorId,
          operador_nome: session.operadorNome,
          acao: 'EDITAR_PRODUTO',
          detalhes: `Edição de produto: ${atualizado.nome}${atualizado.variante ? ` (${atualizado.variante})` : ''} - Preço: ${produtoDomain.precoVendaFormatado} - Custo: ${produtoDomain.custoFormatado} (${atualizado.proveniencia_custo}) (ID: ${atualizado.id})`,
          criado_em: new Date()
        }
      });

      return reply.status(200).send({
        id: atualizado.id,
        operacao_id: atualizado.operacao_id,
        marca_id: atualizado.marca_id,
        marca_nome: atualizado.marca?.nome ?? null,
        nome: atualizado.nome,
        variante: atualizado.variante,
        codigo_barras: atualizado.codigo_barras,
        preco_venda_centavos: atualizado.preco_venda_centavos,
        preco_venda_formatado: produtoDomain.precoVendaFormatado,
        custo_centavos: atualizado.custo_centavos,
        custo_formatado: produtoDomain.custoFormatado,
        proveniencia_custo: atualizado.proveniencia_custo,
        criado_em: atualizado.criado_em.toISOString(),
        atualizado_em: atualizado.atualizado_em.toISOString()
      });
    }
  );

  // DELETE /api/produtos/:id - Excluir produto
  fastify.delete<{ Params: { id: string } }>(
    '/api/produtos/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const session = request.session!;

      const existente = await request.tenantPrisma.produto.findUnique({
        where: { id }
      });

      if (!existente) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Produto Não Encontrado',
            'O produto solicitado não existe ou não pertence a esta operação.'
          )
        );
      }

      await request.tenantPrisma.produto.delete({
        where: { id }
      });

      // Auditoria de exclusão
      await request.tenantPrisma.registroAuditoria.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: session.operacaoId,
          operador_id: session.operadorId,
          operador_nome: session.operadorNome,
          acao: 'EXCLUIR_PRODUTO',
          detalhes: `Exclusão de produto: ${existente.nome}${existente.variante ? ` (${existente.variante})` : ''} (ID: ${existente.id})`,
          criado_em: new Date()
        }
      });

      return reply.status(200).send({
        id: existente.id,
        sucesso: true,
        mensagem: 'Produto excluído com sucesso.'
      });
    }
  );
};
