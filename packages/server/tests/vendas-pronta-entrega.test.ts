import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Story 4.2: Venda de Pronta-Entrega com Bloqueio de Concorrência e Reserva Imediata (FR-026, FR-027, AD-3, AD-7, NFR-001, NFR-003)', () => {
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
  let clienteBiaAId: string;
  let clienteOutroBId: string;
  let produtoBatomAId: string;
  let produtoPerfumeAId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Limpeza limpa na ordem das FKs
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
      data: { id: operacaoBId, nome: 'Operação B' }
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

    // Marca em A
    marcaAId = gerarUuidV7();
    await prisma.marca.create({
      data: {
        id: marcaAId,
        operacao_id: operacaoAId,
        nome: 'Natura Cosméticos',
        percentual_padrao: 30
      }
    });

    // Clientes em A
    clienteAnaAId = gerarUuidV7();
    await prisma.cliente.create({
      data: {
        id: clienteAnaAId,
        operacao_id: operacaoAId,
        nome: 'Ana Paula Silva',
        telefone: '(11) 98888-1111'
      }
    });

    clienteBiaAId = gerarUuidV7();
    await prisma.cliente.create({
      data: {
        id: clienteBiaAId,
        operacao_id: operacaoAId,
        nome: 'Beatriz Costa',
        telefone: '(11) 98888-2222'
      }
    });

    // Cliente em B
    clienteOutroBId = gerarUuidV7();
    await prisma.cliente.create({
      data: {
        id: clienteOutroBId,
        operacao_id: operacaoBId,
        nome: 'Cliente Inquilino B'
      }
    });

    // Produtos em A
    produtoBatomAId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoBatomAId,
        operacao_id: operacaoAId,
        marca_id: marcaAId,
        nome: 'Batom Matte Vermelho',
        preco_venda_centavos: 3990,
        custo_centavos: 2793,
        proveniencia_custo: 'ESTIMADO_PERCENTUAL'
      }
    });

    produtoPerfumeAId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoPerfumeAId,
        operacao_id: operacaoAId,
        marca_id: marcaAId,
        nome: 'Perfume Essencial Exclusivo',
        preco_venda_centavos: 18990,
        custo_centavos: 13293,
        proveniencia_custo: 'ESTIMADO_PERCENTUAL'
      }
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('deve realizar venda de pronta-entrega com retirada posterior reservando imediatamente sem alterar presentes (FR-026, AD-3)', async () => {
    // Estoque inicial do Batom: 2 presentes, 0 reservados, 2 pronta_entrega
    const estoqueItemId = gerarUuidV7();
    await prisma.estoqueItem.create({
      data: {
        id: estoqueItemId,
        operacao_id: operacaoAId,
        produto_id: produtoBatomAId,
        presentes: 2,
        reservados: 0,
        pronta_entrega: 2
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/vendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAnaAId,
        itens: [
          {
            produto_id: produtoBatomAId,
            quantidade: 2,
            entrega_imediata: false
          }
        ]
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.conta).toBeDefined();
    expect(body.conta.cliente_id).toBe(clienteAnaAId);
    expect(body.conta.valor_total).toBe(7980); // 2 * 3990
    expect(body.conta.total_pago).toBe(0);
    expect(body.conta.status).toBe('ABERTA');
    expect(body.conta.itens).toHaveLength(1);
    expect(body.conta.itens[0].status_entrega).toBe('RESERVADO_PRESENTE');
    expect(body.conta.itens[0].quantidade).toBe(2);

    // Validação estrita da regra de conservação de estoque (AD-3)
    // Presentes deve se manter em 2!
    // Reservados deve passar para 2!
    // Pronta-entrega deve passar para 0!
    const estoqueAtualizado = await prisma.estoqueItem.findUnique({
      where: { id: estoqueItemId }
    });
    expect(estoqueAtualizado?.presentes).toBe(2);
    expect(estoqueAtualizado?.reservados).toBe(2);
    expect(estoqueAtualizado?.pronta_entrega).toBe(0);
    expect(estoqueAtualizado?.presentes).toBe(
      (estoqueAtualizado?.reservados ?? 0) + (estoqueAtualizado?.pronta_entrega ?? 0)
    );

    // Auditoria de movimentação de estoque
    const mov = await prisma.movimentacaoEstoque.findFirst({
      where: { produto_id: produtoBatomAId, operacao_id: operacaoAId },
      orderBy: { criado_em: 'desc' }
    });
    expect(mov).toBeDefined();
    expect(mov?.tipo).toBe('RESERVA');
    expect(mov?.quantidade).toBe(2);
    expect(mov?.presentes_anterior).toBe(2);
    expect(mov?.presentes_posterior).toBe(2);
    expect(mov?.reservados_anterior).toBe(0);
    expect(mov?.reservados_posterior).toBe(2);
    expect(mov?.pronta_entrega_anterior).toBe(2);
    expect(mov?.pronta_entrega_posterior).toBe(0);
    expect(mov?.operador_nome).toBe('Dona Sônia');
  });

  it('deve realizar venda com entrega imediata baixando simultaneamente presentes e pronta-entrega (FR-027, AD-3)', async () => {
    // Estoque inicial do Perfume: 3 presentes, 0 reservados, 3 pronta_entrega
    const estoqueItemId = gerarUuidV7();
    await prisma.estoqueItem.create({
      data: {
        id: estoqueItemId,
        operacao_id: operacaoAId,
        produto_id: produtoPerfumeAId,
        presentes: 3,
        reservados: 0,
        pronta_entrega: 3
      }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/vendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteBiaAId,
        itens: [
          {
            produto_id: produtoPerfumeAId,
            quantidade: 1,
            entrega_imediata: true
          }
        ]
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.conta.itens[0].status_entrega).toBe('ENTREGUE');

    // Validação de estoque físico no armário e na estante
    const estoqueAtualizado = await prisma.estoqueItem.findUnique({
      where: { id: estoqueItemId }
    });
    expect(estoqueAtualizado?.presentes).toBe(2);
    expect(estoqueAtualizado?.reservados).toBe(0);
    expect(estoqueAtualizado?.pronta_entrega).toBe(2);
    expect(estoqueAtualizado?.presentes).toBe(
      (estoqueAtualizado?.reservados ?? 0) + (estoqueAtualizado?.pronta_entrega ?? 0)
    );

    // Movimentação de SAIDA_VENDA
    const mov = await prisma.movimentacaoEstoque.findFirst({
      where: { produto_id: produtoPerfumeAId, operacao_id: operacaoAId },
      orderBy: { criado_em: 'desc' }
    });
    expect(mov?.tipo).toBe('SAIDA_VENDA');
    expect(mov?.presentes_anterior).toBe(3);
    expect(mov?.presentes_posterior).toBe(2);
    expect(mov?.pronta_entrega_anterior).toBe(3);
    expect(mov?.pronta_entrega_posterior).toBe(2);
  });

  it('deve recusar venda atomicamente com erro amigável se a pronta-entrega for insuficiente sem criar contas órfãs (FR-026, NFR-001)', async () => {
    const contasAntes = await prisma.conta.count({ where: { operacao_id: operacaoAId } });

    // Perfume tem 2 na pronta entrega; tentativa de vender 5
    const res = await app.inject({
      method: 'POST',
      url: '/api/vendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAnaAId,
        itens: [
          {
            produto_id: produtoPerfumeAId,
            quantidade: 5,
            entrega_imediata: false
          }
        ]
      }
    });

    expect(res.statusCode).toBe(400);
    const err = res.json();
    expect(err.code).toBe('ESTOQUE_INSUFICIENTE_PRONTA_ENTREGA');
    expect(err.detail).toContain('Você tem apenas 2 unidade(s) na pronta-entrega que acabou de ser reservada.');

    // Nenhuma conta órfã gerada
    const contasDepois = await prisma.conta.count({ where: { operacao_id: operacaoAId } });
    expect(contasDepois).toBe(contasAntes);
  });

  it('deve bloquear atomicamente concorrência quando duas requisições disputam a última unidade disponível (FR-026, AD-7, NFR-001)', async () => {
    // Cria produto exclusivo com 1 única unidade
    const produtoRaroId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoRaroId,
        operacao_id: operacaoAId,
        nome: 'Edição Limitada Rara',
        preco_venda_centavos: 9900
      }
    });

    await prisma.estoqueItem.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: operacaoAId,
        produto_id: produtoRaroId,
        presentes: 1,
        reservados: 0,
        pronta_entrega: 1
      }
    });

    // Dispara 2 requisições concorrentes disputando a mesma última unidade
    const [res1, res2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/vendas',
        headers: { authorization: `Bearer ${tokenSoniaA}` },
        payload: {
          cliente_id: clienteAnaAId,
          itens: [{ produto_id: produtoRaroId, quantidade: 1, entrega_imediata: false }]
        }
      }),
      app.inject({
        method: 'POST',
        url: '/api/vendas',
        headers: { authorization: `Bearer ${tokenSoniaA}` },
        payload: {
          cliente_id: clienteBiaAId,
          itens: [{ produto_id: produtoRaroId, quantidade: 1, entrega_imediata: false }]
        }
      })
    ]);

    const statusList = [res1.statusCode, res2.statusCode];
    // Exatamente uma teve sucesso (201) e exatamente uma falhou com 400
    expect(statusList).toContain(201);
    expect(statusList).toContain(400);

    const erroRes = res1.statusCode === 400 ? res1 : res2;
    expect(erroRes.json().code).toBe('ESTOQUE_INSUFICIENTE_PRONTA_ENTREGA');

    // Verifica que o estoque ficou conservado em 1 presente, 1 reservado, 0 pronta entrega
    const estoqueFinal = await prisma.estoqueItem.findFirst({
      where: { produto_id: produtoRaroId, operacao_id: operacaoAId }
    });
    expect(estoqueFinal?.presentes).toBe(1);
    expect(estoqueFinal?.reservados).toBe(1);
    expect(estoqueFinal?.pronta_entrega).toBe(0);
  });

  it('deve assegurar idempotência com UUID v4 evitando repetição de reservas e contas (AD-7, NFR-008)', async () => {
    const idempotencyKey = 'c3d52671-8bc4-4f47-8a39-ff74619d7001';

    // Cria produto exclusivo para o teste de idempotência com 5 unidades
    const produtoIdemId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoIdemId,
        operacao_id: operacaoAId,
        nome: 'Creme Hidratante Idem',
        preco_venda_centavos: 4500
      }
    });

    const estoqueIdemId = gerarUuidV7();
    await prisma.estoqueItem.create({
      data: {
        id: estoqueIdemId,
        operacao_id: operacaoAId,
        produto_id: produtoIdemId,
        presentes: 5,
        reservados: 0,
        pronta_entrega: 5
      }
    });

    // Primeiro envio
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/vendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAnaAId,
        idempotency_key: idempotencyKey,
        itens: [{ produto_id: produtoIdemId, quantidade: 2, entrega_imediata: false }]
      }
    });
    expect(res1.statusCode).toBe(201);
    const contaId = res1.json().conta.id;

    // Segundo envio com exatamente a mesma chave (ex: retry de rede)
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/vendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAnaAId,
        idempotency_key: idempotencyKey,
        itens: [{ produto_id: produtoIdemId, quantidade: 2, entrega_imediata: false }]
      }
    });
    expect(res2.statusCode).toBe(201);
    expect(res2.json().conta.id).toBe(contaId);

    // O estoque deve ter sido debitado apenas uma única vez (5 - 2 = 3 pronta_entrega, 2 reservados)
    const estoque = await prisma.estoqueItem.findUnique({ where: { id: estoqueIdemId } });
    expect(estoque?.pronta_entrega).toBe(3);
    expect(estoque?.reservados).toBe(2);
    expect(estoque?.presentes).toBe(5);
  });

  it('deve assegurar isolamento multi-inquilino impedindo venda de produto de outra operação (AD-1)', async () => {
    // Operador B tentando vender o produto de A para cliente de B
    const res = await app.inject({
      method: 'POST',
      url: '/api/vendas',
      headers: { authorization: `Bearer ${tokenOutroB}` },
      payload: {
        cliente_id: clienteOutroBId,
        itens: [{ produto_id: produtoBatomAId, quantidade: 1, entrega_imediata: false }]
      }
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('PRODUTO_NAO_ENCONTRADO');
  });

  it('deve listar as vendas/contas da operação via GET /api/vendas', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/vendas',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(res.statusCode).toBe(200);
    const contas = res.json();
    expect(Array.isArray(contas)).toBe(true);
    expect(contas.length).toBeGreaterThan(0);
    expect(contas[0].operacao_id).toBe(operacaoAId);
  });
});
