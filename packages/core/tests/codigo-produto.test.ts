import { describe, it, expect } from 'vitest';
import { classificarCodigo, variantesCodigoBarras, produtoTemCodigo } from '../src/domain/codigo-produto';
import { interpretarTextoCatalogo, planejarImportacaoCatalogo } from '../src/domain/catalogo';
import { Produto } from '../src/domain/produto';

describe('Código digitado ou bipado', () => {
  it('separa código de barras, código da revista e nome', () => {
    expect(classificarCodigo('7891033000011')).toEqual({ tipo: 'BARRAS', valor: '7891033000011' });
    expect(classificarCodigo(' 789 1033-000.011 ')).toEqual({ tipo: 'BARRAS', valor: '7891033000011' });
    expect(classificarCodigo('71612')).toEqual({ tipo: 'REVISTA', valor: '71612' });
    expect(classificarCodigo('71.612')).toEqual({ tipo: 'REVISTA', valor: '71612' });
    expect(classificarCodigo('12')).toEqual({ tipo: 'TEXTO', valor: '12' });
    expect(classificarCodigo('batom rosa')).toEqual({ tipo: 'TEXTO', valor: 'batom rosa' });
  });

  it('trata UPC-A, EAN-13 e GTIN-14 com zero à esquerda como o mesmo código', () => {
    const formas = variantesCodigoBarras('012345678905');
    expect(formas).toContain('012345678905');
    expect(formas).toContain('0012345678905');
    expect(formas).toContain('12345678905');
    expect(produtoTemCodigo({ codigo_barras: '0012345678905' }, '012345678905')).toBe(true);
    expect(produtoTemCodigo({ codigo_barras: '7891033000011' }, '07891033000011')).toBe(true);
    expect(produtoTemCodigo({ codigo_barras: '7891033000011' }, '7891033000012')).toBe(false);
  });

  it('encontra pelo código da revista e não confunde com parte do código de barras', () => {
    expect(produtoTemCodigo({ codigo_barras: '7891033000011', codigo_revista: '71612' }, '71612')).toBe(true);
    expect(produtoTemCodigo({ codigo_barras: '7891033000011', codigo_revista: null }, '91033')).toBe(false);
  });
});

describe('Catálogo do ciclo com código da revista', () => {
  it('aceita o código da revista, o de barras ou os dois', () => {
    const { linhas, erros } = interpretarTextoCatalogo(
      ['71612;Kaiak Clássico;100ml;139,90', '71613;7891033123456;Kaiak Aventura;100ml;149,90', '789 1033 999999;Batom;Rosa;29,90', 'ABC;Creme;;10'].join('\n')
    );
    expect(linhas).toEqual([
      { codigoBarras: null, codigoRevista: '71612', nome: 'Kaiak Clássico', variante: '100ml', precoVendaCentavos: 13990 },
      { codigoBarras: '7891033123456', codigoRevista: '71613', nome: 'Kaiak Aventura', variante: '100ml', precoVendaCentavos: 14990 },
      { codigoBarras: '7891033999999', codigoRevista: null, nome: 'Batom', variante: 'Rosa', precoVendaCentavos: 2990 }
    ]);
    expect(erros).toHaveLength(1);
    expect(erros[0].motivo).toMatch(/revista/);
  });

  it('reconhece o produto existente pelo código da revista', () => {
    const acoes = planejarImportacaoCatalogo(
      [{ id: 'p1', nome: 'Kaiak', variante: null, codigoBarras: null, codigoRevista: '71612', precoVendaCentavos: 12990 }],
      [{ codigoBarras: null, codigoRevista: '71612', nome: 'Kaiak Clássico (novo nome)', variante: '100ml', precoVendaCentavos: 13990 }]
    );
    expect(acoes).toEqual([expect.objectContaining({ tipo: 'ATUALIZAR_PRECO', produtoId: 'p1', precoAnteriorCentavos: 12990 })]);
  });

  it('cadastro guarda os códigos só com números e recusa código da revista inválido', () => {
    const p = new Produto({ operacaoId: 'op', nome: 'X', codigoBarras: '789 1033-000011', codigoRevista: '71.612', precoVendaCentavos: 100 });
    expect(p.codigoBarras).toBe('7891033000011');
    expect(p.codigoRevista).toBe('71612');
    expect(() => new Produto({ operacaoId: 'op', nome: 'X', codigoRevista: '12', precoVendaCentavos: 100 })).toThrow(/revista/);
  });
});

describe('Dígito verificador do código de barras', () => {
  it('aceita códigos reais e recusa dígito trocado ou tamanho errado', async () => {
    const { digitoVerificadorValido } = await import('../src/domain/codigo-produto');
    expect(digitoVerificadorValido('7908132258012')).toBe(true); // EAN-13
    expect(digitoVerificadorValido('036000291452')).toBe(true); // UPC-A
    expect(digitoVerificadorValido('96385074')).toBe(true); // EAN-8
    expect(digitoVerificadorValido('7908132258013')).toBe(false);
    expect(digitoVerificadorValido('71612')).toBe(false);
  });
});
