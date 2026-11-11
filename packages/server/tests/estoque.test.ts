import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Story 1.4: Lançamento de Estoque Inicial por Produto', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });

  const operacaoAId = gerarUuidV7();
  const operacaoBId = gerarUuidV7();
  const operadorSoniaId = gerarUuidV7();
  const operadorBId = gerarUuidV7();

  let tokenSoniaA: string;
  let tokenOutroB: string;

  let produtoSoniaId: string;
  let produtoOutroBId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Limpeza de tabelas na ordem de dependência
    await prisma.itemConta.deleteMany();
    await prisma.encomenda.deleteMany();
    await prisma.conta.deleteMany();
    await prisma.movimentacaoEstoque.deleteMany();
    await prisma.estoqueItem.deleteMany();
    await prisma.produto.deleteMany();
    await prisma.marca.deleteMany();
    await prisma.registroAuditoria.deleteMany();
    await prisma.operador.deleteMany();
    await prisma.operacao.deleteMany();

    // 1. Cria Operação A (Dona Sônia) e Operador
    await prisma.operacao.create({
      data: { id: operacaoAId, nome: 'Consultoria Beleza Viva (Dona Sônia)' }
    });
    await prisma.operador.create({
      data: { id: operadorSoniaId, operacao_id: operacaoAId, nome: 'Dona Sônia', ativo: true }
    });

    // 2. Cria Operação B e Operador
    await prisma.operacao.create({
      data: { id: operacaoBId, nome: 'Consultoria Outra Revendedora' }
    });
    await prisma.operador.create({
      data: { id: operadorBId, operacao_id: operacaoBId, nome: 'Operadora B', ativo: true }
    });

    // 3. Obtém tokens de sessão
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

    // 4. Cadastra produto na Operação A
    const resProdA = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { Authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Desodorante Hidratante Algodão',
        preco_venda_centavos: 6590
      }
    });
    produtoSoniaId = resProdA.json().id;

    // 5. Cadastra produto na Operação B
    const resProdB = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { Authorization: `Bearer ${tokenOutroB}` },
      payload: {
        nome: 'Perfume Essencial Exclusivo',
        preco_venda_centavos: 21900
      }
    });
    produtoOutroBId = resProdB.json().id;
  });

  afterAll(async () => {
    await prisma.itemConta.deleteMany();
    await prisma.encomenda.deleteMany();
    await prisma.conta.deleteMany();
    await prisma.movimentacaoEstoque.deleteMany();
    await prisma.estoqueItem.deleteMany();
    await prisma.produto.deleteMany();
    await prisma.marca.deleteMany();
    await prisma.registroAuditoria.deleteMany();
    await prisma.operador.deleteMany();
    await prisma.operacao.deleteMany();
    await prisma.$disconnect();
  });

  it('deve realizar lançamento de estoque inicial válido (5 unidades) respeitando a invariante Presentes = Reservados + ProntaEntrega (FR-013, AD-3)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/estoque/inicial',
      headers: { Authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        produto_id: produtoSoniaId,
        quantidade: 5,
        observacao: 'Contagem inicial da estante da sala'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.produto_id).toBe(produtoSoniaId);
    expect(body.presentes).toBe(5);
    expect(body.pronta_entrega).toBe(5);
    expect(body.reservados).toBe(0);
    // Invariante AD-3: Presentes = Reservados + ProntaEntrega
    expect(body.presentes).toBe(body.reservados + body.pronta_entrega);

    // Movimentação vinculada
    expect(body.movimentacao).toBeDefined();
    expect(body.movimentacao.tipo).toBe('ESTOQUE_INICIAL');
    expect(body.movimentacao.quantidade).toBe(5);
    expect(body.movimentacao.presentes_anterior).toBe(0);
    expect(body.movimentacao.presentes_posterior).toBe(5);
    expect(body.movimentacao.pronta_entrega_anterior).toBe(0);
    expect(body.movimentacao.pronta_entrega_posterior).toBe(5);
    expect(body.movimentacao.reservados_anterior).toBe(0);
    expect(body.movimentacao.reservados_posterior).toBe(0);
    expect(body.movimentacao.compra_id).toBeNull(); // Sem vínculo com compras à fábrica (FR-013)
    expect(body.movimentacao.operador_id).toBe(operadorSoniaId);
    expect(body.movimentacao.operador_nome).toBe('Dona Sônia');
    expect(body.movimentacao.criado_em).toBeDefined();

    // Verifica persistência no banco
    const itemDb = await prisma.estoqueItem.findUnique({
      where: {
        operacao_id_produto_id: {
          operacao_id: operacaoAId,
          produto_id: produtoSoniaId
        }
      }
    });
    expect(itemDb).not.toBeNull();
    expect(itemDb!.presentes).toBe(5);
    expect(itemDb!.pronta_entrega).toBe(5);
    expect(itemDb!.reservados).toBe(0);

    // Verifica auditoria nominal (NFR-003)
    const audit = await prisma.registroAuditoria.findFirst({
      where: {
        operacao_id: operacaoAId,
        acao: 'LANCAR_ESTOQUE_INICIAL'
      }
    });
    expect(audit).not.toBeNull();
    expect(audit!.operador_id).toBe(operadorSoniaId);
    expect(audit!.operador_nome).toBe('Dona Sônia');
  });

  it('deve listar movimentação ESTOQUE_INICIAL no extrato do produto sem vínculo de compra (FR-013, NFR-003)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/estoque/${produtoSoniaId}`,
      headers: { Authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.produto_id).toBe(produtoSoniaId);
    expect(body.presentes).toBe(5);
    expect(body.pronta_entrega).toBe(5);
    expect(body.reservados).toBe(0);
    expect(body.movimentacoes).toHaveLength(1);

    const mov = body.movimentacoes[0];
    expect(mov.tipo).toBe('ESTOQUE_INICIAL');
    expect(mov.quantidade).toBe(5);
    expect(mov.compra_id).toBeNull(); // Sem vínculo a compras
    expect(mov.operador_nome).toBe('Dona Sônia');
    expect(mov.operador_id).toBe(operadorSoniaId);
    expect(new Date(mov.criado_em).toISOString()).toBe(mov.criado_em);

    // Consulta extrato via endpoint dedicado /extrato
    const resExtrato = await app.inject({
      method: 'GET',
      url: `/api/estoque/${produtoSoniaId}/extrato`,
      headers: { Authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resExtrato.statusCode).toBe(200);
    const extratoList = resExtrato.json();
    expect(extratoList).toHaveLength(1);
    expect(extratoList[0].tipo).toBe('ESTOQUE_INICIAL');
    expect(extratoList[0].compra_id).toBeNull();
  });

  it('deve rejeitar tentativa de lançar quantidade negativa (-2) retornando 400 RFC 7807 (NFR-001)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/estoque/inicial',
      headers: { Authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        produto_id: produtoSoniaId,
        quantidade: -2
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = res.json();
    expect(problem.status).toBe(400);
    expect(problem.title).toBeDefined();
    expect(problem.detail).toMatch(/inteiro não negativo/i);
  });

  it('deve rejeitar tentativa de lançar quantidade decimal (1.5) retornando 400 RFC 7807 (NFR-001)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/estoque/inicial',
      headers: { Authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        produto_id: produtoSoniaId,
        quantidade: 1.5
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = res.json();
    expect(problem.status).toBe(400);
    expect(problem.title).toBeDefined();
    expect(problem.detail).toMatch(/inteiro não negativo/i);
  });

  it('deve permitir atualizar contagem inicial para 8 unidades registrando histórico correto', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/estoque/inicial',
      headers: { Authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        produto_id: produtoSoniaId,
        quantidade: 8,
        observacao: 'Achei mais 3 frascos na gaveta'
      }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.presentes).toBe(8);
    expect(body.pronta_entrega).toBe(8);
    expect(body.reservados).toBe(0);

    expect(body.movimentacao.presentes_anterior).toBe(5);
    expect(body.movimentacao.presentes_posterior).toBe(8);
    expect(body.movimentacao.pronta_entrega_anterior).toBe(5);
    expect(body.movimentacao.pronta_entrega_posterior).toBe(8);

    // Consulta extrato: deve ter agora 2 movimentações
    const resConsulta = await app.inject({
      method: 'GET',
      url: `/api/estoque/${produtoSoniaId}`,
      headers: { Authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resConsulta.json().movimentacoes).toHaveLength(2);
  });

  it('isolamento multi-inquilino: Operação B não pode lançar estoque em produto da Operação A (404 RFC 7807)', async () => {
    // Operação B tenta lançar estoque no produto da Dona Sônia (Operação A)
    const res = await app.inject({
      method: 'POST',
      url: '/api/estoque/inicial',
      headers: { Authorization: `Bearer ${tokenOutroB}` },
      payload: {
        produto_id: produtoSoniaId,
        quantidade: 10
      }
    });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = res.json();
    expect(problem.status).toBe(404);
    expect(problem.code).toBe('NOT_FOUND');
  });

  it('isolamento multi-inquilino: Operação B não pode consultar estoque de produto da Operação A (404 RFC 7807)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/estoque/${produtoSoniaId}`,
      headers: { Authorization: `Bearer ${tokenOutroB}` }
    });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('isolamento multi-inquilino: Operação B não pode consultar extrato de produto da Operação A (404 RFC 7807)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/estoque/${produtoSoniaId}/extrato`,
      headers: { Authorization: `Bearer ${tokenOutroB}` }
    });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('deve rejeitar POST /api/estoque/inicial sem autenticação retornando 401 RFC 7807', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/estoque/inicial',
      payload: {
        produto_id: produtoSoniaId,
        quantidade: 5
      }
    });

    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('deve rejeitar lançamento de estoque inicial quando o produto já possui reservas ativas (reservados > 0)', async () => {
    // Simula uma reserva ativa no estoque do produto
    await prisma.estoqueItem.update({
      where: {
        operacao_id_produto_id: {
          operacao_id: operacaoAId,
          produto_id: produtoSoniaId
        }
      },
      data: {
        presentes: 8,
        reservados: 3,
        pronta_entrega: 5
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/estoque/inicial',
      headers: { Authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        produto_id: produtoSoniaId,
        quantidade: 10
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const problem = res.json();
    expect(problem.status).toBe(400);
    expect(problem.detail).toMatch(/reservas ativas/i);

    // Restaura o estoque para testes subsequentes
    await prisma.estoqueItem.update({
      where: {
        operacao_id_produto_id: {
          operacao_id: operacaoAId,
          produto_id: produtoSoniaId
        }
      },
      data: {
        presentes: 8,
        reservados: 0,
        pronta_entrega: 8
      }
    });
  });

  it('GET /api/estoque deve listar apenas os itens da operação autenticada', async () => {
    // Lança estoque para o produto da Operação B
    await app.inject({
      method: 'POST',
      url: '/api/estoque/inicial',
      headers: { Authorization: `Bearer ${tokenOutroB}` },
      payload: {
        produto_id: produtoOutroBId,
        quantidade: 3
      }
    });

    // Operação A lista estoque: só vê produto da Dona Sônia
    const resA = await app.inject({
      method: 'GET',
      url: '/api/estoque',
      headers: { Authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resA.statusCode).toBe(200);
    const listaA = resA.json();
    expect(listaA).toHaveLength(1);
    expect(listaA[0].produto_id).toBe(produtoSoniaId);
    expect(listaA[0].presentes).toBe(8);
    expect(listaA[0].pronta_entrega).toBe(8);
    expect(listaA[0].reservados).toBe(0);

    // Operação B lista estoque: só vê produto da Operação B
    const resB = await app.inject({
      method: 'GET',
      url: '/api/estoque',
      headers: { Authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resB.statusCode).toBe(200);
    const listaB = resB.json();
    expect(listaB).toHaveLength(1);
    expect(listaB[0].produto_id).toBe(produtoOutroBId);
    expect(listaB[0].presentes).toBe(3);
    expect(listaB[0].pronta_entrega).toBe(3);
    expect(listaB[0].reservados).toBe(0);
  });
});
