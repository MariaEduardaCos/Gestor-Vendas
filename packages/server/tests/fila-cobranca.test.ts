import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { gerarUuidV7, hojeNoFuso } from '@consultorasync/core';
import { buildApp } from '../src/app.js';
import { limparOperacoes } from './helpers.js';

function diasAPartirDeHoje(dias: number): string {
  const [a, m, d] = hojeNoFuso().split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

describe('Fila de cobrança do dia', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });
  const operacaoA = gerarUuidV7();
  const operacaoB = gerarUuidV7();
  const operadorA = gerarUuidV7();
  const operadorB = gerarUuidV7();
  let tokenA: string;
  let tokenB: string;
  let produtoId: string;
  const clientes: Record<string, string> = {};

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  const vender = async (cliente: string, vencimentos: string[]) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/vendas',
      headers: auth(tokenA),
      payload: { cliente_id: clientes[cliente], itens: [{ produto_id: produtoId, quantidade: 1, entrega_imediata: true }], vencimentos }
    });
    expect(res.statusCode, res.body).toBe(201);
  };

  const fila = async (token = tokenA) => (await app.inject({ method: 'GET', url: '/api/cobranca/fila', headers: auth(token) })).json();

  beforeAll(async () => {
    await prisma.operacao.createMany({ data: [{ id: operacaoA, nome: 'Operação Fila A' }, { id: operacaoB, nome: 'Operação Fila B' }] });
    await prisma.operador.createMany({
      data: [
        { id: operadorA, operacao_id: operacaoA, nome: 'Revendedora A' },
        { id: operadorB, operacao_id: operacaoB, nome: 'Revendedora B' }
      ]
    });
    tokenA = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: operacaoA, operador_id: operadorA } })).json().token;
    tokenB = (await app.inject({ method: 'POST', url: '/api/auth/login', payload: { operacao_id: operacaoB, operador_id: operadorB } })).json().token;

    produtoId = (await app.inject({ method: 'POST', url: '/api/produtos', headers: auth(tokenA), payload: { nome: 'Creme', preco_venda_centavos: 4000 } })).json().id;
    await app.inject({ method: 'POST', url: '/api/estoque/inicial', headers: auth(tokenA), payload: { produto_id: produtoId, quantidade: 10 } });
    for (const nome of ['Atrasada', 'Hoje', 'Breve', 'Longe']) {
      clientes[nome] = (await app.inject({ method: 'POST', url: '/api/clientes', headers: auth(tokenA), payload: { nome, telefone: '64999990003' } })).json().id;
    }
    await vender('Atrasada', [diasAPartirDeHoje(-4)]);
    await vender('Atrasada', [diasAPartirDeHoje(0)]);
    await vender('Hoje', [diasAPartirDeHoje(0)]);
    await vender('Breve', [diasAPartirDeHoje(2)]);
    await vender('Longe', [diasAPartirDeHoje(20)]);
  });

  afterAll(async () => {
    await limparOperacoes(prisma, [operacaoA, operacaoB]);
    await prisma.$disconnect();
  });

  it('lista uma linha por cliente, na ordem atrasada → vence hoje → em breve, sem vencimentos distantes', async () => {
    const f = await fila();
    expect(f.pendentes.map((i: any) => i.cliente.nome)).toEqual(['Atrasada', 'Hoje', 'Breve']);
    expect(f.pendentes[0]).toMatchObject({ motivo: 'ATRASADA', valor_vencido_centavos: 4000, valor_vence_hoje_centavos: 4000, dias_atraso: 4, cobrada_hoje: false });
    expect(f.pendentes[0].conta_ids).toHaveLength(2);
    expect(f.cobradas_hoje).toEqual([]);
  });

  it('cliente cobrada hoje sai dos pendentes; desfazer devolve para a fila', async () => {
    const contato = await app.inject({
      method: 'POST',
      url: '/api/cobranca/contatos',
      headers: auth(tokenA),
      payload: { cliente_id: clientes.Hoje, canal: 'WHATSAPP', motivo: 'VENCE_HOJE', valor_centavos: 4000 }
    });
    expect(contato.statusCode).toBe(201);

    let f = await fila();
    expect(f.pendentes.map((i: any) => i.cliente.nome)).toEqual(['Atrasada', 'Breve']);
    expect(f.cobradas_hoje[0]).toMatchObject({ cliente: { nome: 'Hoje' }, ultimo_contato: { canal: 'WHATSAPP' } });

    const desfeito = await app.inject({ method: 'DELETE', url: `/api/cobranca/contatos/hoje/${clientes.Hoje}`, headers: auth(tokenA) });
    expect(desfeito.json().removidos).toBe(1);
    f = await fila();
    expect(f.pendentes.map((i: any) => i.cliente.nome)).toContain('Hoje');
  });

  it('janela de lembrete configurável', async () => {
    const f = (await app.inject({ method: 'GET', url: '/api/cobranca/fila?dias=0', headers: auth(tokenA) })).json();
    expect(f.pendentes.map((i: any) => i.cliente.nome)).toEqual(['Atrasada', 'Hoje']);
  });

  it('não registra contato para cliente de outra operação, nem com canal inválido', async () => {
    const outra = await app.inject({ method: 'POST', url: '/api/cobranca/contatos', headers: auth(tokenB), payload: { cliente_id: clientes.Atrasada } });
    expect(outra.statusCode).toBe(404);
    const canal = await app.inject({ method: 'POST', url: '/api/cobranca/contatos', headers: auth(tokenA), payload: { cliente_id: clientes.Atrasada, canal: 'SMS' } });
    expect(canal.statusCode).toBe(400);
    expect((await fila(tokenB)).pendentes).toEqual([]);
  });
});
