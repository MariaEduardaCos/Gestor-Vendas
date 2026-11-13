import { describe, it, expect } from 'vitest';
import { celulaCsv, gerarCsv, centavosParaReais, dataHoraLocal } from '../src/domain/exportacao';

describe('Exportação CSV', () => {
  it('usa ponto e vírgula, BOM, CRLF e vírgula decimal', () => {
    const csv = gerarCsv(
      [
        { titulo: 'Nome', valor: (l: { nome: string; valor: number }) => l.nome },
        { titulo: 'Valor (R$)', valor: (l) => centavosParaReais(l.valor) }
      ],
      [{ nome: 'Ana', valor: 12345 }]
    );
    expect(csv).toBe('﻿Nome;Valor (R$)\r\nAna;123,45\r\n');
  });

  it('coloca entre aspas o que tem separador, aspas ou quebra de linha', () => {
    expect(celulaCsv('Rua A; 10')).toBe('"Rua A; 10"');
    expect(celulaCsv('Batom "Rosa"')).toBe('"Batom ""Rosa"""');
    expect(celulaCsv('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  it('neutraliza texto que viraria fórmula no Excel', () => {
    expect(celulaCsv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celulaCsv('+5511999')).toBe("'+5511999");
    expect(celulaCsv('@soma')).toBe("'@soma");
    // números negativos continuam números
    expect(celulaCsv(-12.5)).toBe('-12,5');
  });

  it('vazios, booleanos e datas', () => {
    expect(celulaCsv(null)).toBe('');
    expect(celulaCsv(undefined)).toBe('');
    expect(celulaCsv(true)).toBe('sim');
    expect(centavosParaReais(null)).toBeNull();
    expect(dataHoraLocal(new Date('2026-11-13T02:30:00Z'))).toBe('2026-11-12 23:30');
  });
});
