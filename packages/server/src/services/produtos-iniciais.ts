import type { PrismaClient } from '@prisma/client';
import { Produto, gerarUuidV7, normalizarTexto } from '@consultorasync/core';
import { imagemSegura } from './consulta-online.js';

/** Quantos produtos de cada marca entram numa conta nova. */
export const PRODUTOS_INICIAIS_POR_MARCA = 60;

export interface MarcaInicialDisponivel {
  marca: string;
  produtos: number;
}

/** Marcas com catálogo oficial ordenado (as que podem ser oferecidas no cadastro). */
export async function marcasIniciaisDisponiveis(db: PrismaClient): Promise<MarcaInicialDisponivel[]> {
  const grupos = await db.produtoReferencia.groupBy({
    by: ['marca_nome'],
    where: { origem: 'OFICIAL', posicao: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } }
  });
  return grupos.map((g) => ({ marca: g.marca_nome, produtos: Math.min(g._count._all, PRODUTOS_INICIAIS_POR_MARCA) }));
}

/**
 * Cria as marcas escolhidas na conta nova e já cadastra os produtos mais vendidos de cada uma,
 * na ordem da vitrine da marca (o catálogo oficial mais recente). Marcas sem catálogo são ignoradas.
 * Devolve quantos produtos entraram por marca.
 */
export async function carregarProdutosIniciais(
  db: PrismaClient,
  operacaoId: string,
  marcasEscolhidas: string[]
): Promise<Record<string, number>> {
  const resultado: Record<string, number> = {};
  const chaves = [...new Set(marcasEscolhidas.map((m) => normalizarTexto(m)).filter(Boolean))];

  for (const marcaChave of chaves) {
    // Campanha oficial mais recente da marca
    const ultimo = await db.produtoReferencia.findFirst({
      where: { marca_chave: marcaChave, origem: 'OFICIAL', posicao: { not: null } },
      orderBy: { atualizado_em: 'desc' },
      select: { ciclo: true, marca_nome: true }
    });
    if (!ultimo) continue;

    const referencias = await db.produtoReferencia.findMany({
      where: { marca_chave: marcaChave, origem: 'OFICIAL', ciclo: ultimo.ciclo, posicao: { not: null } },
      orderBy: { posicao: 'asc' },
      take: PRODUTOS_INICIAIS_POR_MARCA
    });

    await db.$transaction(async (tx) => {
      const marcaId = gerarUuidV7();
      await tx.marca.create({ data: { id: marcaId, operacao_id: operacaoId, nome: ultimo.marca_nome } });
      for (const r of referencias) {
        const p = new Produto({
          operacaoId,
          marcaId,
          nome: r.nome,
          variante: r.variante,
          codigoBarras: r.codigo_barras,
          codigoRevista: r.codigo_revista,
          precoVendaCentavos: r.preco_sugerido_centavos,
          percentualDescontoMarca: null
        });
        await tx.produto.create({
          data: {
            id: p.id,
            operacao_id: operacaoId,
            marca_id: marcaId,
            nome: p.nome,
            variante: p.variante,
            codigo_barras: p.codigoBarras,
            codigo_revista: p.codigoRevista,
            imagem_url: imagemSegura(r.imagem_url),
            preco_venda_centavos: p.precoVendaCentavos,
            custo_centavos: p.custoCentavos,
            proveniencia_custo: p.provenienciaCusto,
            ciclo_catalogo: r.ciclo
          }
        });
      }
    }, { timeout: 60_000, maxWait: 10_000 });

    resultado[ultimo.marca_nome] = referencias.length;
  }
  return resultado;
}
