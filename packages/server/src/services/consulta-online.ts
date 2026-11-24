import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import type { PrismaClient } from '@prisma/client';

/**
 * Pesquisa online de um produto pelo código de barras, para quando ele não está no nosso banco.
 *
 * Fontes, na ordem (usa as que estiverem configuradas e para na primeira que achar):
 *   1. Cosmos Bluesoft  — nome, marca, preço médio e foto. Exige COSMOS_TOKEN (conta gratuita).
 *   2. SI5 Global       — nome, marca e foto (sem preço). Exige SI5_TOKEN (conta gratuita).
 *   3. Open Beauty Facts — nome, marca e foto (sem preço). Aberta, sem conta.
 *
 * Só o código de barras sai do servidor; nenhum dado da revendedora ou das clientes.
 * O resultado fica guardado (ConsultaCodigoOnline) para não gastar o limite diário das fontes.
 */

export interface ProdutoOnline {
  nome: string;
  marca_nome: string | null;
  preco_medio_centavos: number | null;
  imagem_url: string | null;
  fonte: string;
}

export interface ResultadoConsultaOnline {
  encontrado: boolean;
  produto: ProdutoOnline | null;
  /** Veio do que já estava guardado, sem consultar as fontes de novo. */
  do_cache: boolean;
}

export class FontesIndisponiveis extends Error {}

export type Buscador = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ status: number; ok: boolean; json: () => Promise<unknown> }>;

type Ambiente = Record<string, string | undefined>;

const CHAVES_DO_ARQUIVO = ['COSMOS_TOKEN', 'SI5_TOKEN', 'CONSULTA_ONLINE', 'OPEN_BEAUTY_FACTS'] as const;
let doArquivo: Ambiente | null = null;

/** Variáveis do ambiente; os tokens das fontes também podem ficar no arquivo .env do servidor. */
export function ambienteConsultaOnline(): Ambiente {
  if (!doArquivo) {
    doArquivo = {};
    try {
      const lido = parseEnv(readFileSync('.env', 'utf-8')) as Ambiente;
      for (const chave of CHAVES_DO_ARQUIVO) if (lido[chave]) doArquivo[chave] = lido[chave];
    } catch {
      /* sem arquivo .env */
    }
  }
  return { ...doArquivo, ...process.env };
}

const VALIDADE_ACHADO_MS = 30 * 24 * 3600 * 1000;
const VALIDADE_NAO_ACHADO_MS = 24 * 3600 * 1000;
const ESPERA_MS = 6000;
const AGENTE = 'revenda-app/1.0';

const texto = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Só aceita endereço https curto (a foto é exibida direto da fonte). */
export function imagemSegura(v: unknown): string | null {
  const url = texto(v, 500);
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

const reaisParaCentavos = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

type Fonte = { nome: string; buscar: (codigo: string, buscador: Buscador) => Promise<ProdutoOnline | null> };

/** null = a fonte respondeu que não conhece o código; erro = fonte fora do ar ou no limite. */
function fontesAtivas(env: Ambiente): Fonte[] {
  if (env.CONSULTA_ONLINE === '0') return [];
  const fontes: Fonte[] = [];
  const sinal = () => AbortSignal.timeout(ESPERA_MS);

  if (env.COSMOS_TOKEN) {
    fontes.push({
      nome: 'Cosmos Bluesoft',
      buscar: async (codigo, buscador) => {
        const r = await buscador(`https://api.cosmos.bluesoft.com.br/gtins/${codigo}.json`, {
          headers: { 'X-Cosmos-Token': env.COSMOS_TOKEN!, 'User-Agent': 'Cosmos-API-Request', Accept: 'application/json' },
          signal: sinal()
        });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`Cosmos respondeu ${r.status}`);
        const d = (await r.json()) as { description?: unknown; avg_price?: unknown; thumbnail?: unknown; brand?: { name?: unknown } | null };
        const nome = texto(d.description);
        if (!nome) return null;
        return {
          nome,
          marca_nome: texto(d.brand?.name, 80),
          preco_medio_centavos: reaisParaCentavos(d.avg_price),
          imagem_url: imagemSegura(d.thumbnail),
          fonte: 'Cosmos Bluesoft'
        };
      }
    });
  }

  if (env.SI5_TOKEN) {
    fontes.push({
      nome: 'SI5 Global',
      buscar: async (codigo, buscador) => {
        const r = await buscador(`https://global.si5.com.br/api/produtos/${codigo}`, {
          headers: { Authorization: `Bearer ${env.SI5_TOKEN}`, Accept: 'application/json' },
          signal: sinal()
        });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`SI5 respondeu ${r.status}`);
        const bruto = (await r.json()) as Record<string, unknown>;
        const d = (bruto.data && typeof bruto.data === 'object' ? bruto.data : bruto) as Record<string, unknown>;
        const nome = texto(d.produto);
        if (!nome) return null;
        return {
          nome,
          marca_nome: texto(d.marca, 80),
          preco_medio_centavos: reaisParaCentavos(d.preco_medio),
          imagem_url: imagemSegura(d.imagem_url),
          fonte: 'SI5 Global'
        };
      }
    });
  }

  if (env.OPEN_BEAUTY_FACTS !== '0') {
    fontes.push({
      nome: 'Open Beauty Facts',
      buscar: async (codigo, buscador) => {
        const r = await buscador(
          `https://world.openbeautyfacts.org/api/v2/product/${codigo}.json?fields=product_name,product_name_pt,brands,image_url`,
          { headers: { 'User-Agent': AGENTE, Accept: 'application/json' }, signal: sinal() }
        );
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`Open Beauty Facts respondeu ${r.status}`);
        const d = (await r.json()) as { status?: unknown; product?: Record<string, unknown> };
        const nome = texto(d.product?.product_name_pt) ?? texto(d.product?.product_name);
        if (d.status !== 1 || !nome) return null;
        return {
          nome,
          marca_nome: texto(d.product?.brands, 80)?.split(',').pop()?.trim() ?? null,
          preco_medio_centavos: null,
          imagem_url: imagemSegura(d.product?.image_url),
          fonte: 'Open Beauty Facts'
        };
      }
    });
  }

  return fontes;
}

