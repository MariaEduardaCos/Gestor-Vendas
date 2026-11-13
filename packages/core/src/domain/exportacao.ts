/**
 * Geração de CSV para abrir direto no Excel / Planilhas em português:
 * separador ";", vírgula decimal, BOM UTF-8 (acentos corretos) e quebra de linha CRLF.
 */

export type ValorCsv = string | number | boolean | null | undefined | Date;

export interface ColunaCsv<T> {
  titulo: string;
  valor: (linha: T) => ValorCsv;
}

const BOM = '﻿';
const SEPARADOR = ';';

/**
 * Texto que começa com = + - @ (ou tab/CR) vira fórmula no Excel. Um nome de cliente
 * como "=HYPERLINK(...)" poderia executar algo ao abrir a planilha; o apóstrofo neutraliza.
 */
function neutralizarFormula(texto: string): string {
  return /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
}

export function celulaCsv(valor: ValorCsv): string {
  if (valor === null || valor === undefined) return '';
  let texto: string;
  if (valor instanceof Date) texto = valor.toISOString();
  else if (typeof valor === 'boolean') texto = valor ? 'sim' : 'não';
  else if (typeof valor === 'number') texto = String(valor).replace('.', ',');
  else texto = neutralizarFormula(valor);

  if (/[";\r\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function gerarCsv<T>(colunas: ColunaCsv<T>[], linhas: T[]): string {
  const cabecalho = colunas.map((c) => celulaCsv(c.titulo)).join(SEPARADOR);
  const corpo = linhas.map((l) => colunas.map((c) => celulaCsv(c.valor(l))).join(SEPARADOR));
  return BOM + [cabecalho, ...corpo].join('\r\n') + '\r\n';
}

/** Centavos inteiros para número em reais (12345 → 123.45), exibido como "123,45" no CSV. */
export function centavosParaReais(centavos: number | null | undefined): number | null {
  if (centavos === null || centavos === undefined) return null;
  return Math.round(centavos) / 100;
}

/** Data/hora para "AAAA-MM-DD HH:MM" no horário de Brasília (ordena bem e o Excel entende). */
export function dataHoraLocal(data: Date | null | undefined, fuso = 'America/Sao_Paulo'): string {
  if (!data) return '';
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(data);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? '';
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}`;
}
