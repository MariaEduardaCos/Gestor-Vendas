import type { FastifyPluginAsync } from 'fastify';
import {
  Produto,
  Centavos,
  gerarUuidV7,
  createProblemDetails,
  classificarCodigo,
  variantesCodigoBarras,
  digitoVerificadorValido,
  hojeNoFuso,
  type ProvenienciaCusto
} from '@consultorasync/core';
import { consultarCodigoOnline, consultaOnlineDisponivel, FontesIndisponiveis, imagemSegura } from '../services/consulta-online.js';

/** Limite diário de pesquisas online novas por operação (as fontes gratuitas têm cota pequena). */
const LIMITE_PESQUISAS_DIA = 40;
const pesquisasDoDia = new Map<string, { dia: string; quantidade: number }>();

/**
 * Situação do produto frente ao catálogo da marca: "fora do ciclo" quando veio de um catálogo
 * anterior e não apareceu no último carregado (produto cadastrado à mão não é marcado).
 */
function infoCiclo(p: { ciclo_catalogo: string | null; marca?: { catalogo_ciclo: string | null } | null }) {
  const cicloMarca = p.marca?.catalogo_ciclo ?? null;
  return {
    ciclo_catalogo: p.ciclo_catalogo,
    fora_do_ciclo: !!(p.ciclo_catalogo && cicloMarca && p.ciclo_catalogo !== cicloMarca)
  };
}

/** Filtro do Prisma para um código digitado: de barras (formas equivalentes) ou da revista. */
function filtroPorCodigo(entrada: string) {
  const c = classificarCodigo(entrada);
  if (c.tipo === 'BARRAS') return { codigo_barras: { in: variantesCodigoBarras(c.valor) } };
  if (c.tipo === 'REVISTA') return { codigo_revista: c.valor };
  return null;
}

