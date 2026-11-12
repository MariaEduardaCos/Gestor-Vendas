import { describe, it, expect } from 'vitest';
import {
  converterPrecoParaCentavos,
  interpretarTextoCatalogo,
  planejarImportacaoCatalogo,
  MARCAS_CONHECIDAS
} from '../src/domain/catalogo.js';

describe('converterPrecoParaCentavos', () => {
  it.each([
    ['59,90', 5990],
    ['R$ 1.299,90', 129990],
    ['59.90', 5990],
    ['60', 6000],
    ['1.299', 129900]
  ])('%s → %i centavos', (entrada, esperado) => {
    expect(converterPrecoParaCentavos(entrada)).toBe(esperado);
  });

  it.each(['', 'abc', '0', '0,00', '-5'])('recusa "%s"', (entrada) => {
    expect(converterPrecoParaCentavos(entrada)).toBeNull();
  });
});

describe('interpretarTextoCatalogo', () => {
  it('lê os formatos de 4, 3 e 2 colunas, com ";" ou tabulação, ignorando cabeçalho e linhas vazias', () => {
    const texto = [
      'código;nome;variante;preço',
      '7891033000011;Hidratante Tododia;Algodão 400ml;59,90',
      '',
      'Perfume Essencial\t100ml\t199,90',
      '7891033000028;Sabonete Ekos;12,50',
      'Batom Una;39,90'
    ].join('\n');

    const { linhas, erros } = interpretarTextoCatalogo(texto);

    expect(erros).toEqual([]);
    expect(linhas).toEqual([
      { codigoBarras: '7891033000011', nome: 'Hidratante Tododia', variante: 'Algodão 400ml', precoVendaCentavos: 5990 },
      { codigoBarras: null, nome: 'Perfume Essencial', variante: '100ml', precoVendaCentavos: 19990 },
      { codigoBarras: '7891033000028', nome: 'Sabonete Ekos', variante: null, precoVendaCentavos: 1250 },
      { codigoBarras: null, nome: 'Batom Una', variante: null, precoVendaCentavos: 3990 }
    ]);
  });

  it('aponta a linha com preço inválido ou código malformado, sem descartar as demais', () => {
    const { linhas, erros } = interpretarTextoCatalogo('Batom;39,90\nCreme;sem preço\n123;Sabonete;x;10');
    expect(linhas).toHaveLength(1);
    expect(erros.map((e) => e.linha)).toEqual([2, 3]);
  });
});

describe('planejarImportacaoCatalogo', () => {
  const existentes = [
    { id: 'p1', nome: 'Hidratante Tododia', variante: 'Algodão 400ml', codigoBarras: '7891033000011', precoVendaCentavos: 5990 },
    { id: 'p2', nome: 'Perfume Essencial', variante: '100ml', codigoBarras: null, precoVendaCentavos: 18990 }
  ];

  it('reconhece por código, depois por nome+variante sem acento/maiúscula, e separa novo, preço alterado e igual', () => {
    const acoes = planejarImportacaoCatalogo(existentes, [
      { codigoBarras: '7891033000011', nome: 'Hidratante Tododia (novo nome)', variante: null, precoVendaCentavos: 5990 },
      { codigoBarras: null, nome: 'perfume  ESSENCIAL', variante: '100ML', precoVendaCentavos: 19990 },
      { codigoBarras: null, nome: 'Batom Una', variante: null, precoVendaCentavos: 3990 }
    ]);

    expect(acoes.map((a) => a.tipo)).toEqual(['SEM_MUDANCA', 'ATUALIZAR_PRECO', 'CRIAR']);
    expect(acoes[1]).toMatchObject({ produtoId: 'p2', precoAnteriorCentavos: 18990 });
  });

  it('linha repetida no mesmo catálogo vale uma vez, com o último preço', () => {
    const acoes = planejarImportacaoCatalogo([], [
      { codigoBarras: null, nome: 'Batom', variante: null, precoVendaCentavos: 1000 },
      { codigoBarras: null, nome: 'batom', variante: null, precoVendaCentavos: 1200 }
    ]);
    expect(acoes).toHaveLength(1);
    expect(acoes[0].linha.precoVendaCentavos).toBe(1200);
  });
});

describe('MARCAS_CONHECIDAS', () => {
  it('não repete marcas e tem percentual sugerido entre 0 e 100', () => {
    const nomes = MARCAS_CONHECIDAS.map((m) => m.nome);
    expect(new Set(nomes).size).toBe(nomes.length);
    expect(MARCAS_CONHECIDAS.every((m) => m.percentualSugerido >= 0 && m.percentualSugerido <= 100)).toBe(true);
  });
});

describe('chaveProdutoCatalogo', () => {
  it('usa o código quando existe e nome+variante normalizados quando não', async () => {
    const { chaveProdutoCatalogo } = await import('../src/domain/catalogo.js');
    expect(chaveProdutoCatalogo({ codigoBarras: '7891033000011', nome: 'X', variante: null })).toBe('cod:7891033000011');
    expect(chaveProdutoCatalogo({ codigoBarras: null, nome: 'Hidratante  ÁGUA', variante: '400ml' })).toBe(
      chaveProdutoCatalogo({ codigoBarras: null, nome: 'hidratante agua', variante: '400ML' })
    );
  });
});
