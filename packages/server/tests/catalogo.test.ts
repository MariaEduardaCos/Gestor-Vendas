import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { limparOperacoes } from './helpers.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Catálogo da marca: prévia e atualização dos produtos pelo ciclo', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });
  const operacaoA = gerarUuidV7();
  const operacaoB = gerarUuidV7();
  const operadorA = gerarUuidV7();
  const operadorB = gerarUuidV7();
  let tokenA: string;
  let tokenB: string;
  let marcaId: string;

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  beforeAll(async () => {
    await prisma.operacao.createMany({ data: [{ id: operacaoA, nome: 'Operação Catálogo A' }, { id: operacaoB, nome: 'Operação Catálogo B' }] });
    await prisma.operador.createMany({
      data: [
        { id: operadorA, operacao_id: operacaoA, nome: 'Revendedora A' },
        { id: operadorB, operacao_id: operacaoB, nome: 'Revendedora B' }
      ]
    });
    tokenA = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: operacaoA, operador_id: operadorA } })).json().token;
    tokenB = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: operacaoB, operador_id: operadorB } })).json().token;

    marcaId = (await app.inject({ method: 'POST', url: '/api/marcas', headers: auth(tokenA), payload: { nome: 'Natura', percentual_padrao: 30 } })).json().id;

    // Produto já cadastrado com custo informado manualmente (deve ser preservado)
    await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: auth(tokenA),
      payload: { marca_id: marcaId, nome: 'Perfume Essencial', variante: '100ml', preco_venda_centavos: 18990, custo_manual_centavos: 12000 }
    });
  });

  afterAll(async () => {
    await limparOperacoes(prisma, [operacaoA, operacaoB]);
    await prisma.produtoReferencia.deleteMany({ where: { marca_chave: 'natura' } });
    await prisma.$disconnect();
  });

  const catalogo = [
    { codigoBarras: '7891033000011', nome: 'Hidratante Tododia', variante: 'Algodão 400ml', precoVendaCentavos: 5990 },
    { codigoBarras: null, nome: 'perfume essencial', variante: '100ML', precoVendaCentavos: 19990 }
  ];

  it('prévia mostra novos e preços alterados sem gravar nada', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/marcas/${marcaId}/catalogo`,
      headers: auth(tokenA),
      payload: { ciclo: 'Ciclo 17/2026', itens: catalogo, simular: true }
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ aplicado: false, novos: 1, precos_alterados: 1, sem_mudanca: 0 });
    expect(await prisma.produto.count({ where: { marca_id: marcaId } })).toBe(1);
  });

  it('aplicar cria o novo com custo estimado pela marca e atualiza o preço mantendo o custo informado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/marcas/${marcaId}/catalogo`,
      headers: auth(tokenA),
      payload: { ciclo: 'Ciclo 17/2026', itens: catalogo }
    });
    expect(res.json()).toMatchObject({ aplicado: true, novos: 1, precos_alterados: 1 });

    const produtos = await prisma.produto.findMany({ where: { marca_id: marcaId }, orderBy: { nome: 'asc' } });
    expect(produtos).toHaveLength(2);
    const [hidratante, perfume] = produtos;
    expect(hidratante).toMatchObject({ preco_venda_centavos: 5990, custo_centavos: 4193, proveniencia_custo: 'ESTIMADO_PERCENTUAL', ciclo_catalogo: 'Ciclo 17/2026' });
    expect(perfume).toMatchObject({ preco_venda_centavos: 19990, custo_centavos: 12000, proveniencia_custo: 'INFORMADO_MANUAL' });

    const marcas = (await app.inject({ method: 'GET', url: '/api/marcas', headers: auth(tokenA) })).json();
    expect(marcas[0]).toMatchObject({ catalogo_ciclo: 'Ciclo 17/2026', quantidade_produtos: 2 });
  });

  it('repetir o mesmo catálogo não duplica produtos', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/marcas/${marcaId}/catalogo`,
      headers: auth(tokenA),
      payload: { ciclo: 'Ciclo 17/2026', itens: catalogo }
    });
    expect(res.json()).toMatchObject({ novos: 0, precos_alterados: 0, sem_mudanca: 2 });
    expect(await prisma.produto.count({ where: { marca_id: marcaId } })).toBe(2);
  });

  it('recusa catálogo sem ciclo ou com preço inválido', async () => {
    const semCiclo = await app.inject({ method: 'POST', url: `/api/marcas/${marcaId}/catalogo`, headers: auth(tokenA), payload: { ciclo: ' ', itens: catalogo } });
    const precoRuim = await app.inject({
      method: 'POST',
      url: `/api/marcas/${marcaId}/catalogo`,
      headers: auth(tokenA),
      payload: { ciclo: 'C1', itens: [{ codigoBarras: null, nome: 'X', variante: null, precoVendaCentavos: 0 }] }
    });
    expect(semCiclo.statusCode).toBe(400);
    expect(precoRuim.statusCode).toBe(400);
  });

  it('catálogo salvo vira referência compartilhada: outra revendedora da mesma marca vê e usa, sem dados da operação A', async () => {
    const marcaB = (await app.inject({ method: 'POST', url: '/api/marcas', headers: auth(tokenB), payload: { nome: 'NATURA', percentual_padrao: 25 } })).json().id;

    const marcasB = (await app.inject({ method: 'GET', url: '/api/marcas', headers: auth(tokenB) })).json();
    expect(marcasB[0].catalogo_compartilhado_quantidade).toBe(2);

    const ref = (await app.inject({ method: 'GET', url: `/api/marcas/${marcaB}/catalogo-compartilhado`, headers: auth(tokenB) })).json();
    expect(ref).toMatchObject({ ciclo: 'Ciclo 17/2026', quantidade: 2 });
    expect(Object.keys(ref.itens[0]).sort()).toEqual(['codigoBarras', 'codigoRevista', 'imagemUrl', 'nome', 'precoVendaCentavos', 'variante']);

    const aplicar = await app.inject({
      method: 'POST',
      url: `/api/marcas/${marcaB}/catalogo`,
      headers: auth(tokenB),
      payload: { ciclo: ref.ciclo, itens: ref.itens }
    });
    expect(aplicar.json()).toMatchObject({ novos: 2 });
    // Custo de B usa o percentual de B (25%), não o de A
    const hidratanteB = await prisma.produto.findFirst({ where: { operacao_id: operacaoB, codigo_barras: '7891033000011' } });
    expect(hidratanteB).toMatchObject({ custo_centavos: 4493 });

    const porCodigo = (await app.inject({ method: 'GET', url: '/api/catalogo-compartilhado/codigo/7891033000011', headers: auth(tokenB) })).json();
    expect(porCodigo[0]).toMatchObject({ nome: 'Hidratante Tododia', preco_sugerido_centavos: 5990 });
  });

  it('com compartilhar = false o catálogo não entra na referência', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/marcas/${marcaId}/catalogo`,
      headers: auth(tokenA),
      payload: { ciclo: 'Ciclo 18/2026', itens: [{ codigoBarras: null, nome: 'Produto Privado', variante: null, precoVendaCentavos: 1000 }], compartilhar: false }
    });
    expect(await prisma.produtoReferencia.count({ where: { nome: 'Produto Privado' } })).toBe(0);
  });

  it('outra operação não consegue carregar catálogo na marca alheia', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/marcas/${marcaId}/catalogo`, headers: auth(tokenB), payload: { ciclo: 'C1', itens: catalogo } });
    expect(res.statusCode).toBe(404);
  });

  it('sessão de operador que não existe mais é recusada', async () => {
    await prisma.operador.update({ where: { id: operadorB }, data: { ativo: false } });
    const res = await app.inject({ method: 'GET', url: '/api/marcas', headers: auth(tokenB) });
    expect(res.statusCode).toBe(401);
  });
});
