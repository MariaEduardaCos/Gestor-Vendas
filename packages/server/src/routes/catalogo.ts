import type { FastifyPluginAsync } from 'fastify';
import {
  Produto,
  gerarUuidV7,
  createProblemDetails,
  planejarImportacaoCatalogo,
  chaveProdutoCatalogo,
  normalizarTexto,
  classificarCodigo,
  variantesCodigoBarras,
  type LinhaCatalogo
} from '@consultorasync/core';
import type { PrismaClient } from '@prisma/client';

interface ImportarCatalogoBody {
  ciclo: string;
  itens: LinhaCatalogo[];
  /** true: só calcula a prévia, sem gravar nada. */
  simular?: boolean;
  /** Contribuir com o catálogo compartilhado (só nome, variante, código e preço). Padrão: sim. */
  compartilhar?: boolean;
}

const MAX_ITENS = 2000;

export const catalogoRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/marcas/:id/catalogo — carrega o catálogo do ciclo da marca (prévia ou aplicação)
  fastify.post<{ Params: { id: string }; Body: ImportarCatalogoBody }>(
    '/api/marcas/:id/catalogo',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const session = request.session!;
      const { ciclo, itens, simular, compartilhar = true } = request.body || ({} as ImportarCatalogoBody);
      const cicloLimpo = (ciclo ?? '').trim();

      const invalido = (detalhe: string) =>
        reply.status(400).type('application/problem+json').send(createProblemDetails(400, 'BAD_REQUEST', 'Catálogo inválido', detalhe));

      if (!cicloLimpo) return invalido('Informe o ciclo ou campanha do catálogo (ex.: "Ciclo 17/2026").');
      if (!Array.isArray(itens) || itens.length === 0) return invalido('O catálogo não tem nenhum produto.');
      if (itens.length > MAX_ITENS) return invalido(`O catálogo pode ter no máximo ${MAX_ITENS} produtos por vez.`);
      for (const [i, it] of itens.entries()) {
        if (!it?.nome?.trim() || !Number.isInteger(it.precoVendaCentavos) || it.precoVendaCentavos <= 0) {
          return invalido(`Produto ${i + 1}: nome e preço positivo em centavos são obrigatórios.`);
        }
      }

      const marca = await request.tenantPrisma.marca.findUnique({ where: { id: request.params.id } });
      if (!marca) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(404, 'MARCA_NAO_ENCONTRADA', 'Marca Não Encontrada', 'A marca não existe ou não pertence a esta operação.')
        );
      }

      const existentes = await request.tenantPrisma.produto.findMany({ where: { marca_id: marca.id } });
      const acoes = planejarImportacaoCatalogo(
        existentes.map((p) => ({
          id: p.id,
          nome: p.nome,
          variante: p.variante,
          codigoBarras: p.codigo_barras,
          codigoRevista: p.codigo_revista,
          precoVendaCentavos: p.preco_venda_centavos
        })),
        itens
      );

      // Produtos da marca que vieram de um catálogo e não aparecem neste: ficam "fora do ciclo".
      const tocados = new Set(acoes.flatMap((a) => (a.tipo === 'CRIAR' ? [] : [a.produtoId])));
      const foraDoCiclo = existentes.filter((p) => p.ciclo_catalogo && !tocados.has(p.id));

      const resumo = {
        ciclo: cicloLimpo,
        novos: acoes.filter((a) => a.tipo === 'CRIAR').length,
        precos_alterados: acoes.filter((a) => a.tipo === 'ATUALIZAR_PRECO').length,
        sem_mudanca: acoes.filter((a) => a.tipo === 'SEM_MUDANCA').length,
        fora_do_ciclo: foraDoCiclo.length,
        fora_do_ciclo_nomes: foraDoCiclo.slice(0, 20).map((p) => (p.variante ? `${p.nome} — ${p.variante}` : p.nome)),
        acoes: acoes.map((a) => ({
          tipo: a.tipo,
          nome: a.linha.nome,
          variante: a.linha.variante,
          codigo_barras: a.linha.codigoBarras,
          codigo_revista: a.linha.codigoRevista ?? null,
          preco_venda_centavos: a.linha.precoVendaCentavos,
          preco_anterior_centavos: a.tipo === 'ATUALIZAR_PRECO' ? a.precoAnteriorCentavos : null
        }))
      };

      if (simular) return reply.status(200).send({ ...resumo, aplicado: false });

      const porId = new Map(existentes.map((p) => [p.id, p]));
      const agora = new Date();

      await fastify.prisma.$transaction(async (tx) => {
        for (const acao of acoes) {
          const { linha } = acao;
          if (acao.tipo === 'CRIAR') {
            const novo = new Produto({
              operacaoId: session.operacaoId,
              marcaId: marca.id,
              nome: linha.nome,
              variante: linha.variante,
              codigoBarras: linha.codigoBarras,
              codigoRevista: linha.codigoRevista,
              precoVendaCentavos: linha.precoVendaCentavos,
              percentualDescontoMarca: marca.percentual_padrao
            });
            await tx.produto.create({
              data: {
                id: novo.id,
                operacao_id: session.operacaoId,
                marca_id: marca.id,
                nome: novo.nome,
                variante: novo.variante,
                codigo_barras: novo.codigoBarras,
                codigo_revista: novo.codigoRevista,
                preco_venda_centavos: novo.precoVendaCentavos,
                custo_centavos: novo.custoCentavos,
                proveniencia_custo: novo.provenienciaCusto,
                ciclo_catalogo: cicloLimpo
              }
            });
            continue;
          }

          const atual = porId.get(acao.produtoId)!;
          if (acao.tipo === 'SEM_MUDANCA') {
            await tx.produto.updateMany({
              where: { id: atual.id, operacao_id: session.operacaoId },
              data: {
                ciclo_catalogo: cicloLimpo,
                codigo_barras: atual.codigo_barras ?? linha.codigoBarras,
                codigo_revista: linha.codigoRevista ?? atual.codigo_revista
              }
            });
            continue;
          }

          // Preço novo: custo informado manualmente é mantido; estimativa é recalculada pelo percentual da marca.
          const custoManual = atual.proveniencia_custo === 'INFORMADO_MANUAL' ? atual.custo_centavos : null;
          const atualizado = new Produto({
            id: atual.id,
            operacaoId: session.operacaoId,
            marcaId: marca.id,
            nome: atual.nome,
            variante: atual.variante,
            codigoBarras: atual.codigo_barras ?? linha.codigoBarras,
            precoVendaCentavos: linha.precoVendaCentavos,
            custoManualCentavos: custoManual,
            percentualDescontoMarca: custoManual === null ? marca.percentual_padrao : null
          });
          await tx.produto.updateMany({
            where: { id: atual.id, operacao_id: session.operacaoId },
            data: {
              preco_venda_centavos: atualizado.precoVendaCentavos,
              custo_centavos: atualizado.custoCentavos,
              proveniencia_custo: atualizado.provenienciaCusto,
              codigo_barras: atualizado.codigoBarras,
              codigo_revista: linha.codigoRevista ?? atual.codigo_revista,
              ciclo_catalogo: cicloLimpo
            }
          });
        }

        await tx.marca.updateMany({
          where: { id: marca.id, operacao_id: session.operacaoId },
          data: { catalogo_ciclo: cicloLimpo, catalogo_atualizado_em: agora }
        });

        if (compartilhar) {
          await contribuirCatalogoCompartilhado(tx as unknown as PrismaClient, marca.nome, cicloLimpo, acoes.map((a) => a.linha));
        }

        await tx.registroAuditoria.create({
          data: {
            id: gerarUuidV7(),
            operacao_id: session.operacaoId,
            operador_id: session.operadorId,
            operador_nome: session.operadorNome,
            acao: 'IMPORTAR_CATALOGO_MARCA',
            detalhes: `Catálogo ${cicloLimpo} da marca ${marca.nome}: ${resumo.novos} novos, ${resumo.precos_alterados} preços alterados, ${resumo.sem_mudanca} sem mudança${compartilhar ? ', compartilhado' : ''}.`,
            criado_em: agora
          }
        });
      });

      return reply.status(200).send({ ...resumo, aplicado: true });
    }
  );

  // GET /api/marcas/:id/catalogo-compartilhado — lista de referência da marca, montada por outras revendedoras
  fastify.get<{ Params: { id: string } }>(
    '/api/marcas/:id/catalogo-compartilhado',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const marca = await request.tenantPrisma.marca.findUnique({ where: { id: request.params.id } });
      if (!marca) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(404, 'MARCA_NAO_ENCONTRADA', 'Marca Não Encontrada', 'A marca não existe ou não pertence a esta operação.')
        );
      }
      // Tabela global: consultada pelo cliente base, sem filtro de operação, e só com dados de revista.
      const refs = await fastify.prisma.produtoReferencia.findMany({
        where: { marca_chave: normalizarTexto(marca.nome) },
        orderBy: [{ nome: 'asc' }, { variante: 'asc' }]
      });
      const maisRecente = refs.reduce<(typeof refs)[number] | null>((m, r) => (!m || r.atualizado_em > m.atualizado_em ? r : m), null);
      return reply.send({
        marca_nome: marca.nome,
        ciclo: maisRecente?.ciclo ?? null,
        atualizado_em: maisRecente?.atualizado_em.toISOString() ?? null,
        quantidade: refs.length,
        itens: refs.map((r) => ({
          codigoBarras: r.codigo_barras,
          codigoRevista: r.codigo_revista,
          nome: r.nome,
          variante: r.variante,
          precoVendaCentavos: r.preco_sugerido_centavos
        }))
      });
    }
  );

  // GET /api/catalogo-compartilhado/codigo/:codigo — sugestão para código desconhecido.
  // Código de barras: busca em todas as marcas. Código da revista (curto, repete entre marcas):
  // só nas marcas que esta revendedora vende.
  fastify.get<{ Params: { codigo: string } }>(
    '/api/catalogo-compartilhado/codigo/:codigo',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const c = classificarCodigo(request.params.codigo);
      let refs;
      if (c.tipo === 'BARRAS') {
        refs = await fastify.prisma.produtoReferencia.findMany({ where: { codigo_barras: { in: variantesCodigoBarras(c.valor) } }, take: 5 });
      } else if (c.tipo === 'REVISTA') {
        const marcas = await request.tenantPrisma.marca.findMany({ select: { nome: true } });
        const chaves = marcas.map((m) => normalizarTexto(m.nome));
        refs = chaves.length
          ? await fastify.prisma.produtoReferencia.findMany({ where: { codigo_revista: c.valor, marca_chave: { in: chaves } }, take: 5 })
          : [];
      } else {
        return reply.send([]);
      }
      return reply.send(
        refs.map((r) => ({
          marca_nome: r.marca_nome,
          nome: r.nome,
          variante: r.variante,
          codigo_barras: r.codigo_barras,
          codigo_revista: r.codigo_revista,
          preco_sugerido_centavos: r.preco_sugerido_centavos,
          ciclo: r.ciclo
        }))
      );
    }
  );
};

/** Grava/atualiza a referência compartilhada da marca. Nunca leva dados da operação além do catálogo. */
export async function contribuirCatalogoCompartilhado(db: PrismaClient, marcaNome: string, ciclo: string, linhas: LinhaCatalogo[]) {
  const marcaChave = normalizarTexto(marcaNome);
  for (const l of linhas) {
    const chave = chaveProdutoCatalogo(l);
    await db.produtoReferencia.upsert({
      where: { marca_chave_chave: { marca_chave: marcaChave, chave } },
      create: {
        id: gerarUuidV7(),
        marca_chave: marcaChave,
        marca_nome: marcaNome,
        chave,
        nome: l.nome,
        variante: l.variante,
        codigo_barras: l.codigoBarras,
        codigo_revista: l.codigoRevista ?? null,
        preco_sugerido_centavos: l.precoVendaCentavos,
        ciclo
      },
      update: {
        nome: l.nome,
        variante: l.variante,
        ...(l.codigoRevista ? { codigo_revista: l.codigoRevista } : {}),
        preco_sugerido_centavos: l.precoVendaCentavos,
        ciclo,
        contribuicoes: { increment: 1 }
      }
    });
  }
}
