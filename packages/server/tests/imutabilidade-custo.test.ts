import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Story 2.3: Imutabilidade e Congelamento de Preço de Venda e Custo Histórico (FR-019, AD-2, FR-010)', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });

  const operacaoId = gerarUuidV7();
  const operadorId = gerarUuidV7();
  let tokenSonia: string;

  let marcaNaturaId: string;
  let clienteAnaId: string;
  let produtoHidratanteId: string;
  let produtoSemCustoId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Limpeza de tabelas
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

    // Operação e Operador
    await prisma.operacao.create({
      data: { id: operacaoId, nome: 'Consultoria Dona Sônia' }
    });
    await prisma.operador.create({
      data: { id: operadorId, operacao_id: operacaoId, nome: 'Dona Sônia', ativo: true }
    });

    // Login
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { operacao_id: operacaoId, operador_id: operadorId }
    });
    tokenSonia = login.json().token;

    // Marca Natura com 30% de desconto padrão
    marcaNaturaId = gerarUuidV7();
    await prisma.marca.create({
      data: {
        id: marcaNaturaId,
        operacao_id: operacaoId,
        nome: 'Natura',
        percentual_padrao: 30
      }
    });

    // Cliente Ana
    clienteAnaId = gerarUuidV7();
    await prisma.cliente.create({
      data: {
        id: clienteAnaId,
        operacao_id: operacaoId,
        nome: 'Ana Silva',
        telefone: '11999998888'
      }
    });

    // Produto Hidratante: R$ 100,00 (10000 centavos), Custo R$ 70,00 (7000 centavos)
    produtoHidratanteId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoHidratanteId,
        operacao_id: operacaoId,
        marca_id: marcaNaturaId,
        nome: 'Hidratante Tododia Noz Pecã',
        variante: '400ml',
        preco_venda_centavos: 10000,
        custo_centavos: 7000,
        proveniencia_custo: 'ESTIMADO_PERCENTUAL'
      }
    });

    // Produto Sem Custo: R$ 50,00 (5000 centavos), Custo NULL
    produtoSemCustoId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoSemCustoId,
        operacao_id: operacaoId,
        marca_id: null,
        nome: 'Sabonete Artesanal Avulso',
        preco_venda_centavos: 5000,
        custo_centavos: null,
        proveniencia_custo: 'DESCONHECIDO'
      }
    });
  });

  afterAll(async () => {
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
    await prisma.$disconnect();
    await app.close();
  });

  it('deve congelar preco_unitario e custo_unitario na criacao da encomenda/conta e resistir a alteracoes posteriores no catalogo (FR-019, AD-2)', async () => {
    // 1. Cria encomenda no momento T0 (preço = R$ 100,00, custo = R$ 70,00)
    const resEnc1 = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { Authorization: `Bearer ${tokenSonia}` },
      payload: {
        cliente_id: clienteAnaId,
        descricao: 'Encomenda T0 antes do reajuste de catálogo',
        itens: [
          {
            produto_id: produtoHidratanteId,
            quantidade: 2 // 2 x R$ 100,00 = R$ 200,00
          }
        ]
      }
    });

    expect(resEnc1.statusCode).toBe(201);
    const enc1 = resEnc1.json();
    expect(enc1.valor_total_centavos).toBe(20000);
    expect(enc1.itens[0].preco_unitario_centavos).toBe(10000);
    expect(enc1.itens[0].custo_unitario_centavos).toBe(7000);
    expect(enc1.itens[0].origem_custo).toBe('ESTIMADO_PERCENTUAL');

    // 2. Momento T1: O preço de catálogo do produto sobe para R$ 130,00 e o custo sobe para R$ 90,00
    const resPutProd = await app.inject({
      method: 'PUT',
      url: `/api/produtos/${produtoHidratanteId}`,
      headers: { Authorization: `Bearer ${tokenSonia}` },
      payload: {
        preco_venda_centavos: 13000,
        custo_manual_centavos: 9000
      }
    });
    expect(resPutProd.statusCode).toBe(200);

    // 3. Momento T2: A comissão/desconto da marca muda para 40%
    const resPutMarca = await app.inject({
      method: 'PUT',
      url: `/api/marcas/${marcaNaturaId}`,
      headers: { Authorization: `Bearer ${tokenSonia}` },
      payload: {
        nome: 'Natura',
        percentual_padrao: 40
      }
    });
    expect(resPutMarca.statusCode).toBe(200);

    // 4. Verificação de Imutabilidade na Encomenda Passada (T0)
    const resGetEnc1 = await app.inject({
      method: 'GET',
      url: `/api/encomendas/${enc1.id}`,
      headers: { Authorization: `Bearer ${tokenSonia}` }
    });
    expect(resGetEnc1.statusCode).toBe(200);
    const enc1Consultada = resGetEnc1.json();

    // Invariante AD-2 & FR-019: valores passados congelados!
    expect(enc1Consultada.valor_total_centavos).toBe(20000);
    expect(enc1Consultada.valor_total_formatado).toBe('R$ 200,00');
    expect(enc1Consultada.itens[0].preco_unitario_centavos).toBe(10000);
    expect(enc1Consultada.itens[0].custo_unitario_centavos).toBe(7000);
    expect(enc1Consultada.itens[0].origem_custo).toBe('ESTIMADO_PERCENTUAL');

    // 5. Verificação na Ficha da Cliente (GET /api/clientes/:id)
    const resCliente = await app.inject({
      method: 'GET',
      url: `/api/clientes/${clienteAnaId}`,
      headers: { Authorization: `Bearer ${tokenSonia}` }
    });
    expect(resCliente.statusCode).toBe(200);
    const ficha = resCliente.json();
    const contaAntiga = ficha.contas.find((c: any) => c.encomenda_id === enc1.id);
    expect(contaAntiga).toBeDefined();
    expect(contaAntiga.valor_total).toBe(20000); // Exibe R$ 200,00 e não R$ 260,00!

    // 6. Momento T3: Nova encomenda criada após o reajuste reflete os novos preços de catálogo
    const resEnc2 = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { Authorization: `Bearer ${tokenSonia}` },
      payload: {
        cliente_id: clienteAnaId,
        descricao: 'Nova encomenda após reajuste',
        itens: [
          {
            produto_id: produtoHidratanteId,
            quantidade: 2 // 2 x R$ 130,00 = R$ 260,00
          }
        ]
      }
    });
    expect(resEnc2.statusCode).toBe(201);
    const enc2 = resEnc2.json();
    expect(enc2.valor_total_centavos).toBe(26000);
    expect(enc2.itens[0].preco_unitario_centavos).toBe(13000);
    expect(enc2.itens[0].custo_unitario_centavos).toBe(9000);
  });

  it('deve manter custo NULL e origem DESCONHECIDO congelados mesmo se o produto receber custo posteriormente', async () => {
    // 1. Cria encomenda com produto sem custo
    const resEnc = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { Authorization: `Bearer ${tokenSonia}` },
      payload: {
        cliente_id: clienteAnaId,
        descricao: 'Encomenda com produto sem custo',
        itens: [
          {
            produto_id: produtoSemCustoId,
            quantidade: 1
          }
        ]
      }
    });
    expect(resEnc.statusCode).toBe(201);
    const enc = resEnc.json();
    expect(enc.itens[0].custo_unitario_centavos).toBeNull();
    expect(enc.itens[0].origem_custo).toBe('DESCONHECIDO');

    // 2. Atualiza o produto atribuindo custo manual no catálogo
    await app.inject({
      method: 'PUT',
      url: `/api/produtos/${produtoSemCustoId}`,
      headers: { Authorization: `Bearer ${tokenSonia}` },
      payload: {
        preco_venda_centavos: 5000,
        custo_manual_centavos: 3000
      }
    });

    // 3. Consulta a encomenda passada e verifica que o custo continua NULL
    const resGetEnc = await app.inject({
      method: 'GET',
      url: `/api/encomendas/${enc.id}`,
      headers: { Authorization: `Bearer ${tokenSonia}` }
    });
    expect(resGetEnc.statusCode).toBe(200);
    const encRecarregada = resGetEnc.json();
    expect(encRecarregada.itens[0].custo_unitario_centavos).toBeNull();
    expect(encRecarregada.itens[0].origem_custo).toBe('DESCONHECIDO');
  });

  it('deve congelar o custo unitario em CompraMarca e resistir a alteracoes posteriores de desconto de marca (FR-019)', async () => {
    // 1. Cria compra à marca
    const resCompra = await app.inject({
      method: 'POST',
      url: '/api/compras-marca',
      headers: { Authorization: `Bearer ${tokenSonia}` },
      payload: {
        marca_id: marcaNaturaId,
        itens: [
          {
            produto_id: produtoHidratanteId,
            destinacao: 'PRONTA_ENTREGA',
            quantidade: 3
          }
        ]
      }
    });

    expect(resCompra.statusCode).toBe(201);
    const compra = resCompra.json();
    const custoOriginal = compra.custo_total_estimado_centavos;

    // 2. Altera o percentual da marca novamente para 50%
    await app.inject({
      method: 'PUT',
      url: `/api/marcas/${marcaNaturaId}`,
      headers: { Authorization: `Bearer ${tokenSonia}` },
      payload: {
        nome: 'Natura',
        percentual_padrao: 50
      }
    });

    // 3. Consulta a compra registrada
    const resGetCompra = await app.inject({
      method: 'GET',
      url: `/api/compras-marca/${compra.id}`,
      headers: { Authorization: `Bearer ${tokenSonia}` }
    });

    expect(resGetCompra.statusCode).toBe(200);
    const compraRecarregada = resGetCompra.json();
    expect(compraRecarregada.custo_total_estimado_centavos).toBe(custoOriginal);
  });
});