export function consultaOnlineDisponivel(env: Ambiente = ambienteConsultaOnline()): boolean {
  return fontesAtivas(env).length > 0;
}

export async function consultarCodigoOnline(
  db: PrismaClient,
  codigo: string,
  opcoes: { buscador: Buscador; env?: Ambiente; agora?: Date }
): Promise<ResultadoConsultaOnline> {
  const agora = opcoes.agora ?? new Date();
  const guardado = await db.consultaCodigoOnline.findUnique({ where: { codigo_barras: codigo } });
  if (guardado) {
    const validade = guardado.encontrado ? VALIDADE_ACHADO_MS : VALIDADE_NAO_ACHADO_MS;
    if (agora.getTime() - guardado.consultado_em.getTime() < validade) {
      return {
        encontrado: guardado.encontrado,
        do_cache: true,
        produto: guardado.encontrado
          ? {
              nome: guardado.nome!,
              marca_nome: guardado.marca_nome,
              preco_medio_centavos: guardado.preco_medio_centavos,
              imagem_url: guardado.imagem_url,
              fonte: guardado.fonte ?? 'pesquisa online'
            }
          : null
      };
    }
  }

  const fontes = fontesAtivas(opcoes.env ?? ambienteConsultaOnline());
  if (fontes.length === 0) throw new FontesIndisponiveis('A pesquisa online está desligada neste servidor.');

  let achado: ProdutoOnline | null = null;
  let respostas = 0;
  for (const fonte of fontes) {
    try {
      const produto = await fonte.buscar(codigo, opcoes.buscador);
      respostas++;
      if (produto) {
        achado = produto;
        break;
      }
    } catch {
      /* fonte fora do ar ou no limite: tenta a próxima */
    }
  }

  // Nenhuma fonte respondeu: não guarda "não encontrado", para poder tentar de novo depois.
  if (!achado && respostas === 0) throw new FontesIndisponiveis('As fontes de pesquisa não responderam agora. Tente de novo mais tarde.');

  const dados = {
    encontrado: !!achado,
    nome: achado?.nome ?? null,
    marca_nome: achado?.marca_nome ?? null,
    preco_medio_centavos: achado?.preco_medio_centavos ?? null,
    imagem_url: achado?.imagem_url ?? null,
    fonte: achado?.fonte ?? null,
    consultado_em: agora
  };
  await db.consultaCodigoOnline.upsert({ where: { codigo_barras: codigo }, create: { codigo_barras: codigo, ...dados }, update: dados });

  return { encontrado: !!achado, produto: achado, do_cache: false };
}
