import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Story 2.1: Encomendas API - Registro Individual, Criação de Conta e Invariante de Estoque', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });

  const operacaoAId = gerarUuidV7();
  const operacaoBId = gerarUuidV7();
  const operadorSoniaId = gerarUuidV7();
  const operadorOutroBId = gerarUuidV7();

  let tokenSoniaA: string;
  let tokenOutroB: string;

  let clienteAId: string;
  let clienteBId: string;
  let produtoAComMarcaId: string;
  let produtoASemCustoId: string;
  let produtoBId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Limpeza de tabelas
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

    // 1. Operação A (Dona Sônia)
    await prisma.operacao.create({
      data: { id: operacaoAId, nome: 'Consultoria Beleza Viva (Dona Sônia)' }
    });
    await prisma.operador.create({
      data: { id: operadorSoniaId, operacao_id: operacaoAId, nome: 'Dona Sônia', ativo: true }
    });

    // 2. Operação B
    await prisma.operacao.create({
      data: { id: operacaoBId, nome: 'Operação B Outra' }
    });
    await prisma.operador.create({
      data: { id: operadorOutroBId, operacao_id: operacaoBId, nome: 'Outro Operador', ativo: true }
    });

    // Tokens
    const loginA = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { operacao_id: operacaoAId, operador_id: operadorSoniaId }
    });
    tokenSoniaA = loginA.json().token;

    const loginB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { operacao_id: operacaoBId, operador_id: operadorOutroBId }
    });
    tokenOutroB = loginB.json().token;

    // Clientes
    const resCliA = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: { nome: 'Maria Clara Silva', telefone: '11987654321' }
    });
    clienteAId = resCliA.json().id;

    const resCliB = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenOutroB}` },
      payload: { nome: 'Bia Santos' }
    });
    clienteBId = resCliB.json().id;

    // Marca Natura com 30% de desconto
    const resMarca = await app.inject({
      method: 'POST',
      url: '/api/marcas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: { nome: 'Natura', percentual_padrao: 30 }
    });
    const marcaId = resMarca.json().id;

    // Produto A1 com marca: Preço R$ 50,00 (5000), custo 30% off -> R$ 35,00 (3500)
    const resProdA1 = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Hidratante Tododia Algodão 400ml',
        marca_id: marcaId,
        preco_venda_centavos: 5000
      }
    });
    produtoAComMarcaId = resProdA1.json().id;

    // Lança estoque inicial de 5 unidades no Produto A1
    await app.inject({
      method: 'POST',
      url: '/api/estoque/inicial',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        produto_id: produtoAComMarcaId,
        quantidade: 5
      }
    });

    // Produto A2 sem marca e sem custo manual
    const resProdA2 = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Sabonete Artesanal Avulso',
        preco_venda_centavos: 2500
      }
    });
    produtoASemCustoId = resProdA2.json().id;

    // Produto da Operação B
    const resProdB = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenOutroB}` },
      payload: {
        nome: 'Batom Matte B',
        preco_venda_centavos: 3000
      }
    });
    produtoBId = resProdB.json().id;
  });

  afterAll(async () => {
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
    await prisma.$disconnect();
    await app.close();
  });

  it('deve registrar encomenda válida, criar conta atômica, congelar preço/custo e manter estoque físico intacto (FR-015, FR-016, AD-2, AD-3, FR-019)', async () => {
    // Verifica estoque antes: presentes=5, reservados=0, pronta_entrega=5
    const resEstoqueAntes = await app.inject({
      method: 'GET',
      url: `/api/estoque/${produtoAComMarcaId}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resEstoqueAntes.statusCode).toBe(200);
    expect(resEstoqueAntes.json().presentes).toBe(5);
    expect(resEstoqueAntes.json().reservados).toBe(0);
    expect(resEstoqueAntes.json().pronta_entrega).toBe(5);

    // Registra encomenda de 2 unidades de R$ 50,00 (total R$ 100,00 = 10000 centavos)
    const resEncomenda = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAId,
        descricao: 'Encomenda para o Dia das Mães',
        itens: [
          {
            produto_id: produtoAComMarcaId,
            quantidade: 2
          }
        ]
      }
    });

    expect(resEncomenda.statusCode).toBe(201);
    const enc = resEncomenda.json();

    // 1. Encomenda
    expect(enc.id).toBeDefined();
    expect(enc.cliente_id).toBe(clienteAId);
    expect(enc.cliente_nome).toBe('Maria Clara Silva');
    expect(enc.status).toBe('AGUARDANDO_FABRICA');
    expect(enc.quantidade_total_itens).toBe(2);
    expect(enc.valor_total_centavos).toBe(10000);
    expect(enc.descricao).toBe('Encomenda para o Dia das Mães');

    // 2. Conta individual vinculada
    expect(enc.conta).toBeDefined();
    expect(enc.conta.valor_total).toBe(10000);
    expect(enc.conta.total_pago).toBe(0);
    expect(enc.conta.status).toBe('ABERTA');
    expect(enc.conta.saldo_total_devido_centavos).toBe(10000);

    // 3. Projeção "Visão Sem Itens Aguardados" (AD-4): Saldo cobrável hoje = R$ 0,00!
    expect(enc.conta.saldo_cobravel_hoje_centavos).toBe(0);
    expect(enc.conta.total_sem_aguardados_centavos).toBe(0);

    // 4. Congelamento de preço e custo nos itens (AD-2, FR-019)
    expect(enc.itens).toHaveLength(1);
    const item = enc.itens[0];
    expect(item.produto_id).toBe(produtoAComMarcaId);
    expect(item.quantidade).toBe(2);
    expect(item.preco_unitario_centavos).toBe(5000);
    expect(item.custo_unitario_centavos).toBe(3500); // 30% de 5000
    expect(item.origem_custo).toBe('ESTIMADO_PERCENTUAL');
    expect(item.status_entrega).toBe('AGUARDANDO_FABRICA');

    // 5. Invariante de estoque físico estritamente inalterado (AD-3)
    const resEstoqueDepois = await app.inject({
      method: 'GET',
      url: `/api/estoque/${produtoAComMarcaId}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resEstoqueDepois.statusCode).toBe(200);
    expect(resEstoqueDepois.json().presentes).toBe(5);
    expect(resEstoqueDepois.json().reservados).toBe(0);
    expect(resEstoqueDepois.json().pronta_entrega).toBe(5);

    // Nenhuma movimentação de estoque adicionada
    const resExtrato = await app.inject({
      method: 'GET',
      url: `/api/estoque/${produtoAComMarcaId}/extrato`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resExtrato.json()).toHaveLength(1); // Somente o ESTOQUE_INICIAL
    expect(resExtrato.json()[0].tipo).toBe('ESTOQUE_INICIAL');

    // 6. Auditoria nominal registrada (NFR-003)
    const audit = await prisma.registroAuditoria.findFirst({
      where: {
        operacao_id: operacaoAId,
        acao: 'REGISTRAR_ENCOMENDA'
      }
    });
    expect(audit).toBeDefined();
    expect(audit?.operador_id).toBe(operadorSoniaId);
    expect(audit?.operador_nome).toBe('Dona Sônia');
    expect(audit?.detalhes).toContain('Maria Clara Silva');
  });

  it('deve preservar custo NULL e origem DESCONHECIDO para produto sem custo cadastrado (AD-2)', async () => {
    const resEncomenda = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAId,
        itens: [
          {
            produto_id: produtoASemCustoId,
            quantidade: 1
          }
        ]
      }
    });

    expect(resEncomenda.statusCode).toBe(201);
    const item = resEncomenda.json().itens[0];
    expect(item.preco_unitario_centavos).toBe(2500);
    expect(item.custo_unitario_centavos).toBeNull();
    expect(item.origem_custo).toBe('DESCONHECIDO');
    expect(item.status_entrega).toBe('AGUARDANDO_FABRICA');
  });

  it('deve rejeitar tentativa de encomenda com quantidade zero ou negativa retornando 400 QUANTIDADE_INVALIDA (FR-015)', async () => {
    const resZero = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAId,
        itens: [
          {
            produto_id: produtoAComMarcaId,
            quantidade: 0
          }
        ]
      }
    });

    expect(resZero.statusCode).toBe(400);
    expect(resZero.headers['content-type']).toContain('application/problem+json');
    expect(resZero.json().code).toBe('QUANTIDADE_INVALIDA');

    const resNegativo = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAId,
        itens: [
          {
            produto_id: produtoAComMarcaId,
            quantidade: -3
          }
        ]
      }
    });

    expect(resNegativo.statusCode).toBe(400);
    expect(resNegativo.json().code).toBe('QUANTIDADE_INVALIDA');
  });

  it('deve rejeitar encomenda sem itens retornando 400 ITENS_OBRIGATORIOS', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAId,
        itens: []
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ITENS_OBRIGATORIOS');
  });

  it('isolamento multi-inquilino: Operação B não pode encomendar para cliente da Operação A (404 CLIENTE_NAO_ENCONTRADA)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenOutroB}` },
      payload: {
        cliente_id: clienteAId, // Cliente da Operação A
        itens: [
          {
            produto_id: produtoBId,
            quantidade: 1
          }
        ]
      }
    });

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json().code).toBe('CLIENTE_NAO_ENCONTRADA');
  });

  it('isolamento multi-inquilino: Operação A não pode encomendar produto pertencente à Operação B (404 PRODUTO_NAO_ENCONTRADO)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAId,
        itens: [
          {
            produto_id: produtoBId, // Produto da Operação B
            quantidade: 1
          }
        ]
      }
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('PRODUTO_NAO_ENCONTRADO');
  });

  it('GET /api/encomendas lista apenas encomendas da operação autenticada', async () => {
    // Cria uma encomenda na Operação B
    await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenOutroB}` },
      payload: {
        cliente_id: clienteBId,
        itens: [
          {
            produto_id: produtoBId,
            quantidade: 1
          }
        ]
      }
    });

    // Consulta Operação A
    const resA = await app.inject({
      method: 'GET',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resA.statusCode).toBe(200);
    const listaA = resA.json();
    expect(listaA.length).toBeGreaterThanOrEqual(2);
    expect(listaA.every((e: any) => e.operacao_id === operacaoAId)).toBe(true);

    // Consulta Operação B
    const resB = await app.inject({
      method: 'GET',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resB.statusCode).toBe(200);
    const listaB = resB.json();
    expect(listaB).toHaveLength(1);
    expect(listaB[0].operacao_id).toBe(operacaoBId);
    expect(listaB[0].cliente_id).toBe(clienteBId);
  });

  it('GET /api/encomendas/:id retorna detalhes da encomenda e bloqueia acesso cruzado', async () => {
    const listagem = await app.inject({
      method: 'GET',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    const encomendaA = listagem.json()[0];

    // Consulta por A (sucesso)
    const resGetA = await app.inject({
      method: 'GET',
      url: `/api/encomendas/${encomendaA.id}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resGetA.statusCode).toBe(200);
    const bodyA = resGetA.json();
    expect(bodyA.id).toBe(encomendaA.id);
    expect(bodyA.cliente_nome).toBe('Maria Clara Silva');
    expect(bodyA.quantidade_total_itens).toBeGreaterThan(0);
    expect(bodyA.valor_total_centavos).toBeGreaterThan(0);
    expect(bodyA.conta).not.toBeNull();
    expect(bodyA.conta.saldo_cobravel_hoje_centavos).toBe(0);
    expect(bodyA.itens.length).toBeGreaterThan(0);
    expect(bodyA.itens[0].preco_unitario_formatado).toBeDefined();
    expect(bodyA.itens[0].subtotal_centavos).toBeDefined();
    expect(bodyA.itens[0].subtotal_formatado).toBeDefined();

    // Tentativa de acesso por Operação B (bloqueado)
    const resGetCruzado = await app.inject({
      method: 'GET',
      url: `/api/encomendas/${encomendaA.id}`,
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resGetCruzado.statusCode).toBe(404);
    expect(resGetCruzado.json().code).toBe('ENCOMENDA_NAO_ENCONTRADA');
  });

  it('consulta da ficha da cliente após encomenda exibe a encomenda e a conta associada com saldo cobrável hoje R$ 0,00', async () => {
    const resFicha = await app.inject({
      method: 'GET',
      url: `/api/clientes/${clienteAId}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(resFicha.statusCode).toBe(200);
    const ficha = resFicha.json();

    expect(ficha.encomendas.length).toBeGreaterThanOrEqual(1);
    expect(ficha.encomendas[0].status).toBe('AGUARDANDO_FABRICA');
    expect(ficha.encomendas[0].itens.length).toBeGreaterThanOrEqual(1);
    const itemFicha = ficha.encomendas[0].itens[0];
    expect(itemFicha.produto_nome).toBeDefined();
    expect(itemFicha.quantidade).toBeGreaterThan(0);
    expect(itemFicha.preco_unitario_centavos).toBeGreaterThan(0);
    expect(itemFicha.status_entrega).toBe('AGUARDANDO_FABRICA');

    expect(ficha.contas.length).toBeGreaterThanOrEqual(1);
    const conta = ficha.contas[0];
    expect(conta.valor_total).toBeGreaterThan(0);
    expect(conta.saldo_cobravel_hoje).toBe(0); // Projeção "Visão Sem Itens Aguardados"
  });

  it('deve rejeitar payload com itens malformados ou nulos retornando 400', async () => {
    const resNullItem = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAId,
        itens: [null]
      }
    });
    expect(resNullItem.statusCode).toBe(400);

    const resNonObject = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAId,
        itens: ['invalido']
      }
    });
    expect(resNonObject.statusCode).toBe(400);
  });

  it('deve impedir exclusão de produto vinculado a itens de conta retornando 409 CONFLICT', async () => {
    const resDel = await app.inject({
      method: 'DELETE',
      url: `/api/produtos/${produtoAComMarcaId}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resDel.statusCode).toBe(409);
    expect(resDel.json().code).toBe('CONFLICT');
  });
});
