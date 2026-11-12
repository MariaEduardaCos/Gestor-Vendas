/**
 * Catálogo de marca (revista do ciclo): leitura de uma lista colada ou de planilha
 * e planejamento da atualização dos produtos da marca.
 *
 * Regras:
 * - O produto é reconhecido pelo código de barras; sem código, por nome + variante
 *   (sem diferenciar maiúsculas, acentos e espaços extras).
 * - Produto novo é criado; produto existente com preço diferente tem o preço atualizado
 *   somente após a confirmação da prévia. Vendas e encomendas já registradas mantêm o
 *   preço congelado no item da conta.
 * - Produtos que não aparecem no novo catálogo continuam cadastrados (podem ter estoque).
 */

export interface LinhaCatalogo {
  codigoBarras: string | null;
  nome: string;
  variante: string | null;
  precoVendaCentavos: number;
}

export interface ErroLinhaCatalogo {
  linha: number;
  conteudo: string;
  motivo: string;
}

export interface ProdutoCatalogoExistente {
  id: string;
  nome: string;
  variante: string | null;
  codigoBarras: string | null;
  precoVendaCentavos: number;
}

export type AcaoCatalogo =
  | { tipo: 'CRIAR'; linha: LinhaCatalogo }
  | { tipo: 'ATUALIZAR_PRECO'; linha: LinhaCatalogo; produtoId: string; precoAnteriorCentavos: number }
  | { tipo: 'SEM_MUDANCA'; linha: LinhaCatalogo; produtoId: string };

/** Marcas de venda direta oferecidas para a revendedora escolher. O percentual é só sugestão inicial. */
export const MARCAS_CONHECIDAS: ReadonlyArray<{ nome: string; percentualSugerido: number }> = [
  { nome: 'Natura', percentualSugerido: 30 },
  { nome: 'Avon', percentualSugerido: 30 },
  { nome: 'O Boticário', percentualSugerido: 30 },
  { nome: 'Eudora', percentualSugerido: 30 },
  { nome: 'Quem Disse, Berenice?', percentualSugerido: 30 },
  { nome: 'Jequiti', percentualSugerido: 30 },
  { nome: 'Mary Kay', percentualSugerido: 30 },
  { nome: 'Hinode', percentualSugerido: 30 },
  { nome: 'Tupperware', percentualSugerido: 30 },
  { nome: 'DeMillus', percentualSugerido: 30 }
];

export function normalizarTexto(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "59,90", "R$ 1.299,90", "59.90" ou "60" → centavos. Retorna null se não for preço válido (> 0). */
export function converterPrecoParaCentavos(valor: string): number | null {
  let s = valor.replace(/r\$/i, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const ultimaVirgula = s.lastIndexOf(',');
  const ultimoPonto = s.lastIndexOf('.');
  if (ultimaVirgula > ultimoPonto) {
    s = s.replace(/\./g, '').replace(',', '.'); // formato brasileiro 1.299,90
  } else if (ultimoPonto > -1 && s.length - ultimoPonto - 1 !== 2) {
    s = s.replace(/\./g, ''); // ponto como milhar: 1.299
  } else {
    s = s.replace(/,/g, '');
  }
  const numero = Number(s);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return Math.round(numero * 100);
}

const pareceCodigoBarras = (s: string) => /^\d{8,14}$/.test(s.trim());

/**
 * Lê uma linha por produto, colunas separadas por ";" ou tabulação (como ao copiar de planilha):
 *   código ; nome ; variante ; preço    (4 colunas)
 *   nome ; variante ; preço   ou   código ; nome ; preço    (3 colunas)
 *   nome ; preço    (2 colunas)
 * Linhas vazias e cabeçalho são ignorados.
 */
export function interpretarTextoCatalogo(texto: string): { linhas: LinhaCatalogo[]; erros: ErroLinhaCatalogo[] } {
  const linhas: LinhaCatalogo[] = [];
  const erros: ErroLinhaCatalogo[] = [];

  texto.split(/\r?\n/).forEach((bruta, indice) => {
    const conteudo = bruta.trim();
    if (!conteudo) return;
    const partes = conteudo.split(/\t|;/).map((p) => p.trim());
    const preco = converterPrecoParaCentavos(partes[partes.length - 1] ?? '');

    if (preco === null) {
      const ehCabecalho = linhas.length === 0 && erros.length === 0 && /pre[cç]o|valor/i.test(conteudo);
      if (!ehCabecalho) erros.push({ linha: indice + 1, conteudo, motivo: 'Preço ausente ou inválido na última coluna.' });
      return;
    }

    let codigo: string | null = null;
    let nome = '';
    let variante: string | null = null;
    if (partes.length >= 4) {
      [codigo, nome, variante] = [partes[0] || null, partes[1], partes[2] || null];
    } else if (partes.length === 3) {
      if (pareceCodigoBarras(partes[0])) [codigo, nome] = [partes[0], partes[1]];
      else [nome, variante] = [partes[0], partes[1] || null];
    } else if (partes.length === 2) {
      nome = partes[0];
    }

    if (!nome) {
      erros.push({ linha: indice + 1, conteudo, motivo: 'Nome do produto ausente.' });
      return;
    }
    if (codigo && !pareceCodigoBarras(codigo)) {
      erros.push({ linha: indice + 1, conteudo, motivo: 'Código de barras deve ter de 8 a 14 dígitos.' });
      return;
    }
    linhas.push({ codigoBarras: codigo, nome, variante, precoVendaCentavos: preco });
  });

  return { linhas, erros };
}

const chaveNome = (nome: string, variante: string | null) => `${normalizarTexto(nome)}|${normalizarTexto(variante)}`;

/** Decide, para cada linha do catálogo, se o produto será criado, terá o preço atualizado ou ficará igual. */
export function planejarImportacaoCatalogo(existentes: ProdutoCatalogoExistente[], linhas: LinhaCatalogo[]): AcaoCatalogo[] {
  const porCodigo = new Map<string, ProdutoCatalogoExistente>();
  const porNome = new Map<string, ProdutoCatalogoExistente>();
  for (const p of existentes) {
    if (p.codigoBarras) porCodigo.set(p.codigoBarras, p);
    porNome.set(chaveNome(p.nome, p.variante), p);
  }

  // Linhas repetidas no mesmo catálogo: vale a última.
  const unicas = new Map<string, LinhaCatalogo>();
  for (const l of linhas) unicas.set(l.codigoBarras ?? chaveNome(l.nome, l.variante), l);

  return [...unicas.values()].map((linha): AcaoCatalogo => {
    const produto = (linha.codigoBarras && porCodigo.get(linha.codigoBarras)) || porNome.get(chaveNome(linha.nome, linha.variante));
    if (!produto) return { tipo: 'CRIAR', linha };
    if (produto.precoVendaCentavos !== linha.precoVendaCentavos) {
      return { tipo: 'ATUALIZAR_PRECO', linha, produtoId: produto.id, precoAnteriorCentavos: produto.precoVendaCentavos };
    }
    return { tipo: 'SEM_MUDANCA', linha, produtoId: produto.id };
  });
}

/** Chave estável do produto no catálogo compartilhado: o código, ou nome|variante normalizados. */
export function chaveProdutoCatalogo(linha: Pick<LinhaCatalogo, 'codigoBarras' | 'nome' | 'variante'>): string {
  return linha.codigoBarras ? `cod:${linha.codigoBarras}` : `nome:${chaveNome(linha.nome, linha.variante)}`;
}
