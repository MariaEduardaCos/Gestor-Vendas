import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { gerarUuidV7 } from '@consultorasync/core';
import { buildApp } from '../src/app.js';
import { limparOperacoes } from './helpers.js';

describe('Exportação de dados (CSV e cópia completa)', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });
  const operacaoA = gerarUuidV7();
  const operacaoB = gerarUuidV7();
  const operadorA = gerarUuidV7();
  const operadorB = gerarUuidV7();
  let tokenA: string;
  let tokenB: string;

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  beforeAll(async () => {
    await prisma.operacao.createMany({ data: [{ id: operacaoA, nome: 'Operação Export A' }, { id: operacaoB, nome: 'Operação Export B' }] });
    await prisma.operador.createMany({
      data: [
        { id: operadorA, operacao_id: operacaoA, nome: 'Revendedora A' },
        { id: operadorB, operacao_id: operacaoB, nome: 'Revendedora B' }
      ]
    });
    tokenA = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: operacaoA, operador_id: operadorA } })).json().token;
    tokenB = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: operacaoB, operador_id: operadorB } })).json().token;

    const produtoId = (await app.inject({
      method: 'POST', url: '/api/produtos', headers: auth(tokenA),
      payload: { nome: 'Batom "Rosa"', variante: 'Mate', preco_venda_centavos: 4590 }
    })).json().id;
    await app.inject({ method: 'POST', url: '/api/estoque/inicial', headers: auth(tokenA), payload: { produto_id: produtoId, quantidade: 3 } });
    const clienteId = (await app.inject({
      method: 'POST', url: '/api/clientes', headers: auth(tokenA),
      payload: { nome: '=Ana; da Silva', telefone: '64999990002' }
    })).json().id;
    const venda = await app.inject({
      method: 'POST', url: '/api/vendas', headers: auth(tokenA),
      payload: { cliente_id: clienteId, itens: [{ produto_id: produtoId, quantidade: 2, entrega_imediata: true }] }
    });
    expect(venda.statusCode, venda.body).toBe(201);
    await app.inject({ method: 'POST', url: '/api/clientes', headers: auth(tokenB), payload: { nome: 'Cliente da outra revendedora' } });
  });

  afterAll(async () => {
    await limparOperacoes(prisma, [operacaoA, operacaoB]);
    await prisma.$disconnect();
  });

  it('exige sessão', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/exportar/clientes.csv' });
    expect(res.statusCode).toBe(401);
  });

  it('clientes.csv vem como anexo, no formato do Excel, só com as clientes da operação e com fórmula neutralizada', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/exportar/clientes.csv', headers: auth(tokenA) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="clientes-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(res.body.startsWith('﻿Nome;Telefone')).toBe(true);
    expect(res.body).toContain(`"'=Ana; da Silva"`);
    expect(res.body).toContain(';91,8;'); // 2 × R$ 45,90 em aberto
    expect(res.body).not.toContain('outra revendedora');
  });

  it('itens vendidos, contas, pagamentos e estoque', async () => {
    const vendas = (await app.inject({ method: 'GET', url: '/api/exportar/vendas.csv', headers: auth(tokenA) })).body;
    expect(vendas).toContain('"Batom ""Rosa"""');
    expect(vendas).toContain(';2;45,9;91,8;');
    expect(vendas).toContain('Entregue');

    const contas = (await app.inject({ method: 'GET', url: '/api/exportar/contas.csv', headers: auth(tokenA) })).body;
    expect(contas).toContain('Sem vencimento');

    const pagamentos = await app.inject({ method: 'GET', url: '/api/exportar/pagamentos.csv', headers: auth(tokenA) });
    expect(pagamentos.statusCode).toBe(200);

    const estoque = (await app.inject({ method: 'GET', url: '/api/exportar/estoque.csv', headers: auth(tokenA) })).body;
    expect(estoque).toContain(';1;0;1;'); // 3 em casa - 2 entregues = 1, nenhum reservado, 1 pronta-entrega
  });

  it('tipo desconhecido devolve 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/exportar/senhas.csv', headers: auth(tokenA) });
    expect(res.statusCode).toBe(404);
  });

  it('cópia completa traz os dados da operação, sem PIN e sem dados de outra operação, e fica na auditoria', async () => {
    await prisma.operador.update({ where: { id: operadorA }, data: { pin_hash: 'scrypt$segredo$naoexportar' } });
    const res = await app.inject({ method: 'GET', url: '/api/exportar/copia.json', headers: auth(tokenA) });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/copia-consultorasync-.*\.json/);
    const copia = res.json();
    expect(copia.formato).toBe('consultorasync-copia');
    expect(copia.operacao.id).toBe(operacaoA);
    expect(copia.dados.clientes).toHaveLength(1);
    expect(copia.dados.contas).toHaveLength(1);
    expect(copia.dados.itens_conta).toHaveLength(1);
    expect(res.body).not.toContain('naoexportar');
    expect(res.body).not.toContain('pin_hash');
    expect(res.body).not.toContain('outra revendedora');

    const auditoria = await prisma.registroAuditoria.findMany({ where: { operacao_id: operacaoA, acao: 'EXPORTAR_DADOS' } });
    expect(auditoria.length).toBeGreaterThanOrEqual(2);
  });
});
