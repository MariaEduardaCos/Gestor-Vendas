import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Story 4.4: Cancelamento com Liberação de Reserva e Ajuste Justificado de Inventário (FR-029, FR-030, D-09, AD-3, NFR-001, NFR-003)', () => {
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
  let produtoOleoAId: string;
  let produtoSaboneteAId: string;

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

    // Sessões
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
      data: { id: clienteAnaAId, operacao_id: operacaoAId, nome: 'Ana Desistência', telefone: '(11) 98888-4444' }
    });

    clienteBId = gerarUuidV7();
    await prisma.cliente.create({
      data: { id: clienteBId, operacao_id: operacaoBId, nome: 'Cliente B' }
    });

    // Produtos
    produtoOleoAId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoOleoAId,
        operacao_id: operacaoAId,
        marca_id: marcaAId,
        nome: 'Óleo Corporal Séve Amêndoas 200ml',
        preco_venda_centavos: 6990
      }
    });

    produtoSaboneteAId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoSaboneteAId,
        operacao_id: operacaoAId,
        marca_id: marcaAId,
        nome: 'Sabonete Tododia Noz Pecã Caixa c/ 5',
        preco_venda_centavos: 2890
      }
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('deve cancelar item reservado liberando a unidade para pronta-entrega mantendo presentes inalterado (FR-029, D-09, AD-3)', async () => {
    // Estoque inicial do Óleo: 2 presentes, 2 reservados para a cliente, 0 pronta-entrega
    const estoqueItemId = gerarUuidV7();
    await prisma.estoqueItem.create({
      data: {
        id: estoqueItemId,
        operacao_id: operacaoAId,
        produto_id: produtoOleoAId,
        presentes: 2,
        reservados: 2,
        pronta_entrega: 0
      }
    });

    // Conta da Ana com 2 unidades do Óleo reservadas
    const contaId = gerarUuidV7();
    await prisma.conta.create({
      data: {
        id: contaId,
        operacao_id: operacaoAId,
        cliente_id: clienteAnaAId,
        valor_total: 13980,
        total_pago: 0,
        status: 'ABERTA'
      }
    });

    const itemContaId = gerarUuidV7();
    await prisma.itemConta.create({
      data: {
        id: itemContaId,
        operacao_id: operacaoAId,
        conta_id: contaId,
        produto_id: produtoOleoAId,
        quantidade: 1, // cancela 1 unidade
        preco_unitario_centavos: 6990,
        status_entrega: 'RESERVADO_PRESENTE'
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/contas/${contaId}/itens/${itemContaId}/cancelar`,
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: { motivo: 'Cliente desistiu por motivo financeiro' }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.item.status_entrega).toBe('CANCELADO');
    expect(body.conta.valor_total).toBe(0);

    // Validação estrita da regra de conservação de estoque (AD-3, FR-029):
    // Presentes DEVE permanecer em 2!
    // Reservados cai de 2 para 1!
    // Pronta-entrega sobe de 0 para 1!
    // Presentes (2) = Reservados (1) + ProntaEntrega (1)
    const estoque = await prisma.estoqueItem.findUnique({ where: { id: estoqueItemId } });
    expect(estoque?.presentes).toBe(2);
    expect(estoque?.reservados).toBe(1);
    expect(estoque?.pronta_entrega).toBe(1);
    expect(estoque?.presentes).toBe((estoque?.reservados ?? 0) + (estoque?.pronta_entrega ?? 0));

    // Auditoria de movimentação do tipo CANCELAMENTO_RESERVA
    const mov = await prisma.movimentacaoEstoque.findFirst({
      where: { produto_id: produtoOleoAId, operacao_id: operacaoAId, tipo: 'CANCELAMENTO_RESERVA' }
    });
    expect(mov).toBeDefined();
    expect(mov?.quantidade).toBe(1);
    expect(mov?.presentes_anterior).toBe(2);
    expect(mov?.presentes_posterior).toBe(2);
    expect(mov?.reservados_anterior).toBe(2);
    expect(mov?.reservados_posterior).toBe(1);
    expect(mov?.pronta_entrega_anterior).toBe(0);
    expect(mov?.pronta_entrega_posterior).toBe(1);
    expect(mov?.detalhes).toContain('Cliente desistiu por motivo financeiro');
    expect(mov?.operador_nome).toBe('Dona Sônia');
  });

  it('deve bloquear terminantemente ajuste de contagem física quando o novo valor for menor que reservas ativas (FR-030, AD-3)', async () => {
    // Sabonete tem 2 presentes e 2 reservados para clientes ativas
    const estoqueItemId = gerarUuidV7();
    await prisma.estoqueItem.create({
      data: {
        id: estoqueItemId,
        operacao_id: operacaoAId,
        produto_id: produtoSaboneteAId,
        presentes: 2,
        reservados: 2,
        pronta_entrega: 0
      }
    });

    // Tentativa de reduzir a contagem física para 1 frasco (menor que as 2 reservas ativas)
    const res = await app.inject({
      method: 'POST',
      url: `/api/estoque/${produtoSaboneteAId}/ajuste`,
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nova_contagem_presentes: 1,
        justificativa: 'Achei só 1 caixa no armário'
      }
    });

    expect(res.statusCode).toBe(400);
    const err = res.json();
    expect(err.code).toBe('AJUSTE_ABAIXO_DE_RESERVAS');
    expect(err.detail).toContain(
      'Não é permitido reduzir a contagem física para 1 unidade(s) pois existem 2 unidade(s) reservadas ativas para clientes'
    );

    // O estoque permanece inalterado
    const estoque = await prisma.estoqueItem.findUnique({ where: { id: estoqueItemId } });
    expect(estoque?.presentes).toBe(2);
    expect(estoque?.reservados).toBe(2);
    expect(estoque?.pronta_entrega).toBe(0);
  });

  it('deve realizar ajuste justificado de inventário quando a contagem for compatível com as reservas (FR-030, NFR-003, AD-3)', async () => {
    // Atualiza estoque do Sabonete para 4 presentes, 1 reservado, 3 pronta-entrega
    await prisma.estoqueItem.updateMany({
      where: { produto_id: produtoSaboneteAId, operacao_id: operacaoAId },
      data: { presentes: 4, reservados: 1, pronta_entrega: 3 }
    });

    // Ajusta para 2 presentes com justificativa obrigatória
    const res = await app.inject({
      method: 'POST',
      url: `/api/estoque/${produtoSaboneteAId}/ajuste`,
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nova_contagem_presentes: 2,
        justificativa: '2 caixas de sabonete danificadas por umidade descartadas'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.presentes).toBe(2);
    expect(body.reservados).toBe(1);
    expect(body.pronta_entrega).toBe(1); // 2 - 1 = 1
    expect(body.presentes).toBe(body.reservados + body.pronta_entrega);

    // Movimentação de AJUSTE_BALANCO
    const mov = await prisma.movimentacaoEstoque.findFirst({
      where: { produto_id: produtoSaboneteAId, operacao_id: operacaoAId, tipo: 'AJUSTE_BALANCO' },
      orderBy: { criado_em: 'desc' }
    });
    expect(mov?.quantidade).toBe(2); // diferenca 4 - 2 = 2
    expect(mov?.presentes_anterior).toBe(4);
    expect(mov?.presentes_posterior).toBe(2);
    expect(mov?.detalhes).toBe('2 caixas de sabonete danificadas por umidade descartadas');
    expect(mov?.operador_nome).toBe('Dona Sônia');
  });

  it('deve exigir justificativa obrigatória para o ajuste de inventário (FR-030)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/estoque/${produtoSaboneteAId}/ajuste`,
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nova_contagem_presentes: 3,
        justificativa: '   ' // vazia
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('JUSTIFICATIVA_OBRIGATORIA');
  });

  it('deve assegurar isolamento multi-inquilino impedindo operador B de ajustar produto de A (AD-1)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/estoque/${produtoSaboneteAId}/ajuste`,
      headers: { authorization: `Bearer ${tokenOutroB}` },
      payload: {
        nova_contagem_presentes: 5,
        justificativa: 'Tentativa de inquilino B'
      }
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('PRODUTO_NAO_ENCONTRADO');
  });
});
