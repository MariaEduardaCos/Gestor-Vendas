import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Story 1.3: Produtos, Variantes, Preço de Venda e Custo por Marca', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });

  const operacaoAId = gerarUuidV7();
  const operacaoBId = gerarUuidV7();
  const operadorSoniaId = gerarUuidV7();
  const operadorBId = gerarUuidV7();

  let tokenSoniaA: string;
  let tokenOutroB: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Limpeza de tabelas
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
      data: { id: operacaoBId, nome: 'Consultoria Revendedora B' }
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
  });

  afterAll(async () => {
    await prisma.produto.deleteMany();
    await prisma.marca.deleteMany();
    await prisma.registroAuditoria.deleteMany();
    await prisma.operador.deleteMany();
    await prisma.operacao.deleteMany();
    await prisma.$disconnect();
  });

  it('deve cadastrar e listar marcas com percentuais de desconto e auditoria nominal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/marcas',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Natura',
        percentual_padrao: 30
      }
    });

    expect(res.statusCode).toBe(201);
    const marca = res.json();
    expect(marca.id).toBeDefined();
    expect(marca.nome).toBe('Natura');
    expect(marca.percentual_padrao).toBe(30);

    // Listagem
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/marcas',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(listRes.statusCode).toBe(200);
    const lista = listRes.json();
    expect(lista.length).toBe(1);
    expect(lista[0].nome).toBe('Natura');

    // Auditoria
    const audit = await prisma.registroAuditoria.findFirst({
      where: {
        operacao_id: operacaoAId,
        acao: 'CADASTRAR_MARCA'
      }
    });
    expect(audit).not.toBeNull();
    expect(audit?.operador_nome).toBe('Dona Sônia');
  });

  it('deve cadastrar produto com percentual de marca calculando custo estimado em R$ 70,00 (FR-011, D-01)', async () => {
    // Busca a marca Natura com 30%
    const marca = await prisma.marca.findFirst({
      where: { operacao_id: operacaoAId, nome: 'Natura' }
    });
    expect(marca).not.toBeNull();

    // Given um produto cadastrado com preço de venda R$ 100,00 e uma marca cadastrada com percentual de lucro de 30%
    const res = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        marca_id: marca!.id,
        nome: 'Hidratante Tododia Algodão',
        variante: '400ml',
        codigo_barras: '7891234567890',
        preco_venda_centavos: 10000 // R$ 100,00
      }
    });

    // When o custo estimado for calculado, then o sistema registra custo estimado de R$ 70,00 com proveniência ESTIMADO_PERCENTUAL
    expect(res.statusCode).toBe(201);
    const prod = res.json();
    expect(prod.id).toBeDefined();
    expect(prod.nome).toBe('Hidratante Tododia Algodão');
    expect(prod.variante).toBe('400ml');
    expect(prod.preco_venda_centavos).toBe(10000);
    expect(prod.preco_venda_formatado).toContain('100,00');
    expect(prod.custo_centavos).toBe(7000);
    expect(prod.custo_formatado).toContain('70,00');
    expect(prod.proveniencia_custo).toBe('ESTIMADO_PERCENTUAL');
  });

  it('deve priorizar custo manual informado R$ 65,00 e gravar proveniencia INFORMADO_MANUAL', async () => {
    const marca = await prisma.marca.findFirst({
      where: { operacao_id: operacaoAId, nome: 'Natura' }
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        marca_id: marca!.id,
        nome: 'Perfume Essencial Exclusivo',
        preco_venda_centavos: 10000, // R$ 100,00
        custo_manual_centavos: 6500 // R$ 65,00
      }
    });

    expect(res.statusCode).toBe(201);
    const prod = res.json();
    expect(prod.preco_venda_centavos).toBe(10000);
    expect(prod.custo_centavos).toBe(6500);
    expect(prod.custo_formatado).toContain('65,00');
    expect(prod.proveniencia_custo).toBe('INFORMADO_MANUAL');
  });

  it('deve armazenar custo NULL e proveniencia DESCONHECIDO se ausente percentual e custo manual (FR-012, AD-2)', async () => {
    // Cria marca sem percentual padrão (ex: Boticário sem percentual cadastrado)
    const marcaBoticario = await prisma.marca.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: operacaoAId,
        nome: 'O Boticário',
        percentual_padrao: null
      }
    });

    // Given um produto cadastrado sem percentual de marca associado e sem custo manual informado
    const res = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        marca_id: marcaBoticario.id,
        nome: 'Floratta Red',
        preco_venda_centavos: 12000 // R$ 120,00
      }
    });

    // When a consulta do produto for realizada, then o campo de custo é armazenado como NULL e exibido como "Desconhecido", sendo terminantemente proibido gravar 0,00
    expect(res.statusCode).toBe(201);
    const prod = res.json();
    expect(prod.custo_centavos).toBeNull();
    expect(prod.custo_formatado).toBe('Desconhecido');
    expect(prod.proveniencia_custo).toBe('DESCONHECIDO');

    // Confere no banco direto: custo_centavos deve ser NULL, nunca 0
    const rawProd = await prisma.produto.findUnique({
      where: { id: prod.id }
    });
    expect(rawProd?.custo_centavos).toBeNull();
    expect(rawProd?.custo_centavos).not.toBe(0);
  });

  it('deve cadastrar variantes do mesmo produto com UUIDs v7 distintos sem agrupar (FR-006)', async () => {
    const resV1 = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Hidratante Tododia Noz Pecã',
        variante: '400ml Regular',
        preco_venda_centavos: 6500
      }
    });
    const v1 = resV1.json();

    const resV2 = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Hidratante Tododia Noz Pecã',
        variante: 'Refil Econômico',
        preco_venda_centavos: 4800
      }
    });
    const v2 = resV2.json();

    expect(v1.id).not.toBe(v2.id);
    expect(v1.nome).toBe(v2.nome);
    expect(v1.variante).toBe('400ml Regular');
    expect(v2.variante).toBe('Refil Econômico');
    expect(v1.preco_venda_centavos).toBe(6500);
    expect(v2.preco_venda_centavos).toBe(4800);
  });

  it('deve buscar produto rapidamente por código de barras ou por nome (< 2s)', async () => {
    // Busca por código de barras direto
    const t0 = Date.now();
    const resCodigo = await app.inject({
      method: 'GET',
      url: '/api/produtos/codigo/7891234567890',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    const duracaoCodigo = Date.now() - t0;
    expect(duracaoCodigo).toBeLessThan(2000);
    expect(resCodigo.statusCode).toBe(200);
    const prodCodigoJson = resCodigo.json();
    expect(prodCodigoJson.codigo_barras).toBe('7891234567890');
    expect(prodCodigoJson.nome).toBe('Hidratante Tododia Algodão');
    expect(prodCodigoJson.estoque).toEqual({
      presentes: 0,
      reservados: 0,
      pronta_entrega: 0
    });

    // Lança estoque para o produto e verifica se o endpoint por código de barras reflete o estoque atual
    await app.inject({
      method: 'POST',
      url: '/api/estoque/inicial',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        produto_id: prodCodigoJson.id,
        quantidade: 8
      }
    });

    const resComEstoque = await app.inject({
      method: 'GET',
      url: '/api/produtos/codigo/7891234567890',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resComEstoque.statusCode).toBe(200);
    expect(resComEstoque.json().estoque).toEqual({
      presentes: 8,
      reservados: 0,
      pronta_entrega: 8
    });

    // Isolamento multi-inquilino: Operação B não pode encontrar produto da Operação A pelo código
    const resIsolamentoB = await app.inject({
      method: 'GET',
      url: '/api/produtos/codigo/7891234567890',
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resIsolamentoB.statusCode).toBe(404);
    expect(resIsolamentoB.headers['content-type']).toContain('application/problem+json');

    // Busca por termo de nome
    const resNome = await app.inject({
      method: 'GET',
      url: '/api/produtos?busca=Algodão',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resNome.statusCode).toBe(200);
    const lista = resNome.json();
    expect(lista.length).toBeGreaterThanOrEqual(1);
    expect(lista[0].nome).toContain('Algodão');
    expect(lista[0].estoque).toBeDefined();
    expect(lista[0].estoque.presentes).toBe(8);
    expect(lista[0].estoque.pronta_entrega).toBe(8);

    // Código não existente retorna 404 RFC 7807
    const resInexistente = await app.inject({
      method: 'GET',
      url: '/api/produtos/codigo/9999999999999',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resInexistente.statusCode).toBe(404);
    expect(resInexistente.headers['content-type']).toContain('application/problem+json');
  });

  it('deve rejeitar preço de venda menor ou igual a zero e custo negativo', async () => {
    const resZero = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Produto Preço Zero',
        preco_venda_centavos: 0
      }
    });
    expect(resZero.statusCode).toBe(400);

    const resNegativo = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Produto Preço Negativo',
        preco_venda_centavos: -100
      }
    });
    expect(resNegativo.statusCode).toBe(400);

    const resCustoNegativo = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Produto Custo Negativo',
        preco_venda_centavos: 5000,
        custo_manual_centavos: -200
      }
    });
    expect(resCustoNegativo.statusCode).toBe(400);
  });

  it('isolamento multi-inquilino: Operação B não pode consultar, alterar ou excluir produtos/marcas da Operação A', async () => {
    // Pega produto da Operação A
    const prodA = await prisma.produto.findFirst({
      where: { operacao_id: operacaoAId }
    });
    expect(prodA).not.toBeNull();

    // Operação B tenta consultar produto da Operação A por ID
    const resGetId = await app.inject({
      method: 'GET',
      url: `/api/produtos/${prodA!.id}`,
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resGetId.statusCode).toBe(404);
    expect(resGetId.headers['content-type']).toContain('application/problem+json');

    // Operação B tenta consultar por código de barras
    if (prodA!.codigo_barras) {
      const resGetCodigo = await app.inject({
        method: 'GET',
        url: `/api/produtos/codigo/${prodA!.codigo_barras}`,
        headers: { authorization: `Bearer ${tokenOutroB}` }
      });
      expect(resGetCodigo.statusCode).toBe(404);
    }

    // Operação B tenta editar produto da Operação A
    const resPut = await app.inject({
      method: 'PUT',
      url: `/api/produtos/${prodA!.id}`,
      headers: { authorization: `Bearer ${tokenOutroB}` },
      payload: {
        nome: 'Invasão Hacker de Preço',
        preco_venda_centavos: 100
      }
    });
    expect(resPut.statusCode).toBe(404);

    // Operação B tenta excluir produto da Operação A
    const resDel = await app.inject({
      method: 'DELETE',
      url: `/api/produtos/${prodA!.id}`,
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resDel.statusCode).toBe(404);

    // Lista de produtos da Operação B deve estar vazia
    const resListB = await app.inject({
      method: 'GET',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resListB.statusCode).toBe(200);
    expect(resListB.json().length).toBe(0);
  });

  it('deve atualizar produto (PUT /api/produtos/:id) preservando custo manual ou recalculando por marca', async () => {
    // 1. Produto com custo manual: ao alterar preço sem parâmetros de custo, preserva o custo manual
    const resProdManual = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Perfume Kaiak Aventura',
        preco_venda_centavos: 10000,
        custo_manual_centavos: 6500
      }
    });
    const prodManualId = resProdManual.json().id;

    const resPutManual = await app.inject({
      method: 'PUT',
      url: `/api/produtos/${prodManualId}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        preco_venda_centavos: 13000
      }
    });
    expect(resPutManual.statusCode).toBe(200);
    const updatedManual = resPutManual.json();
    expect(updatedManual.preco_venda_centavos).toBe(13000);
    expect(updatedManual.custo_centavos).toBe(6500);
    expect(updatedManual.proveniencia_custo).toBe('INFORMADO_MANUAL');

    // Confere no banco de dados
    const dbManual = await prisma.produto.findUnique({ where: { id: prodManualId } });
    expect(dbManual?.preco_venda_centavos).toBe(13000);
    expect(dbManual?.custo_centavos).toBe(6500);
    expect(dbManual?.proveniencia_custo).toBe('INFORMADO_MANUAL');

    // 2. Produto com percentual de marca: ao alterar preço sem parâmetros de custo, recalcula usando a marca
    const marca = await prisma.marca.findFirst({
      where: { operacao_id: operacaoAId, nome: 'Natura' }
    });
    const resProdMarca = await app.inject({
      method: 'POST',
      url: '/api/produtos',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        marca_id: marca!.id,
        nome: 'Creme Tododia Macadâmia',
        preco_venda_centavos: 10000
      }
    });
    const prodMarcaId = resProdMarca.json().id;
    expect(resProdMarca.json().custo_centavos).toBe(7000);

    const resPutMarca = await app.inject({
      method: 'PUT',
      url: `/api/produtos/${prodMarcaId}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        preco_venda_centavos: 20000 // Dobra o preço
      }
    });
    expect(resPutMarca.statusCode).toBe(200);
    const updatedMarca = resPutMarca.json();
    expect(updatedMarca.preco_venda_centavos).toBe(20000);
    expect(updatedMarca.custo_centavos).toBe(14000); // 30% de desconto sobre 20000 = 14000
    expect(updatedMarca.proveniencia_custo).toBe('ESTIMADO_PERCENTUAL');

    const dbMarca = await prisma.produto.findUnique({ where: { id: prodMarcaId } });
    expect(dbMarca?.preco_venda_centavos).toBe(20000);
    expect(dbMarca?.custo_centavos).toBe(14000);
    expect(dbMarca?.proveniencia_custo).toBe('ESTIMADO_PERCENTUAL');
  });

  it('deve buscar produtos pelo nome da marca no termo de busca (GET /api/produtos?busca=Natura)', async () => {
    const resBuscaMarca = await app.inject({
      method: 'GET',
      url: '/api/produtos?busca=Natura',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resBuscaMarca.statusCode).toBe(200);
    const produtos = resBuscaMarca.json();
    expect(produtos.length).toBeGreaterThanOrEqual(1);
    expect(produtos.every((p: any) => p.marca_nome === 'Natura' || p.nome.includes('Natura'))).toBe(true);
  });

  it('deve excluir produto autorizado (DELETE /api/produtos/:id) e registrar auditoria nominal EXCLUIR_PRODUTO', async () => {
    const novoProduto = await prisma.produto.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: operacaoAId,
        nome: 'Produto Para Excluir',
        preco_venda_centavos: 2500,
        proveniencia_custo: 'DESCONHECIDO'
      }
    });

    const resDelete = await app.inject({
      method: 'DELETE',
      url: `/api/produtos/${novoProduto.id}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resDelete.statusCode).toBe(200);
    expect(resDelete.json().sucesso).toBe(true);

    const conferirDb = await prisma.produto.findUnique({
      where: { id: novoProduto.id }
    });
    expect(conferirDb).toBeNull();

    const auditDel = await prisma.registroAuditoria.findFirst({
      where: {
        operacao_id: operacaoAId,
        acao: 'EXCLUIR_PRODUTO',
        detalhes: { contains: novoProduto.id }
      }
    });
    expect(auditDel).not.toBeNull();
    expect(auditDel?.operador_nome).toBe('Dona Sônia');
    expect(auditDel?.operador_id).toBe(operadorSoniaId);
  });

  it('deve atualizar e excluir marcas (PUT e DELETE /api/marcas/:id) com auditoria nominal', async () => {
    // 1. Cadastra marca de teste
    const marcaCriada = await prisma.marca.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: operacaoAId,
        nome: 'Avon Cosméticos',
        percentual_padrao: 30
      }
    });

    // 2. Atualiza marca (PUT /api/marcas/:id)
    const resPut = await app.inject({
      method: 'PUT',
      url: `/api/marcas/${marcaCriada.id}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Avon Brasil',
        percentual_padrao: 38
      }
    });
    expect(resPut.statusCode).toBe(200);
    const marcaAtualizada = resPut.json();
    expect(marcaAtualizada.nome).toBe('Avon Brasil');
    expect(marcaAtualizada.percentual_padrao).toBe(38);

    const auditPut = await prisma.registroAuditoria.findFirst({
      where: {
        operacao_id: operacaoAId,
        acao: 'EDITAR_MARCA',
        detalhes: { contains: marcaCriada.id }
      }
    });
    expect(auditPut).not.toBeNull();
    expect(auditPut?.operador_nome).toBe('Dona Sônia');

    // 3. Exclui marca (DELETE /api/marcas/:id)
    const resDel = await app.inject({
      method: 'DELETE',
      url: `/api/marcas/${marcaCriada.id}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resDel.statusCode).toBe(200);
    expect(resDel.json().sucesso).toBe(true);

    const conferirDb = await prisma.marca.findUnique({
      where: { id: marcaCriada.id }
    });
    expect(conferirDb).toBeNull();

    const auditDel = await prisma.registroAuditoria.findFirst({
      where: {
        operacao_id: operacaoAId,
        acao: 'EXCLUIR_MARCA',
        detalhes: { contains: marcaCriada.id }
      }
    });
    expect(auditDel).not.toBeNull();
    expect(auditDel?.operador_nome).toBe('Dona Sônia');
  });

  it('isolamento multi-inquilino em marcas: Operação B não pode consultar, editar ou excluir marcas da Operação A', async () => {
    const marcaA = await prisma.marca.findFirst({
      where: { operacao_id: operacaoAId }
    });
    expect(marcaA).not.toBeNull();

    // GET /api/marcas/:id por Operação B
    const resGet = await app.inject({
      method: 'GET',
      url: `/api/marcas/${marcaA!.id}`,
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resGet.statusCode).toBe(404);
    expect(resGet.headers['content-type']).toContain('application/problem+json');

    // PUT /api/marcas/:id por Operação B
    const resPut = await app.inject({
      method: 'PUT',
      url: `/api/marcas/${marcaA!.id}`,
      headers: { authorization: `Bearer ${tokenOutroB}` },
      payload: {
        nome: 'Marca Invasora',
        percentual_padrao: 50
      }
    });
    expect(resPut.statusCode).toBe(404);

    // DELETE /api/marcas/:id por Operação B
    const resDel = await app.inject({
      method: 'DELETE',
      url: `/api/marcas/${marcaA!.id}`,
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resDel.statusCode).toBe(404);

    // Listagem da Operação B não exibe marcas da Operação A
    const resListB = await app.inject({
      method: 'GET',
      url: '/api/marcas',
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resListB.statusCode).toBe(200);
    expect(resListB.json().length).toBe(0);
  });
});