interface ProdutoBody {
  marca_id?: string | null;
  nome: string;
  variante?: string | null;
  codigo_barras?: string | null;
  codigo_revista?: string | null;
  imagem_url?: string | null;
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
        codigo_revista,
        imagem_url,
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
          codigoRevista: codigo_revista,
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
          codigo_revista: produtoDomain.codigoRevista,
          imagem_url: imagemSegura(imagem_url),
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
        codigo_revista: produto.codigo_revista,
        imagem_url: produto.imagem_url,
        ...infoCiclo(produto),
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
        Object.assign(whereClause, filtroPorCodigo(codigoBarras) ?? { codigo_barras: codigoBarras });
      }

      if (marcaId && marcaId.length > 0) {
        whereClause.marca_id = marcaId;
      }

      if (termo.length > 0) {
        const porCodigo = filtroPorCodigo(termo);
        const soNumeros = termo.replace(/[\s.\-/]/g, '');
        whereClause.OR = [
          { nome: { contains: termo, mode: 'insensitive' } },
          { variante: { contains: termo, mode: 'insensitive' } },
          { codigo_barras: { contains: /^\d+$/.test(soNumeros) ? soNumeros : termo } },
          { codigo_revista: { contains: /^\d+$/.test(soNumeros) ? soNumeros : termo } },
          { marca: { nome: { contains: termo, mode: 'insensitive' } } },
          ...(porCodigo ? [porCodigo] : [])
        ];
      }

      const produtos = await request.tenantPrisma.produto.findMany({
        where: whereClause,
        include: {
          marca: true,
          itens_estoque: true
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

          const estoqueItem = p.itens_estoque?.[0];
          const estoque = {
            presentes: estoqueItem ? estoqueItem.presentes : 0,
            reservados: estoqueItem ? estoqueItem.reservados : 0,
            pronta_entrega: estoqueItem ? estoqueItem.pronta_entrega : 0
          };

          return {
            id: p.id,
            operacao_id: p.operacao_id,
            marca_id: p.marca_id,
            marca_nome: p.marca?.nome ?? null,
            nome: p.nome,
            variante: p.variante,
            codigo_barras: p.codigo_barras,
            codigo_revista: p.codigo_revista,
            imagem_url: p.imagem_url,
            ...infoCiclo(p),
            preco_venda_centavos: p.preco_venda_centavos,
            preco_venda_formatado: precoFormatado,
            custo_centavos: p.custo_centavos,
            custo_formatado: custoFormatado,
            proveniencia_custo: p.proveniencia_custo,
            estoque,
            criado_em: p.criado_em.toISOString(),
            atualizado_em: p.atualizado_em.toISOString()
          };
        })
      );
    }
  );

  // GET /api/produtos/consulta-online/:codigo - Pesquisa na internet um código de barras que
  // não está no banco: nome, marca, preço médio e foto, para preencher o cadastro (com revisão).
  fastify.get<{ Params: { codigo: string } }>(
    '/api/produtos/consulta-online/:codigo',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const problema = (status: number, tipo: string, titulo: string, detalhe: string) =>
        reply.status(status).type('application/problem+json').send(createProblemDetails(status, tipo, titulo, detalhe));

      const c = classificarCodigo(request.params.codigo);
      if (c.tipo !== 'BARRAS') {
        return problema(400, 'BAD_REQUEST', 'Código inválido', 'A pesquisa online funciona só com o código de barras da embalagem (8 a 14 números).');
      }
      if (!digitoVerificadorValido(c.valor)) {
        return problema(400, 'BAD_REQUEST', 'Código com erro', 'Este código de barras parece ter um número errado. Confira e tente de novo.');
      }
      if (!consultaOnlineDisponivel()) {
        return problema(503, 'SERVICE_UNAVAILABLE', 'Pesquisa indisponível', 'A pesquisa online está desligada neste servidor.');
      }

      const operacaoId = request.session!.operacaoId;
      const hoje = hojeNoFuso();
      const uso = pesquisasDoDia.get(operacaoId);
      const usadas = uso?.dia === hoje ? uso.quantidade : 0;

      try {
        // Código já guardado não gasta a cota; só bloqueia quando precisaria consultar as fontes de novo.
        const guardado = await fastify.prisma.consultaCodigoOnline.findUnique({ where: { codigo_barras: c.valor }, select: { codigo_barras: true } });
        if (!guardado && usadas >= LIMITE_PESQUISAS_DIA) {
          return problema(429, 'TOO_MANY_REQUESTS', 'Limite de pesquisas', `Você já fez ${LIMITE_PESQUISAS_DIA} pesquisas online hoje. Cadastre este produto à mão ou tente amanhã.`);
        }
        const resultado = await consultarCodigoOnline(fastify.prisma, c.valor, { buscador: fastify.buscadorOnline });
        if (!resultado.do_cache) pesquisasDoDia.set(operacaoId, { dia: hoje, quantidade: usadas + 1 });
        return reply.send({ codigo_barras: c.valor, encontrado: resultado.encontrado, do_cache: resultado.do_cache, ...(resultado.produto ?? {}) });
      } catch (e) {
        if (e instanceof FontesIndisponiveis) return problema(503, 'SERVICE_UNAVAILABLE', 'Pesquisa indisponível', e.message);
        throw e;
      }
    }
  );

  // GET /api/produtos/por-codigo/:codigo - Todos os produtos com este código de barras ou da revista
  // (o código da revista pode se repetir entre marcas; a tela mostra a lista para escolher)
  fastify.get<{ Params: { codigo: string } }>(
    '/api/produtos/por-codigo/:codigo',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const filtro = filtroPorCodigo(request.params.codigo || '');
      if (!filtro) return reply.send([]);
      const produtos = await request.tenantPrisma.produto.findMany({
        where: filtro,
        include: { marca: true, itens_estoque: true },
        orderBy: [{ nome: 'asc' }, { variante: 'asc' }],
        take: 20
      });
      return reply.send(
        produtos.map((p) => {
          const estoqueItem = p.itens_estoque?.[0];
          return {
            id: p.id,
            operacao_id: p.operacao_id,
            marca_id: p.marca_id,
            marca_nome: p.marca?.nome ?? null,
            nome: p.nome,
            variante: p.variante,
            codigo_barras: p.codigo_barras,
            codigo_revista: p.codigo_revista,
            imagem_url: p.imagem_url,
            ...infoCiclo(p),
            preco_venda_centavos: p.preco_venda_centavos,
            preco_venda_formatado: Centavos.deInteiro(p.preco_venda_centavos).paraFormatado(),
            custo_centavos: p.custo_centavos,
            custo_formatado: p.custo_centavos !== null ? Centavos.deInteiro(p.custo_centavos).paraFormatado() : 'Desconhecido',
            proveniencia_custo: p.proveniencia_custo,
            estoque: {
              presentes: estoqueItem?.presentes ?? 0,
              reservados: estoqueItem?.reservados ?? 0,
              pronta_entrega: estoqueItem?.pronta_entrega ?? 0
            },
            criado_em: p.criado_em.toISOString(),
            atualizado_em: p.atualizado_em.toISOString()
          };
        })
      );
    }
  );

  // GET /api/produtos/codigo/:codigo - Busca direta por código de barras ou da revista (primeiro encontrado)
  fastify.get<{ Params: { codigo: string } }>(
    '/api/produtos/codigo/:codigo',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { codigo } = request.params;
      const codigoNormalizado = (codigo || '').trim();
      const filtro = filtroPorCodigo(codigoNormalizado);

      const produto = filtro
        ? await request.tenantPrisma.produto.findFirst({
            where: filtro,
            include: {
              marca: true,
              itens_estoque: true
            }
          })
        : null;

      if (!produto) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Produto Não Encontrado',
            `Nenhum produto cadastrado com o código '${codigoNormalizado}' nesta operação.`
          )
        );
      }

      const precoFormatado = Centavos.deInteiro(produto.preco_venda_centavos).paraFormatado();
      const custoFormatado = produto.custo_centavos !== null
        ? Centavos.deInteiro(produto.custo_centavos).paraFormatado()
        : 'Desconhecido';

      const estoqueItem = produto.itens_estoque?.[0];
      const estoque = {
        presentes: estoqueItem ? estoqueItem.presentes : 0,
        reservados: estoqueItem ? estoqueItem.reservados : 0,
        pronta_entrega: estoqueItem ? estoqueItem.pronta_entrega : 0
      };

      return reply.status(200).send({
        id: produto.id,
        operacao_id: produto.operacao_id,
        marca_id: produto.marca_id,
        marca_nome: produto.marca?.nome ?? null,
        nome: produto.nome,
        variante: produto.variante,
        codigo_barras: produto.codigo_barras,
        codigo_revista: produto.codigo_revista,
        imagem_url: produto.imagem_url,
        ...infoCiclo(produto),
        preco_venda_centavos: produto.preco_venda_centavos,
        preco_venda_formatado: precoFormatado,
        custo_centavos: produto.custo_centavos,
        custo_formatado: custoFormatado,
        proveniencia_custo: produto.proveniencia_custo,
        estoque,
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
        codigo_revista: produto.codigo_revista,
        imagem_url: produto.imagem_url,
        ...infoCiclo(produto),
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
        codigo_revista,
        imagem_url,
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
          codigoRevista: existente.codigo_revista,
          precoVendaCentavos: existente.preco_venda_centavos,
          custoCentavos: existente.custo_centavos,
          provenienciaCusto: existente.proveniencia_custo as ProvenienciaCusto,
          criadoEm: existente.criado_em.toISOString(),
          atualizadoEm: existente.atualizado_em.toISOString()
        });

        if (codigo_revista !== undefined) produtoDomain.atualizar({ codigoRevista: codigo_revista });

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
          codigo_revista: produtoDomain.codigoRevista,
          ...(imagem_url !== undefined ? { imagem_url: imagemSegura(imagem_url) } : {}),
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
        codigo_revista: atualizado.codigo_revista,
        imagem_url: atualizado.imagem_url,
        ...infoCiclo(atualizado),
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

      const itensVinculados = await request.tenantPrisma.itemConta.count({
        where: { produto_id: id }
      });

      if (itensVinculados > 0) {
        return reply.status(409).type('application/problem+json').send(
          createProblemDetails(
            409,
            'CONFLICT',
            'Produto em Uso',
            'Este produto possui contas ou encomendas vinculadas e não pode ser excluído.'
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
