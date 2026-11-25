import type { PrismaClient } from '@prisma/client';
import { chaveProdutoCatalogo, gerarUuidV7, normalizarTexto, type LinhaCatalogo } from '@consultorasync/core';

export interface ResumoCargaOficial {
  marca: string;
  ciclo: string;
  criados: number;
  atualizados: number;
  total: number;
}

/**
 * Carga oficial da campanha de uma marca no catálogo de referência (vale para todas as
 * revendedoras). Feita pela administração do sistema, uma vez por ciclo.
 * Guarda só dados de revista: códigos, nome, variante, preço e foto.
 */
export async function carregarCatalogoOficial(
  db: PrismaClient,
  marcaNome: string,
  ciclo: string,
  linhas: Array<LinhaCatalogo & { imagemUrl?: string | null }>
): Promise<ResumoCargaOficial> {
  const marca = marcaNome.trim();
  const cicloLimpo = ciclo.trim();
  if (!marca) throw new Error('Informe a marca.');
  if (!cicloLimpo) throw new Error('Informe o ciclo ou campanha.');
  if (linhas.length === 0) throw new Error('A lista não tem nenhum produto.');

  const marcaChave = normalizarTexto(marca);
  let criados = 0;
  let atualizados = 0;

  await db.$transaction(async (tx) => {
    for (const [indice, l] of linhas.entries()) {
      const chave = chaveProdutoCatalogo(l);
      const existente = await tx.produtoReferencia.findUnique({ where: { marca_chave_chave: { marca_chave: marcaChave, chave } } });
      const dados = {
        marca_nome: marca,
        nome: l.nome,
        variante: l.variante,
        codigo_barras: l.codigoBarras,
        codigo_revista: l.codigoRevista ?? existente?.codigo_revista ?? null,
        imagem_url: l.imagemUrl ?? existente?.imagem_url ?? null,
        preco_sugerido_centavos: l.precoVendaCentavos,
        ciclo: cicloLimpo,
        origem: 'OFICIAL',
        posicao: indice + 1
      };
      if (existente) {
        await tx.produtoReferencia.update({ where: { id: existente.id }, data: dados });
        atualizados++;
      } else {
        await tx.produtoReferencia.create({ data: { id: gerarUuidV7(), marca_chave: marcaChave, chave, ...dados } });
        criados++;
      }
    }
    // Banco remoto: mil produtos levam mais que os 5 segundos padrão de uma transação.
  }, { timeout: 180_000, maxWait: 15_000 });

  return { marca, ciclo: cicloLimpo, criados, atualizados, total: linhas.length };
}
