/**
 * Códigos de produto digitados ou bipados.
 *
 * - Código de barras (EAN-8, UPC-A, EAN-13, GTIN-14): 8 a 14 números, vem na embalagem.
 * - Código da revista: 3 a 7 números, impresso no catálogo do ciclo e usado no pedido à marca
 *   (ex.: Natura 71612). O mesmo número pode existir em marcas diferentes.
 * - Qualquer outra coisa é tratada como nome do produto.
 *
 * Espaços, pontos, traços e barras são ignorados ("789 1033-000011" = "7891033000011").
 */

export type TipoCodigo = 'BARRAS' | 'REVISTA' | 'TEXTO';

export interface CodigoClassificado {
  tipo: TipoCodigo;
  /** Só números para BARRAS/REVISTA; o texto aparado para TEXTO. */
  valor: string;
}

const SEPARADORES = /[\s.\-/]/g;

export function classificarCodigo(entrada: string | null | undefined): CodigoClassificado {
  const aparado = (entrada ?? '').trim();
  const numeros = aparado.replace(SEPARADORES, '');
  if (/^\d+$/.test(numeros)) {
    if (numeros.length >= 8 && numeros.length <= 14) return { tipo: 'BARRAS', valor: numeros };
    if (numeros.length >= 3 && numeros.length <= 7) return { tipo: 'REVISTA', valor: numeros };
  }
  return { tipo: 'TEXTO', valor: aparado };
}

/** Código de barras só com números (ou null se não for um código de barras válido). */
export function limparCodigoBarras(entrada: string | null | undefined): string | null {
  const c = classificarCodigo(entrada);
  return c.tipo === 'BARRAS' ? c.valor : null;
}

/** Código da revista só com números (ou null se não for um código de revista válido). */
export function limparCodigoRevista(entrada: string | null | undefined): string | null {
  const c = classificarCodigo(entrada);
  return c.tipo === 'REVISTA' ? c.valor : null;
}

/**
 * Formas equivalentes do mesmo código de barras: leitores diferentes leem o mesmo produto
 * como UPC-A (12), EAN-13 com zero à esquerda (13) ou GTIN-14 com zero à esquerda (14).
 */
export function variantesCodigoBarras(codigo: string): string[] {
  const semZeros = codigo.replace(/^0+/, '');
  const formas = new Set<string>([codigo]);
  for (let tamanho = Math.max(8, semZeros.length); tamanho <= 14; tamanho++) {
    formas.add(semZeros.padStart(tamanho, '0'));
  }
  return [...formas];
}

export interface ProdutoComCodigos {
  codigo_barras?: string | null;
  codigo_revista?: string | null;
}

/** O produto tem este código (de barras, em qualquer forma equivalente, ou da revista)? */
export function produtoTemCodigo(produto: ProdutoComCodigos, entrada: string): boolean {
  const c = classificarCodigo(entrada);
  if (c.tipo === 'BARRAS') {
    const atual = limparCodigoBarras(produto.codigo_barras);
    return !!atual && variantesCodigoBarras(c.valor).includes(atual);
  }
  if (c.tipo === 'REVISTA') return limparCodigoRevista(produto.codigo_revista) === c.valor;
  return false;
}
