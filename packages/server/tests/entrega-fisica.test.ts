import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Story 4.3: Confirmação de Entrega Física Total e Parcial com Baixa de Estoque (FR-027, FR-028, FR-031, AD-3, NFR-001, NFR-003)', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });

  const operacaoAId = gerarUuidV7();
  const operacaoBId = gerarUuidV7();
  const operadorSoniaId = gerarUuidV7();
  const operadorBId = gerarUuidV7();

  let tokenSoniaA: string;
  let tokenOutroB: string;

  let marcaAId: string;
  let clienteAnaAId: string;
  let clienteBId: string;
  let produtoShampooAId: string;
  let produtoCondicionadorAId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Limpeza
    await prisma.registroIdempotencia.deleteMany();
    await prisma.itemCompraMarca.deleteMany();
    await prisma.compraMarca.deleteMany();
    await prisma.itemConta.deleteMany();
    await prisma.encomenda.deleteMany();
    await prisma.conta.deleteMany();
    await prisma.movimentacaoEstoque.deleteMany();
    await prisma.estoqueItem.deleteMany();
    await prisma.produto.deleteMany();
    await prisma.marca.deleteMany();
    await prisma.cliente.deleteMany();
    await prisma.registroAuditoria.deleteMany();
    await prisma.operador.deleteMany();
    await prisma.operacao.deleteMany();

    // Operações e operadores
    await prisma.operacao.create({
      data: { id: operacaoAId, nome: 'Consultoria Dona Sônia' }
    });
    await prisma.operador.create({
      data: { id: operadorSoniaId, operacao_id: operacaoAId, nome: 'Dona Sônia', ativo: true }
    });

    await prisma.operacao.create({
      data: { id: operacaoBId, nome: 'Operação Inquilino B' }
    });
    await prisma.operador.create({
      data: { id: operadorBId, operacao_id: operacaoBId, nome: 'Operador B', ativo: true }
    });

    // Login com snake_case
    const loginA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { operacao_id: operacaoAId, operador_id: operadorSoniaId }
    });
    tokenSoniaA = loginA.json().token;

    const loginB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { operacao_id: operacaoBId, operador_id: operadorBId }
    });
    tokenOutroB = loginB.json().token;

    // Marca e Clientes
    marcaAId = gerarUuidV7();
    await prisma.marca.create({
      data: { id: marcaAId, operacao_id: operacaoAId, nome: 'Natura Cosméticos' }
    });

    clienteAnaAId = gerarUuidV7();
    await prisma.cliente.create({
      data: { id: clienteAnaAId, operacao_id: operacaoAId, nome: 'Ana Paula Entrega', telefone: '(11) 98888-3333' }
    });

    clienteBId = gerarUuidV7();
    await prisma.cliente.create({
      data: { id: clienteBId, operacao_id: operacaoBId, nome: 'Cliente Outro Inquilino' }
    });

    // Produtos
    produtoShampooAId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoShampooAId,
        operacao_id: operacaoAId,
        marca_id: marcaAId,
        nome: 'Shampoo Murumuru 300ml',
        preco_venda_centavos: 4200
      }
    });

    produtoCondicionadorAId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoCondicionadorAId,
        operacao_id: operacaoAId,
        marca_id: marcaAId,
        nome: 'Condicionador Murumuru 300ml',
        preco_venda_centavos: 4500
      }
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('deve realizar entrega física de item individual baixando presentes e liquidando reserva sem alterar pronta-entrega (FR-027, FR-028, AD-3)', async () => {
    // Cria estoque do Shampoo: 2 presentes, 2 reservados (sacola da cliente), 0 pronta_entrega
    const estoqueItemId = gerarUuidV7();
    await prisma.estoqueItem.create({
      data: {
        id: estoqueItemId,
        operacao_id: operacaoAId,
        produto_id: produtoShampooAId,
        presentes: 2,
        reservados: 2,
        pronta_entrega: 0
      }
    });

    // Cria Conta com 2 itens: 1 Shampoo (RESERVADO_PRESENTE) e 1 Condicionador (AGUARDANDO_FABRICA)
    const contaId = gerarUuidV7();
    await prisma.conta.create({
      data: {
        id: contaId,
        operacao_id: operacaoAId,
        cliente_id: clienteAnaAId,
        valor_total: 8700,
        total_pago: 0,
        status: 'ABERTA'
      }
    });

    const itemShampooId = gerarUuidV7();
    await prisma.itemConta.create({
      data: {
        id: itemShampooId,
        operacao_id: operacaoAId,
        conta_id: contaId,
        produto_id: produtoShampooAId,
        quantidade: 1,
        preco_unitario_centavos: 4200,
        status_entrega: 'RESERVADO_PRESENTE'
      }
    });

    const itemCondicionadorId = gerarUuidV7();
    await prisma.itemConta.create({
      data: {
        id: itemCondicionadorId,
        operacao_id: operacaoAId,
        conta_id: contaId,
        produto_id: produtoCondicionadorAId,
        quantidade: 1,
        preco_unitario_centavos: 4500,
        status_entrega: 'AGUARDANDO_FABRICA'
      }
    });

    // Executa entrega física apenas do Shampoo
    const res = await app.inject({
      method: 'POST',
      url: `/api/contas/${contaId}/itens/${itemShampooId}/entregar`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.item.status_entrega).toBe('ENTREGUE');
    // Status consolidado da conta: PARCIALMENTE_ENTREGUE pois o condicionador continua aguardando fábrica
    expect(body.status_entrega_conta).toBe('PARCIALMENTE_ENTREGUE');

    // Validação estrita da regra de conservação de estoque (AD-3):
    // Presentes caiu de 2 para 1
    // Reservados caiu de 2 para 1
    // Pronta-entrega permaneceu em 0
    // Presentes (1) = Reservados (1) + ProntaEntrega (0)
    const estoqueAtualizado = await prisma.estoqueItem.findUnique({
      where: { id: estoqueItemId }
    });
    expect(estoqueAtualizado?.presentes).toBe(1);
    expect(estoqueAtualizado?.reservados).toBe(1);
    expect(estoqueAtualizado?.pronta_entrega).toBe(0);
    expect(estoqueAtualizado?.presentes).toBe(
      (estoqueAtualizado?.reservados ?? 0) + (estoqueAtualizado?.pronta_entrega ?? 0)
    );

    // Movimentação de SAIDA_VENDA com rastreabilidade nominal (NFR-003)
    const mov = await prisma.movimentacaoEstoque.findFirst({
      where: { produto_id: produtoShampooAId, operacao_id: operacaoAId },
      orderBy: { criado_em: 'desc' }
    });
    expect(mov?.tipo).toBe('SAIDA_VENDA');
    expect(mov?.quantidade).toBe(1);
    expect(mov?.presentes_anterior).toBe(2);
    expect(mov?.presentes_posterior).toBe(1);
    expect(mov?.reservados_anterior).toBe(2);
    expect(mov?.reservados_posterior).toBe(1);
    expect(mov?.operador_nome).toBe('Dona Sônia');
  });

  it('deve realizar entrega física total de todos os itens disponíveis da conta (FR-027, FR-031, AD-3)', async () => {
    // Estoque do Condicionador: 2 presentes, 2 reservados, 0 pronta-entrega
    const estoqueItemId = gerarUuidV7();
    await prisma.estoqueItem.create({
      data: {
        id: estoqueItemId,
        operacao_id: operacaoAId,
        produto_id: produtoCondicionadorAId,
        presentes: 2,
        reservados: 2,
        pronta_entrega: 0
      }
    });

    const contaTotalId = gerarUuidV7();
    await prisma.conta.create({
      data: {
        id: contaTotalId,
        operacao_id: operacaoAId,
        cliente_id: clienteAnaAId,
        valor_total: 9000,
        total_pago: 0,
        status: 'ABERTA'
      }
    });

    await prisma.itemConta.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: operacaoAId,
        conta_id: contaTotalId,
        produto_id: produtoCondicionadorAId,
        quantidade: 2,
        preco_unitario_centavos: 4500,
        status_entrega: 'RESERVADO_PRESENTE'
      }
    });

    // Entrega de tudo que chegou
    const res = await app.inject({
      method: 'POST',
      url: `/api/contas/${contaTotalId}/entregar-tudo`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status_entrega_conta).toBe('ENTREGUE');
    expect(body.itens_entregues).toHaveLength(1);

    // Estoque físico após entrega: 0 presentes, 0 reservados, 0 pronta entrega
    const estoque = await prisma.estoqueItem.findUnique({ where: { id: estoqueItemId } });
    expect(estoque?.presentes).toBe(0);
    expect(estoque?.reservados).toBe(0);
    expect(estoque?.pronta_entrega).toBe(0);
  });

  it('deve recusar entrega física de item com status AGUARDANDO_FABRICA (FR-027, FR-028)', async () => {
    const contaId = gerarUuidV7();
    await prisma.conta.create({
      data: {
        id: contaId,
        operacao_id: operacaoAId,
        cliente_id: clienteAnaAId,
        valor_total: 4200,
        total_pago: 0,
        status: 'ABERTA'
      }
    });

    const itemId = gerarUuidV7();
    await prisma.itemConta.create({
      data: {
        id: itemId,
        operacao_id: operacaoAId,
        conta_id: contaId,
        produto_id: produtoShampooAId,
        quantidade: 1,
        preco_unitario_centavos: 4200,
        status_entrega: 'AGUARDANDO_FABRICA'
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/contas/${contaId}/itens/${itemId}/entregar`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ITEM_NAO_DISPONIVEL_PARA_ENTREGA');
  });

  it('deve recusar entrega duplicada de item que já foi entregue anteriormente (FR-027, AD-3)', async () => {
    const contaId = gerarUuidV7();
    await prisma.conta.create({
      data: {
        id: contaId,
        operacao_id: operacaoAId,
        cliente_id: clienteAnaAId,
        valor_total: 4200,
        total_pago: 0,
        status: 'ABERTA'
      }
    });

    const itemId = gerarUuidV7();
    await prisma.itemConta.create({
      data: {
        id: itemId,
        operacao_id: operacaoAId,
        conta_id: contaId,
        produto_id: produtoShampooAId,
        quantidade: 1,
        preco_unitario_centavos: 4200,
        status_entrega: 'ENTREGUE'
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/contas/${contaId}/itens/${itemId}/entregar`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ITEM_JA_ENTREGUE');
  });

  it('deve assegurar isolamento multi-inquilino impedindo operador B de entregar item de conta da operação A (AD-1)', async () => {
    const contaId = gerarUuidV7();
    await prisma.conta.create({
      data: {
        id: contaId,
        operacao_id: operacaoAId,
        cliente_id: clienteAnaAId,
        valor_total: 4200,
        total_pago: 0,
        status: 'ABERTA'
      }
    });

    const itemId = gerarUuidV7();
    await prisma.itemConta.create({
      data: {
        id: itemId,
        operacao_id: operacaoAId,
        conta_id: contaId,
        produto_id: produtoShampooAId,
        quantidade: 1,
        preco_unitario_centavos: 4200,
        status_entrega: 'RESERVADO_PRESENTE'
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/contas/${contaId}/itens/${itemId}/entregar`,
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('ITEM_NAO_ENCONTRADO');
  });
});
