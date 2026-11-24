import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { limparOperacoes } from './helpers.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Boletos da marca no financeiro', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });
  const [opA, opB, operadorA, operadorB, marcaId] = [gerarUuidV7(), gerarUuidV7(), gerarUuidV7(), gerarUuidV7(), gerarUuidV7()];
  let tokenA: string;
  let tokenB: string;
  const auth = (t: string) => ({ authorization: `Bearer ${t}` });
  const LINHA = '34191.79001 01043.510047 91020.150008 5 91230000026000';

  beforeAll(async () => {
    for (const [op, operador] of [[opA, operadorA], [opB, operadorB]]) {
      await prisma.operacao.create({ data: { id: op, nome: 'Op Boletos' } });
      await prisma.operador.create({ data: { id: operador, operacao_id: op, nome: 'Revendedora' } });
    }
    await prisma.marca.create({ data: { id: marcaId, operacao_id: opA, nome: 'Marca Boleto' } });
    const login = async (op: string, operador: string) =>
      (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: op, operador_id: operador } })).json().token;
    tokenA = await login(opA, operadorA);
    tokenB = await login(opB, operadorB);
  });

  afterAll(async () => {
    await limparOperacoes(prisma, [opA, opB]);
    await prisma.$disconnect();
  });

  it('adiciona, lista com totais, paga, reabre e exclui', async () => {
    const criado = await app.inject({
      method: 'POST', url: '/api/boletos', headers: auth(tokenA),
      payload: { descricao: 'Pedido ciclo 17', valor_centavos: 26000, vencimento: '2020-01-10', linha_digitavel: LINHA, marca_id: marcaId }
    });
    expect(criado.statusCode).toBe(201);
    const boleto = criado.json();
    expect(boleto).toMatchObject({ descricao: 'Pedido ciclo 17', valor_centavos: 26000, vencimento: '2020-01-10', status: 'ABERTO', vencido: true, marca_nome: 'Marca Boleto' });
    expect(boleto.linha_digitavel).toBe(LINHA.replace(/[\s.]/g, ''));

    await app.inject({ method: 'POST', url: '/api/boletos', headers: auth(tokenA), payload: { descricao: 'Futuro', valor_centavos: 1000, vencimento: '2999-12-31' } });
    const lista = (await app.inject({ method: 'GET', url: '/api/boletos', headers: auth(tokenA) })).json();
    expect(lista.boletos).toHaveLength(2);
    expect(lista).toMatchObject({ total_aberto_centavos: 27000, total_vencido_centavos: 26000, total_pago_centavos: 0 });

    const pago = (await app.inject({ method: 'POST', url: `/api/boletos/${boleto.id}/pagar`, headers: auth(tokenA) })).json();
    expect(pago).toMatchObject({ status: 'PAGO', vencido: false });
    expect(pago.pago_em).not.toBeNull();
    const depois = (await app.inject({ method: 'GET', url: '/api/boletos', headers: auth(tokenA) })).json();
    expect(depois).toMatchObject({ total_aberto_centavos: 1000, total_vencido_centavos: 0, total_pago_centavos: 26000 });

    const reaberto = (await app.inject({ method: 'POST', url: `/api/boletos/${boleto.id}/reabrir`, headers: auth(tokenA) })).json();
    expect(reaberto).toMatchObject({ status: 'ABERTO', pago_em: null });

    expect((await app.inject({ method: 'DELETE', url: `/api/boletos/${boleto.id}`, headers: auth(tokenA) })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/boletos', headers: auth(tokenA) })).json().boletos).toHaveLength(1);
  });

  it('recusa dados inválidos', async () => {
    const tentar = async (payload: object) => (await app.inject({ method: 'POST', url: '/api/boletos', headers: auth(tokenA), payload })).statusCode;
    expect(await tentar({ descricao: '', valor_centavos: 1000, vencimento: '2030-01-01' })).toBe(400);
    expect(await tentar({ descricao: 'Ok', valor_centavos: 0, vencimento: '2030-01-01' })).toBe(400);
    expect(await tentar({ descricao: 'Ok', valor_centavos: 1000, vencimento: 'amanhã' })).toBe(400);
    expect(await tentar({ descricao: 'Ok', valor_centavos: 1000, vencimento: '2030-01-01', linha_digitavel: '12345' })).toBe(400);
    expect(await tentar({ descricao: 'Ok', valor_centavos: 1000, vencimento: '2030-01-01', marca_id: gerarUuidV7() })).toBe(400);
  });

  it('outra operação não vê nem altera o boleto', async () => {
    const boleto = (await app.inject({ method: 'POST', url: '/api/boletos', headers: auth(tokenA), payload: { descricao: 'Privado', valor_centavos: 500, vencimento: '2030-01-01' } })).json();
    expect((await app.inject({ method: 'GET', url: '/api/boletos', headers: auth(tokenB) })).json().boletos).toHaveLength(0);
    expect((await app.inject({ method: 'POST', url: `/api/boletos/${boleto.id}/pagar`, headers: auth(tokenB) })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/boletos/${boleto.id}`, headers: auth(tokenB) })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/boletos', headers: auth(tokenB), payload: { descricao: 'X', valor_centavos: 500, vencimento: '2030-01-01', marca_id: marcaId } })).statusCode).toBe(400);
  });
});
