import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
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
    // Remove só os dados deste teste (auditoria primeiro: operador tem onDelete Restrict).
    const ids = { in: [operacaoA, operacaoB] };
    await prisma.registroAuditoria.deleteMany({ where: { operacao_id: ids } });
    await prisma.operacao.deleteMany({ where: { id: ids } });
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
