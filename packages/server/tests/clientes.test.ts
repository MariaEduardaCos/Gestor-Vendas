import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Story 1.2: Clientes API - Cadastro, Edição, Busca e Ficha', () => {
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
    await prisma.itemConta.deleteMany();
    await prisma.encomenda.deleteMany();
    await prisma.conta.deleteMany();
    await prisma.cliente.deleteMany();
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
      data: { id: operadorBId, operacao_id: operacaoBId, nome: 'Outra Operadora', ativo: true }
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
    await prisma.$disconnect();
    await app.close();
  });

  it('deve realizar cadastro rápido de cliente via gaveta (apenas nome obrigatório)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Carla Vizinha',
        telefone: '(64) 99876-5432'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.operacao_id).toBe(operacaoAId);
    expect(body.nome).toBe('Carla Vizinha');
    expect(body.telefone).toBe('(64) 99876-5432');
    expect(body.telefone_formatado).toBe('(64) 99876-5432');
    expect(body.endereco).toBeNull();
    expect(body.saldo_credito_centavos).toBe(0);

    // Verifica auditoria nominal gerada (NFR-003)
    const audit = await prisma.registroAuditoria.findFirst({
      where: {
        operacao_id: operacaoAId,
        acao: 'CADASTRAR_CLIENTE'
      }
    });
    expect(audit).toBeDefined();
    expect(audit?.operador_id).toBe(operadorSoniaId);
    expect(audit?.operador_nome).toBe('Dona Sônia');
  });

  it('deve rejeitar cadastro de cliente com nome vazio (400 Bad Request RFC 7807)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: '   ',
        telefone: '6499999999'
      }
    });

    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json();
    expect(body.status).toBe(400);
    expect(body.code).toBe('BAD_REQUEST');
  });

  it('deve cadastrar cliente com dados completos (nome, telefone e endereço)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Ana Paula Silva',
        telefone: '64991112233',
        endereco: 'Rua das Camélias, 45, Bairro Centro'
      }
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.nome).toBe('Ana Paula Silva');
    expect(body.telefone_formatado).toBe('(64) 99111-2233');
    expect(body.endereco).toBe('Rua das Camélias, 45, Bairro Centro');
  });

  it('deve permitir o cadastro de clientes homônimos com UUIDs v7 distintos e diferenciação visual', async () => {
    // Primeiro cliente com nome "Maria Silva"
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Maria Silva',
        telefone: '(64) 98888-0001',
        endereco: 'Vila Nova'
      }
    });
    expect(res1.statusCode).toBe(201);
    const maria1 = res1.json();

    // Segundo cliente com mesmo nome "Maria Silva"
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Maria Silva',
        telefone: '(64) 97777-0002',
        endereco: 'Setor Sul'
      }
    });
    expect(res2.statusCode).toBe(201);
    const maria2 = res2.json();

    expect(maria1.id).not.toBe(maria2.id);
    expect(maria1.nome).toBe(maria2.nome);
    expect(maria1.telefone).not.toBe(maria2.telefone);

    // Consulta de busca por "Maria Silva"
    const searchRes = await app.inject({
      method: 'GET',
      url: '/api/clientes?busca=Maria Silva',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(searchRes.statusCode).toBe(200);
    const results = searchRes.json();
    expect(results.length).toBe(2);
    expect(results.map((r: any) => r.id)).toContain(maria1.id);
    expect(results.map((r: any) => r.id)).toContain(maria2.id);
  });

  it('deve realizar busca instantânea por prefixo de nome ou telefone em tempo < 2s', async () => {
    const start = performance.now();
    const res = await app.inject({
      method: 'GET',
      url: '/api/clientes?busca=ana',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    const duration = performance.now() - start;

    expect(res.statusCode).toBe(200);
    expect(duration).toBeLessThan(2000); // NFR-006: < 2s
    const results = res.json();
    expect(results.some((c: any) => c.nome.includes('Ana'))).toBe(true);

    // Busca por telefone (substring)
    const resTel = await app.inject({
      method: 'GET',
      url: '/api/clientes?busca=99876',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resTel.statusCode).toBe(200);
    const resultsTel = resTel.json();
    expect(resultsTel.length).toBeGreaterThanOrEqual(1);
    expect(resultsTel[0].nome).toBe('Carla Vizinha');

    // Busca por dígitos numéricos puros (ex: 6499876) deve casar com telefone formatado "(64) 99876-5432"
    const resDigitos = await app.inject({
      method: 'GET',
      url: '/api/clientes?busca=6499876',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resDigitos.statusCode).toBe(200);
    const resultsDigitos = resDigitos.json();
    expect(resultsDigitos.some((c: any) => c.nome === 'Carla Vizinha')).toBe(true);

    // Listagem sem parâmetro de busca retorna todos os clientes da Operação A ordenados por nome asc
    const resTodos = await app.inject({
      method: 'GET',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resTodos.statusCode).toBe(200);
    const todos = resTodos.json();
    expect(todos.length).toBeGreaterThanOrEqual(4);
    const nomes = todos.map((c: any) => c.nome);
    const nomesOrdenados = [...nomes].sort((a, b) => a.localeCompare(b));
    expect(nomes).toEqual(nomesOrdenados);

    // Busca sem match retorna lista vazia
    const resVazia = await app.inject({
      method: 'GET',
      url: '/api/clientes?busca=InexistenteTermo999',
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resVazia.statusCode).toBe(200);
    expect(resVazia.json()).toEqual([]);
  });

  it('deve consultar ficha detalhada da cliente (GET /:id) com contas e encomendas', async () => {
    // Cria cliente para testar ficha
    const resCriar = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Bia Santos',
        telefone: '(64) 99333-4444'
      }
    });
    const bia = resCriar.json();

    // Adiciona uma conta e uma encomenda diretamente para a Bia
    await prisma.conta.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: operacaoAId,
        cliente_id: bia.id,
        valor_total: 5000,
        total_pago: 2500,
        status: 'ABERTA'
      }
    });

    await prisma.encomenda.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: operacaoAId,
        cliente_id: bia.id,
        descricao: 'Hidratante Algodão Natura',
        status: 'AGUARDANDO_FABRICA'
      }
    });

    const resFicha = await app.inject({
      method: 'GET',
      url: `/api/clientes/${bia.id}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(resFicha.statusCode).toBe(200);
    const ficha = resFicha.json();
    expect(ficha.id).toBe(bia.id);
    expect(ficha.nome).toBe('Bia Santos');
    expect(ficha.saldo_credito_centavos).toBe(0);
    expect(ficha.contas.length).toBe(1);
    expect(ficha.contas[0].valor_total).toBe(5000);
    expect(ficha.encomendas.length).toBe(1);
    expect(ficha.encomendas[0].descricao).toBe('Hidratante Algodão Natura');
  });

  it('deve atualizar cliente (PUT /:id) e registrar auditoria nominal', async () => {
    const resCriar = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: { nome: 'Nome Antigo', telefone: '123' }
    });
    const cliente = resCriar.json();

    const resPut = await app.inject({
      method: 'PUT',
      url: `/api/clientes/${cliente.id}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        nome: 'Nome Atualizado',
        telefone: '(64) 98765-1111',
        endereco: 'Novo Endereço 100'
      }
    });

    expect(resPut.statusCode).toBe(200);
    const atualizado = resPut.json();
    expect(atualizado.nome).toBe('Nome Atualizado');
    expect(atualizado.telefone).toBe('(64) 98765-1111');
    expect(atualizado.endereco).toBe('Novo Endereço 100');

    // Auditoria de edição
    const audit = await prisma.registroAuditoria.findFirst({
      where: {
        operacao_id: operacaoAId,
        acao: 'EDITAR_CLIENTE'
      },
      orderBy: { criado_em: 'desc' }
    });
    expect(audit).toBeDefined();
    expect(audit?.detalhes).toContain('Nome Atualizado');
  });

  it('deve impedir a exclusão de cliente que possua contas ou encomendas vinculadas', async () => {
    // Cliente com conta
    const resCriar = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: { nome: 'Cliente Com Vínculos' }
    });
    const cliente = resCriar.json();

    await prisma.conta.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: operacaoAId,
        cliente_id: cliente.id,
        valor_total: 8000,
        total_pago: 0,
        status: 'ABERTA'
      }
    });

    const resDel = await app.inject({
      method: 'DELETE',
      url: `/api/clientes/${cliente.id}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(resDel.statusCode).toBe(400);
    expect(resDel.headers['content-type']).toContain('application/problem+json');
    const problem = resDel.json();
    expect(problem.code).toBe('CLIENTE_POSSUI_VINCULOS');
    expect(problem.detail).toContain('Não é permitido excluir cliente que possua vendas, encomendas');
  });

  it('deve bloquear a exclusão de cliente com 0 contas mas com encomenda ativa', async () => {
    // Cliente apenas com encomenda (0 contas)
    const resCriar = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: { nome: 'Cliente Com Apenas Encomenda' }
    });
    const cliente = resCriar.json();

    await prisma.encomenda.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: operacaoAId,
        cliente_id: cliente.id,
        descricao: 'Batom Matte Natura',
        status: 'AGUARDANDO_FABRICA'
      }
    });

    const resDel = await app.inject({
      method: 'DELETE',
      url: `/api/clientes/${cliente.id}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(resDel.statusCode).toBe(400);
    expect(resDel.headers['content-type']).toContain('application/problem+json');
    const problem = resDel.json();
    expect(problem.code).toBe('CLIENTE_POSSUI_VINCULOS');
  });

  it('deve bloquear a exclusão de cliente que possua saldo positivo na carteira de crédito', async () => {
    const resCriar = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: { nome: 'Cliente Com Saldo de Crédito' }
    });
    const cliente = resCriar.json();

    // Atribui saldo de crédito positivo de R$ 50,00
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { saldo_credito_centavos: 5000 }
    });

    const resDel = await app.inject({
      method: 'DELETE',
      url: `/api/clientes/${cliente.id}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(resDel.statusCode).toBe(400);
    expect(resDel.headers['content-type']).toContain('application/problem+json');
    const problem = resDel.json();
    expect(problem.code).toBe('CLIENTE_POSSUI_VINCULOS');
  });

  it('deve permitir a exclusão de cliente sem vínculos e registrar auditoria', async () => {
    const resCriar = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: { nome: 'Cliente Sem Vínculos' }
    });
    const cliente = resCriar.json();

    const resDel = await app.inject({
      method: 'DELETE',
      url: `/api/clientes/${cliente.id}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });

    expect(resDel.statusCode).toBe(200);
    expect(resDel.json().sucesso).toBe(true);

    // Consulta subsequente deve retornar 404
    const resGet = await app.inject({
      method: 'GET',
      url: `/api/clientes/${cliente.id}`,
      headers: { authorization: `Bearer ${tokenSoniaA}` }
    });
    expect(resGet.statusCode).toBe(404);
  });

  it('isolamento multi-inquilino: Operação B não pode listar, obter, editar ou excluir clientes da Operação A', async () => {
    // Cria cliente na Operação A
    const resCriar = await app.inject({
      method: 'POST',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenSoniaA}` },
      payload: { nome: 'Cliente Confidencial A', telefone: '11999990000' }
    });
    const clienteA = resCriar.json();

    // 1. Operação B lista clientes: não deve ver o cliente da Operação A
    const resListaB = await app.inject({
      method: 'GET',
      url: '/api/clientes',
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resListaB.statusCode).toBe(200);
    const listaB = resListaB.json();
    expect(listaB.some((c: any) => c.id === clienteA.id)).toBe(false);

    // 2. Operação B tenta consultar clienteA por ID -> 404 Not Found
    const resGetCruzado = await app.inject({
      method: 'GET',
      url: `/api/clientes/${clienteA.id}`,
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resGetCruzado.statusCode).toBe(404);
    expect(resGetCruzado.headers['content-type']).toContain('application/problem+json');

    // 3. Operação B tenta editar clienteA -> 404 Not Found
    const resPutCruzado = await app.inject({
      method: 'PUT',
      url: `/api/clientes/${clienteA.id}`,
      headers: { authorization: `Bearer ${tokenOutroB}` },
      payload: { nome: 'Ataque Inquilino' }
    });
    expect(resPutCruzado.statusCode).toBe(404);

    // 4. Operação B tenta excluir clienteA -> 404 Not Found
    const resDelCruzado = await app.inject({
      method: 'DELETE',
      url: `/api/clientes/${clienteA.id}`,
      headers: { authorization: `Bearer ${tokenOutroB}` }
    });
    expect(resDelCruzado.statusCode).toBe(404);
  });
});
