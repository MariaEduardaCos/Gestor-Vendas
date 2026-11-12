import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { limparOperacoes } from './helpers.js';
import { gerarUuidV7, hojeNoFuso } from '@consultorasync/core';

/** Data relativa a hoje (Brasília), em AAAA-MM-DD. */
function diasAPartirDeHoje(dias: number): string {
  const d = new Date(`${hojeNoFuso()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

describe('Cobrança: vencimentos, parcelas e atraso (FR-036)', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });
  const operacaoA = gerarUuidV7();
  const operacaoB = gerarUuidV7();
  const operadorA = gerarUuidV7();
  const operadorB = gerarUuidV7();
  let tokenA: string;
  let tokenB: string;
  let clienteId: string;
  let produtoId: string;
  let contaId: string;

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  beforeAll(async () => {
    await prisma.operacao.createMany({ data: [{ id: operacaoA, nome: 'Operação Cobrança A' }, { id: operacaoB, nome: 'Operação Cobrança B' }] });
    await prisma.operador.createMany({
      data: [
        { id: operadorA, operacao_id: operacaoA, nome: 'Revendedora A' },
        { id: operadorB, operacao_id: operacaoB, nome: 'Revendedora B' }
      ]
    });
    tokenA = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: operacaoA, operador_id: operadorA } })).json().token;
    tokenB = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: operacaoB, operador_id: operadorB } })).json().token;

    produtoId = (await app.inject({ method: 'POST', url: '/api/produtos', headers: auth(tokenA), payload: { nome: 'Hidratante', preco_venda_centavos: 9000 } })).json().id;
    await app.inject({ method: 'POST', url: '/api/estoque/inicial', headers: auth(tokenA), payload: { produto_id: produtoId, quantidade: 5 } });
    clienteId = (await app.inject({ method: 'POST', url: '/api/clientes', headers: auth(tokenA), payload: { nome: 'Ana Cobrança', telefone: '64999990001' } })).json().id;
  });

  afterAll(async () => {
    await limparOperacoes(prisma, [operacaoA, operacaoB]);
    await prisma.$disconnect();
  });

  const contaDaLista = async (id: string) =>
    (await app.inject({ method: 'GET', url: '/api/vendas', headers: auth(tokenA) })).json().find((c: any) => c.id === id);

  it('venda parcelada em 3x com a primeira parcela vencida fica atrasada no valor de uma parcela', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vendas',
      headers: auth(tokenA),
      payload: {
        cliente_id: clienteId,
        itens: [{ produto_id: produtoId, quantidade: 1, entrega_imediata: true }],
        primeiro_vencimento: diasAPartirDeHoje(-5),
        parcelas: 3
      }
    });
    expect(res.statusCode).toBe(201);
    contaId = res.json().conta.id;

    const conta = await contaDaLista(contaId);
    expect(conta.parcelas).toHaveLength(3);
    expect(conta.cobranca).toMatchObject({ situacao: 'ATRASADA', valor_vencido_centavos: 3000, dias_atraso: 5, saldo_centavos: 9000 });
  });

  it('pagar a parcela vencida deixa a conta em dia', async () => {
    const pagamento = await app.inject({
      method: 'POST',
      url: `/api/contas/${contaId}/pagamentos`,
      headers: auth(tokenA),
      payload: { valor_centavos: 3000, forma_pagamento: 'PIX', idempotency_key: crypto.randomUUID() }
    });
    expect(pagamento.statusCode, pagamento.body).toBe(201);
    const detalhe = (await app.inject({ method: 'GET', url: `/api/contas/${contaId}`, headers: auth(tokenA) })).json();
    expect(detalhe.cobranca.situacao).toBe('EM_DIA');
  });

  it('remover os vencimentos deixa a conta sem vencimento (nunca atrasada)', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/contas/${contaId}/vencimentos`, headers: auth(tokenA), payload: { vencimentos: [] } });
    expect(res.json().cobranca.situacao).toBe('SEM_VENCIMENTO');
    expect(await prisma.parcelaConta.count({ where: { conta_id: contaId } })).toBe(0);
  });

  it('recusa data inválida sem criar a venda nem mexer no estoque', async () => {
    const antes = await prisma.estoqueItem.findFirst({ where: { produto_id: produtoId } });
    const res = await app.inject({
      method: 'POST',
      url: '/api/vendas',
      headers: auth(tokenA),
      payload: { cliente_id: clienteId, itens: [{ produto_id: produtoId, quantidade: 1 }], vencimentos: ['2026-02-30'] }
    });
    expect(res.statusCode).toBe(400);
    const depois = await prisma.estoqueItem.findFirst({ where: { produto_id: produtoId } });
    expect(depois?.pronta_entrega).toBe(antes?.pronta_entrega);
  });

  it('outra operação não altera vencimentos de conta alheia', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/contas/${contaId}/vencimentos`, headers: auth(tokenB), payload: { vencimentos: ['2027-01-01'] } });
    expect(res.statusCode).toBe(404);
  });
});
