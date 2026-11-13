import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { limparOperacoes } from './helpers.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Busca por código de barras e código da revista; produtos fora do ciclo', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });
  const operacaoA = gerarUuidV7();
  const operacaoB = gerarUuidV7();
  const operadorA = gerarUuidV7();
  const operadorB = gerarUuidV7();
  const MARCA = 'Marca Codigo Teste';
  const OUTRA = 'Outra Marca Codigo Teste';
  let tokenA: string;
  let tokenB: string;
  let marcaId: string;
  let outraId: string;

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });
  const get = (url: string, t = tokenA) => app.inject({ method: 'GET', url, headers: auth(t) });
  const carregarCatalogo = (id: string, ciclo: string, itens: unknown[], t = tokenA) =>
    app.inject({ method: 'POST', url: `/api/marcas/${id}/catalogo`, headers: auth(t), payload: { ciclo, itens } });

  beforeAll(async () => {
    await prisma.operacao.createMany({ data: [{ id: operacaoA, nome: 'Op Código A' }, { id: operacaoB, nome: 'Op Código B' }] });
    await prisma.operador.createMany({
      data: [
        { id: operadorA, operacao_id: operacaoA, nome: 'Revendedora A' },
        { id: operadorB, operacao_id: operacaoB, nome: 'Revendedora B' }
      ]
    });
    tokenA = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: operacaoA, operador_id: operadorA } })).json().token;
    tokenB = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: operacaoB, operador_id: operadorB } })).json().token;
    marcaId = (await app.inject({ method: 'POST', url: '/api/marcas', headers: auth(tokenA), payload: { nome: MARCA, percentual_padrao: 30 } })).json().id;
    outraId = (await app.inject({ method: 'POST', url: '/api/marcas', headers: auth(tokenA), payload: { nome: OUTRA, percentual_padrao: 30 } })).json().id;

    const r1 = await carregarCatalogo(marcaId, 'Ciclo 1', [
      { codigoBarras: '7891033000011', codigoRevista: '71612', nome: 'Hidratante', variante: null, precoVendaCentavos: 5990 },
      { codigoBarras: null, codigoRevista: '71613', nome: 'Perfume', variante: '100ml', precoVendaCentavos: 19990 },
      { codigoBarras: null, codigoRevista: '55555', nome: 'Sabonete', variante: null, precoVendaCentavos: 1290 }
    ]);
    expect(r1.statusCode).toBe(200);
    // mesmo código de revista em outra marca
    await carregarCatalogo(outraId, 'Campanha 9', [{ codigoBarras: null, codigoRevista: '71612', nome: 'Batom', variante: 'Rosa', precoVendaCentavos: 2990 }]);
  });

  afterAll(async () => {
    await limparOperacoes(prisma, [operacaoA, operacaoB]);
    await prisma.produtoReferencia.deleteMany({ where: { marca_chave: { in: ['marca codigo teste', 'outra marca codigo teste'] } } });
    await prisma.$disconnect();
  });

  it('acha o código de barras com espaços, traços ou zero à esquerda', async () => {
    for (const codigo of ['7891033000011', '789%201033-000011', '07891033000011']) {
      const res = await get(`/api/produtos/codigo/${codigo}`);
      expect(res.statusCode, codigo).toBe(200);
      expect(res.json().nome).toBe('Hidratante');
      expect(res.json().codigo_revista).toBe('71612');
    }
  });

  it('acha pelo código da revista e lista todas as marcas que usam o mesmo número', async () => {
    const lista = (await get('/api/produtos/por-codigo/71612')).json();
    expect(lista.map((p: { nome: string }) => p.nome).sort()).toEqual(['Batom', 'Hidratante']);
    expect((await get('/api/produtos/por-codigo/71613')).json()).toHaveLength(1);
    expect((await get('/api/produtos/por-codigo/99999')).json()).toEqual([]);
    expect((await get('/api/produtos/por-codigo/batom')).json()).toEqual([]);
    // outra revendedora não vê
    expect((await get('/api/produtos/por-codigo/71612', tokenB)).json()).toEqual([]);
  });

  it('busca por texto também procura no código da revista', async () => {
    const nomes = (await get('/api/produtos?busca=71613')).json().map((p: { nome: string }) => p.nome);
    expect(nomes).toEqual(['Perfume']);
  });

  it('produto que não veio no novo ciclo aparece como fora do ciclo', async () => {
    const previa = await app.inject({
      method: 'POST',
      url: `/api/marcas/${marcaId}/catalogo`,
      headers: auth(tokenA),
      payload: {
        ciclo: 'Ciclo 2',
        simular: true,
        itens: [
          { codigoBarras: null, codigoRevista: '71612', nome: 'Hidratante', variante: null, precoVendaCentavos: 6490 },
          { codigoBarras: null, codigoRevista: '71613', nome: 'Perfume', variante: '100ml', precoVendaCentavos: 19990 }
        ]
      }
    });
    expect(previa.json()).toMatchObject({ precos_alterados: 1, sem_mudanca: 1, fora_do_ciclo: 1, fora_do_ciclo_nomes: ['Sabonete'] });

    await carregarCatalogo(marcaId, 'Ciclo 2', [
      { codigoBarras: null, codigoRevista: '71612', nome: 'Hidratante', variante: null, precoVendaCentavos: 6490 },
      { codigoBarras: null, codigoRevista: '71613', nome: 'Perfume', variante: '100ml', precoVendaCentavos: 19990 }
    ]);
    const produtos = (await get(`/api/produtos?marca_id=${marcaId}`)).json() as Array<{ nome: string; fora_do_ciclo: boolean; preco_venda_centavos: number }>;
    const porNome = Object.fromEntries(produtos.map((p) => [p.nome, p]));
    expect(porNome.Sabonete.fora_do_ciclo).toBe(true);
    expect(porNome.Hidratante.fora_do_ciclo).toBe(false);
    expect(porNome.Hidratante.preco_venda_centavos).toBe(6490);
  });

  it('catálogo compartilhado sugere pelo código da revista só nas marcas da revendedora', async () => {
    // B ainda não vende a marca: não recebe sugestão pelo código curto
    expect((await get('/api/catalogo-compartilhado/codigo/71613', tokenB)).json()).toEqual([]);
    await app.inject({ method: 'POST', url: '/api/marcas', headers: auth(tokenB), payload: { nome: MARCA } });
    const sugestoes = (await get('/api/catalogo-compartilhado/codigo/71613', tokenB)).json();
    expect(sugestoes).toEqual([expect.objectContaining({ nome: 'Perfume', codigo_revista: '71613', marca_nome: MARCA })]);
    // código de barras vale para qualquer marca, com zero à esquerda também
    expect((await get('/api/catalogo-compartilhado/codigo/07891033000011', tokenB)).json()[0]?.nome).toBe('Hidratante');
  });

  it('cadastro e edição aceitam o código da revista e recusam formato inválido', async () => {
    const criado = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: auth(tokenA),
      payload: { nome: 'Creme', codigo_revista: '12.345', preco_venda_centavos: 1000 }
    });
    expect(criado.statusCode).toBe(201);
    expect(criado.json().codigo_revista).toBe('12345');
    const invalido = await app.inject({ method: 'PUT', url: `/api/produtos/${criado.json().id}`, headers: auth(tokenA), payload: { codigo_revista: '12' } });
    expect(invalido.statusCode).toBe(400);
    const editado = await app.inject({ method: 'PUT', url: `/api/produtos/${criado.json().id}`, headers: auth(tokenA), payload: { codigo_revista: '54321' } });
    expect(editado.json().codigo_revista).toBe('54321');
  });
});
