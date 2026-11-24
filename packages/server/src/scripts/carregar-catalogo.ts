/**
 * Carga oficial do catálogo da campanha de uma marca (vale para todas as revendedoras).
 *
 *   npm run catalogo:carregar -- --marca "Natura" --ciclo "Ciclo 17/2026" caminho/lista.csv
 *
 * A lista segue o mesmo formato da tela "Marcas e catálogos":
 *   código da revista ; código de barras ; nome ; variante ; preço
 * Usa o banco apontado por DATABASE_URL.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { interpretarTextoCatalogo } from '@consultorasync/core';
import { carregarCatalogoOficial } from '../services/catalogo-oficial.js';

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function principal() {
  const marca = argumento('marca');
  const ciclo = argumento('ciclo');
  const arquivo = process.argv.slice(2).find((a, i, todos) => !a.startsWith('--') && !todos[i - 1]?.startsWith('--'));
  if (!marca || !ciclo || !arquivo) {
    console.error('Uso: npm run catalogo:carregar -- --marca "Natura" --ciclo "Ciclo 17/2026" lista.csv');
    process.exit(1);
  }

  const { linhas, erros } = interpretarTextoCatalogo(readFileSync(arquivo, 'utf-8').replace(/^﻿/, ''));
  for (const e of erros) console.warn(`Linha ${e.linha} ignorada: ${e.motivo} (${e.conteudo})`);
  if (linhas.length === 0) {
    console.error('Nenhum produto válido na lista.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const r = await carregarCatalogoOficial(prisma, marca, ciclo, linhas);
    console.log(`${r.marca} · ${r.ciclo}: ${r.total} produtos (${r.criados} novos, ${r.atualizados} atualizados), ${erros.length} linha(s) ignorada(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

principal().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
