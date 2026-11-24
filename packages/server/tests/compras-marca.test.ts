import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Story 2.2: Compras à Marca API - Consolidação de Pedido e Separação de Clientes vs Pronta-Entrega', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });

  const operacaoAId = gerarUuidV7();
  const operacaoBId = gerarUuidV7();
  const operadorSoniaId = gerarUuidV7();
  const operadorOutroBId = gerarUuidV7();

  let tokenSoniaA: string;
  let tokenOutroB: string;

  let marcaNaturaAId: string;
  let marcaAvonAId: string;
  let clienteAnaAId: string;
  let clienteBiaAId: string;
  let produtoHidratanteNaturaAId: string;
  let produtoBatomNaturaAId: string;
  let produtoPerfumeAvonAId: string;

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

    // 1. Operação A (Dona Sônia)
    await prisma.operacao.create({
      data: { id: operacaoAId, nome: 'Consultoria Dona Sônia' }
    });
    await prisma.operador.create({
      data: { id: operadorSoniaId, operacao_id: operacaoAId, nome: 'Dona Sônia', ativo: true }
    });

    // 2. Operação B
    await prisma.operacao.create({
      data: { id: operacaoBId, nome: 'Operação B' }
    });
    await prisma.operador.create({
      data: { id: operadorOutroBId, operacao_id: operacaoBId, nome: 'Operador B', ativo: true }
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

    // Marcas em A
    marcaNaturaAId = gerarUuidV7();
    await prisma.marca.create({
      data: {
        id: marcaNaturaAId,
        operacao_id: operacaoAId,
        nome: 'Natura',
        percentual_padrao: 30
      }
    });

    marcaAvonAId = gerarUuidV7();
    await prisma.marca.create({
      data: {
        id: marcaAvonAId,
        operacao_id: operacaoAId,
        nome: 'Avon',
        percentual_padrao: 25
      }
    });

    // Clientes em A
    clienteAnaAId = gerarUuidV7();
    await prisma.cliente.create({
      data: {
        id: clienteAnaAId,
        operacao_id: operacaoAId,
        nome: 'Ana Silva',
        telefone: '11999991111'
      }
    });

    clienteBiaAId = gerarUuidV7();
    await prisma.cliente.create({
      data: {
        id: clienteBiaAId,
        operacao_id: operacaoAId,
        nome: 'Bia Santos',
        telefone: '11999992222'
      }
    });

    // Produtos em A
    produtoHidratanteNaturaAId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoHidratanteNaturaAId,
        operacao_id: operacaoAId,
        marca_id: marcaNaturaAId,
        nome: 'Hidratante Tododia Algodão',
        variante: '400ml',
        preco_venda_centavos: 6000,
        custo_centavos: 4200,
        proveniencia_custo: 'TABELA_ORIGINAL'
      }
    });
    await prisma.estoqueItem.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: operacaoAId,
        produto_id: produtoHidratanteNaturaAId,
        presentes: 5,
        reservados: 1,
        pronta_entrega: 4
      }
    });

    produtoBatomNaturaAId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoBatomNaturaAId,
        operacao_id: operacaoAId,
        marca_id: marcaNaturaAId,
        nome: 'Batom Matte Natura Una',
        variante: 'Vermelho',
        preco_venda_centavos: 4000,
        custo_centavos: null,
        proveniencia_custo: 'DESCONHECIDO'
      }
    });
    await prisma.estoqueItem.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: operacaoAId,
        produto_id: produtoBatomNaturaAId,
        presentes: 2,
        reservados: 0,
        pronta_entrega: 2
      }
    });

    produtoPerfumeAvonAId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoPerfumeAvonAId,
        operacao_id: operacaoAId,
        marca_id: marcaAvonAId,
        nome: 'Perfume Far Away',
        preco_venda_centavos: 8000,
        custo_centavos: 6000,
        proveniencia_custo: 'TABELA_ORIGINAL'
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/compras-marca (FR-017, FR-018, AD-1, AD-3, NFR-003)', () => {
    it('deve registrar compra à marca consolidando quantidades por produto e mantendo vínculos nominais estritos', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/compras-marca',
        headers: { Authorization: `Bearer ${tokenSoniaA}` },
        payload: {
          marca_id: marcaNaturaAId,
          numero_pedido: 'NAT-2026-001',
          observacoes: 'Ciclo 15 / Encomenda de Natal',
          itens: [
            // Ana: 1 Hidratante
            {
              produto_id: produtoHidratanteNaturaAId,
              destinacao: 'CLIENTE',
              quantidade: 1,
              cliente_id: clienteAnaAId
            },
            // Bia: 1 Hidratante
            {
              produto_id: produtoHidratanteNaturaAId,
              destinacao: 'CLIENTE',
              quantidade: 1,
              cliente_id: clienteBiaAId
            },
            // Pronta-entrega: +1 Hidratante
            {
              produto_id: produtoHidratanteNaturaAId,
              destinacao: 'PRONTA_ENTREGA',
              quantidade: 1
            },
            // Pronta-entrega: 2 Batons
            {
              produto_id: produtoBatomNaturaAId,
              destinacao: 'PRONTA_ENTREGA',
              quantidade: 2
            }
          ]
        }
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();

      expect(data.id).toBeDefined();
      expect(data.marca_id).toBe(marcaNaturaAId);
      expect(data.marca_nome).toBe('Natura');
      expect(data.status).toBe('PEDIDO_REGISTRADO');
      expect(data.numero_pedido).toBe('NAT-2026-001');

      // Totais consolidados
      expect(data.quantidade_total_itens).toBe(5); // 3 hidratantes + 2 batons
      expect(data.quantidade_itens_clientes).toBe(2);
      expect(data.quantidade_itens_pronta_entrega).toBe(3);

      // Custo: Hidratante = 4200 (TABELA_ORIGINAL) * 3 = 12600. Batom = 4000 * (1 - 0.30) = 2800 * 2 = 5600. Total = 18200
      expect(data.custo_total_estimado_centavos).toBe(18200);

      // Espelho de produtos para digitação no site da marca (FR-017)
      expect(data.espelho_produtos).toBeDefined();
      expect(data.espelho_produtos.length).toBe(2);
      // O espelho leva o que a revendedora digita no site da marca: nome e códigos
      for (const linha of data.espelho_produtos) {
        expect(typeof linha.produtoNome).toBe('string');
        expect(linha.produtoNome.length).toBeGreaterThan(0);
        expect(linha).toHaveProperty('codigoRevista');
        expect(linha).toHaveProperty('codigoBarras');
        expect(linha).toHaveProperty('imagemUrl');
      }

      const espelhoHidratante = data.espelho_produtos.find(
        (e: any) => e.produtoId === produtoHidratanteNaturaAId
      );
      expect(espelhoHidratante).toBeDefined();
      expect(espelhoHidratante.quantidadeTotal).toBe(3);
      expect(espelhoHidratante.quantidadeClientes).toBe(2);
      expect(espelhoHidratante.quantidadeProntaEntrega).toBe(1);
      expect(espelhoHidratante.destinacoes.length).toBe(3);

      const espelhoBatom = data.espelho_produtos.find(
        (e: any) => e.produtoId === produtoBatomNaturaAId
      );
      expect(espelhoBatom).toBeDefined();
      expect(espelhoBatom.quantidadeTotal).toBe(2);
      expect(espelhoBatom.quantidadeClientes).toBe(0);
      expect(espelhoBatom.quantidadeProntaEntrega).toBe(2);

      // Invariante AD-3: Compra à marca com status PEDIDO_REGISTRADO NÃO altera estoque físico
      const estoqueHidratante = await prisma.estoqueItem.findUnique({
        where: {
          operacao_id_produto_id: {
            operacao_id: operacaoAId,
            produto_id: produtoHidratanteNaturaAId
          }
        }
      });
      expect(estoqueHidratante?.presentes).toBe(5);
      expect(estoqueHidratante?.reservados).toBe(1);
      expect(estoqueHidratante?.pronta_entrega).toBe(4);

      // Auditoria nominal (NFR-003, AD-1)
      const audit = await prisma.registroAuditoria.findFirst({
        where: {
          operacao_id: operacaoAId,
          acao: 'REGISTRAR_COMPRA_MARCA'
        },
        orderBy: { criado_em: 'desc' }
      });
      expect(audit).toBeDefined();
      expect(audit?.operador_nome).toBe('Dona Sônia');
      expect(audit?.detalhes).toContain(data.id);
    });

    it('deve rejeitar compra com produto pertencente a outra marca (PRODUTO_MARCA_INCOMPATIVEL)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/compras-marca',
        headers: { Authorization: `Bearer ${tokenSoniaA}` },
        payload: {
          marca_id: marcaNaturaAId,
          itens: [
            {
              produto_id: produtoPerfumeAvonAId, // Pertence à Avon!
              destinacao: 'PRONTA_ENTREGA',
              quantidade: 1
            }
          ]
        }
      });

      expect(response.statusCode).toBe(400);
      const data = response.json();
      expect(data.code).toBe('PRODUTO_MARCA_INCOMPATIVEL');
    });

    it('deve rejeitar item com destinação CLIENTE sem cliente_id válido (CLIENTE_OBRIGATORIO)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/compras-marca',
        headers: { Authorization: `Bearer ${tokenSoniaA}` },
        payload: {
          marca_id: marcaNaturaAId,
          itens: [
            {
              produto_id: produtoHidratanteNaturaAId,
              destinacao: 'CLIENTE',
              quantidade: 1
            }
          ]
        }
      });

      expect(response.statusCode).toBe(400);
      const data = response.json();
      expect(data.code).toBe('CLIENTE_OBRIGATORIO');
    });

    it('deve garantir isolamento multi-inquilino (Operação B não pode usar produtos de Operação A)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/compras-marca',
        headers: { Authorization: `Bearer ${tokenOutroB}` },
        payload: {
          marca_id: marcaNaturaAId,
          itens: [
            {
              produto_id: produtoHidratanteNaturaAId,
              destinacao: 'PRONTA_ENTREGA',
              quantidade: 1
            }
          ]
        }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe('MARCA_NAO_ENCONTRADA');
    });
  });

  describe('GET /api/compras-marca e GET /api/compras-marca/:id', () => {
    it('deve listar compras e retornar detalhes com espelho consolidado', async () => {
      const listResp = await app.inject({
        method: 'GET',
        url: '/api/compras-marca',
        headers: { Authorization: `Bearer ${tokenSoniaA}` }
      });

      expect(listResp.statusCode).toBe(200);
      const list = listResp.json();
      expect(list.length).toBeGreaterThanOrEqual(1);

      const compraId = list[0].id;
      const getResp = await app.inject({
        method: 'GET',
        url: `/api/compras-marca/${compraId}`,
        headers: { Authorization: `Bearer ${tokenSoniaA}` }
      });

      expect(getResp.statusCode).toBe(200);
      const detalhe = getResp.json();
      expect(detalhe.id).toBe(compraId);
      expect(detalhe.espelho_produtos).toBeDefined();
      expect(detalhe.itens.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/compras-marca/pendencias', () => {
    it('deve retornar itens de encomendas pendentes de fábrica para a marca', async () => {
      // Cria uma encomenda com item pendente
      const encResp = await app.inject({
        method: 'POST',
        url: '/api/encomendas',
        headers: { Authorization: `Bearer ${tokenSoniaA}` },
        payload: {
          cliente_id: clienteAnaAId,
          descricao: 'Encomenda pendente de teste',
          itens: [
            {
              produto_id: produtoHidratanteNaturaAId,
              quantidade: 2
            }
          ]
        }
      });
      expect(encResp.statusCode).toBe(201);

      const pendResp = await app.inject({
        method: 'GET',
        url: `/api/compras-marca/pendencias?marca_id=${marcaNaturaAId}`,
        headers: { Authorization: `Bearer ${tokenSoniaA}` }
      });

      expect(pendResp.statusCode).toBe(200);
      const pendData = pendResp.json();
      expect(pendData.pendencias.length).toBeGreaterThanOrEqual(1);
      const pend = pendData.pendencias.find(
        (p: any) => p.produto_id === produtoHidratanteNaturaAId && p.cliente_id === clienteAnaAId
      );
      expect(pend).toBeDefined();
      expect(pend.quantidade).toBe(2);
      expect(pend.cliente_nome).toBe('Ana Silva');
    });
  });
});
