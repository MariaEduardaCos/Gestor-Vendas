import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import { chaveProdutoCatalogo, normalizarTexto, type LinhaCatalogo } from '@consultorasync/core';
import { carregarCatalogoOficial } from './catalogo-oficial.js';

/** Listas oficiais guardadas no repositório, com o nome da campanha que aparece nas telas. */
const ARQUIVOS = [
  { arquivo: 'boticario-2026-11-loja-digital.json', ciclo: 'Novembro/2026 (loja digital)' },
  { arquivo: 'natura-2026-11-site.json', ciclo: 'Novembro/2026 (site Natura)' }
];

interface ItemArquivo extends LinhaCatalogo {
  marca: string;
}

/**
 * Num banco novo (ex.: o primeiro deploy), carrega os catálogos oficiais que estão no repositório.
 * Não faz nada se já existir produto oficial com ordem de vitrine: nunca sobrescreve cargas feitas depois.
 */
export async function carregarCatalogosIniciais(db: PrismaClient, log: (msg: string) => void): Promise<void> {
  // Já carregado (com a ordem da vitrine) → nada a fazer. Bancos carregados antes da coluna
  // "posicao" passam pela carga de novo, que só atualiza os produtos e preenche a ordem.
  if ((await db.produtoReferencia.count({ where: { origem: 'OFICIAL', posicao: { not: null } } })) > 0) return;

  const pasta = process.env.CATALOGOS_DIR ||
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../analise-replica/catalogos');

  for (const { arquivo, ciclo } of ARQUIVOS) {
    const caminho = path.join(pasta, arquivo);
    if (!existsSync(caminho)) {
      log(`Catálogo inicial não encontrado: ${caminho}`);
      continue;
    }
    const itens: ItemArquivo[] = JSON.parse(readFileSync(caminho, 'utf-8'));
    // Agrupa por marca e descarta repetidos (mesma chave de catálogo dentro da marca).
    const porMarca = new Map<string, Map<string, ItemArquivo>>();
    for (const item of itens) {
      const linhas = porMarca.get(item.marca) ?? new Map<string, ItemArquivo>();
      linhas.set(normalizarTexto(chaveProdutoCatalogo(item)), item);
      porMarca.set(item.marca, linhas);
    }
    for (const [marca, linhas] of porMarca) {
      const r = await carregarCatalogoOficial(db, marca, ciclo, [...linhas.values()]);
      log(`Catálogo inicial: ${r.marca} · ${r.ciclo}: ${r.total} produtos`);
    }
  }
}
