import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';
import { createTenantPrisma } from '../src/db/tenant-prisma.js';
import { hashPin } from '../src/routes/auth.js';

describe('Multi-tenant Isolation and Operational Session Tests', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });

  const operacaoAId = gerarUuidV7();
  const operacaoBId = gerarUuidV7();
  const operadorSoniaId = gerarUuidV7();
  const operadorOutroId = gerarUuidV7();
  const operadorComPinId = gerarUuidV7();

  let tokenSoniaA: string;
  let tokenOutroB: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Limpeza de tabelas para o teste
    await prisma.registroAuditoria.deleteMany();
    await prisma.recursoExemplo.deleteMany();
    await prisma.operador.deleteMany();
    await prisma.operacao.deleteMany();

    // 1. Cria Operação A (Dona Sônia)
    await prisma.operacao.create({
      data: {
        id: operacaoAId,
        nome: 'Operação Beleza Viva (Dona Sônia)'
      }
    });

    // 2. Cria Operador Dona Sônia na Operação A
    await prisma.operador.create({
      data: {
        id: operadorSoniaId,
        operacao_id: operacaoAId,
        nome: 'Dona Sônia',
        ativo: true
      }
    });

    // 2.1. Cria Operador com PIN hash na Operação A
    await prisma.operador.create({
      data: {
        id: operadorComPinId,
        operacao_id: operacaoAId,
        nome: 'Operador com PIN',
        pin_hash: hashPin('1234'),
        ativo: true
      }
    });

    // 3. Cria Operação B (Outra Revendedora)
    await prisma.operacao.create({
      data: {
        id: operacaoBId,
        nome: 'Operação Cosméticos Estrela'
      }
    });

    // 4. Cria Operador na Operação B
    await prisma.operador.create({
      data: {
        id: operadorOutroId,
        operacao_id: operacaoBId,
        nome: 'Operador Concorrente',
        ativo: true
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it('deve realizar login com sucesso e retornar sessão com operacao_id, operador_id e operador_nome', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        operacao_id: operacaoAId,
        operador_id: operadorSoniaId
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.token).toBeDefined();
    expect(body.session.operacao_id).toBe(operacaoAId);
    expect(body.session.operador_id).toBe(operadorSoniaId);
    expect(body.session.operador_nome).toBe('Dona Sônia');

    tokenSoniaA = body.token;

    // Login da Operação B
    const resB = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        operacao_id: operacaoBId,
        operador_id: operadorOutroId
      }
    });
    tokenOutroB = resB.json().token;
  });

  it('tentativa de login cruzado: operador da Operação B tentando logar na Operação A deve retornar 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        operacao_id: operacaoAId,
        operador_id: operadorOutroId // Operador pertence à Operação B!
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('deve validar autenticação com PIN seguro criptografado com sha256', async () => {
    // PIN incorreto
    const resIncorreto = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        operacao_id: operacaoAId,
        operador_id: operadorComPinId,
        pin: '9999'
      }
    });
    expect(resIncorreto.statusCode).toBe(401);

    // PIN correto
    const resCorreto = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        operacao_id: operacaoAId,
        operador_id: operadorComPinId,
        pin: '1234'
      }
    });
    expect(resCorreto.statusCode).toBe(200);
    expect(resCorreto.json().session.operador_nome).toBe('Operador com PIN');
  });

  it('deve rejeitar requisição sem sessão em rota protegida com 401 e payload RFC 7807', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/session'
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json();
    expect(body.code).toBe('UNAUTHORIZED');
    expect(body.type).toBe('https://consultorasync.app/errors/unauthorized');
    expect(body.title).toBe('Não Autorizado');
  });

  it('deve rejeitar token adulterado/falso com assinatura inválida retornando 401', async () => {
    const forgedToken = `${tokenSoniaA.split('.')[0]}.assinatura_falsa_completamente_adulterada`;
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: {
        authorization: `Bearer ${forgedToken}`
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const body = response.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('deve permitir acesso a rota protegida com sessão válida via Header Bearer', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: {
        authorization: `Bearer ${tokenSoniaA}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.operacao_id).toBe(operacaoAId);
    expect(body.operador_id).toBe(operadorSoniaId);
    expect(body.operador_nome).toBe('Dona Sônia');
  });

  it('deve permitir acesso a rota protegida com sessão válida via Cookie session_token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: {
        cookie: `session_token=${tokenSoniaA}; Path=/; HttpOnly`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.operacao_id).toBe(operacaoAId);
    expect(body.operador_nome).toBe('Dona Sônia');
  });

  it('deve registrar transação confirmada por "Dona Sônia" com operador_id, operador_nome e timestamp ISO-8601 UTC (NFR-003)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/operacional/transacoes',
      headers: {
        authorization: `Bearer ${tokenSoniaA}`
      },
      payload: {
        acao: 'CONFIRMACAO_VENDA',
        detalhes: 'Venda de batom para cliente Maria'
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.operacao_id).toBe(operacaoAId);
    expect(body.operador_id).toBe(operadorSoniaId);
    expect(body.operador_nome).toBe('Dona Sônia');
    expect(body.acao).toBe('CONFIRMACAO_VENDA');
    // Valida timestamp ISO-8601 UTC
    expect(new Date(body.criado_em).toISOString()).toBe(body.criado_em);

    // Valida gravação no banco de dados
    const noBanco = await prisma.registroAuditoria.findUnique({
      where: { id: body.id }
    });
    expect(noBanco).toBeDefined();
    expect(noBanco?.operacao_id).toBe(operacaoAId);
    expect(noBanco?.operador_id).toBe(operadorSoniaId);
    expect(noBanco?.operador_nome).toBe('Dona Sônia');
  });

  it('deve permitir que a Operação A consulte seus próprios registros de auditoria e confirmar que a entrada de Dona Sônia está presente', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/operacional/auditoria',
      headers: {
        authorization: `Bearer ${tokenSoniaA}`
      }
    });

    expect(response.statusCode).toBe(200);
    const records = response.json();
    expect(records.length).toBeGreaterThan(0);
    const soniaRecord = records.find((r: any) => r.operador_nome === 'Dona Sônia' && r.acao === 'CONFIRMACAO_VENDA');
    expect(soniaRecord).toBeDefined();
    expect(soniaRecord.operacao_id).toBe(operacaoAId);
    expect(soniaRecord.operador_id).toBe(operadorSoniaId);
  });

  it('deve impedir que a Operação B veja ou acesse os registros de auditoria da Operação A', async () => {
    // Operação B consulta a lista de auditoria
    const response = await app.inject({
      method: 'GET',
      url: '/api/operacional/auditoria',
      headers: {
        authorization: `Bearer ${tokenOutroB}`
      }
    });

    expect(response.statusCode).toBe(200);
    const records = response.json();
    // A Operação B não deve ter os registros criados pela Dona Sônia na Operação A
    const vazamento = records.some((r: any) => r.operacao_id === operacaoAId);
    expect(vazamento).toBe(false);
  });

  it('Operação A pode recuperar com sucesso seu próprio recurso criado (status 200)', async () => {
    // Dona Sônia (Operação A) cria um recurso
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/operacional/recursos',
      headers: {
        authorization: `Bearer ${tokenSoniaA}`
      },
      payload: {
        titulo: 'Ficha do Cliente Ana',
        descricao: 'Dados cadastrais da Ana'
      }
    });

    expect(createRes.statusCode).toBe(201);
    const recursoAId = createRes.json().id;

    // Dona Sônia recupera seu próprio recurso
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/operacional/recursos/${recursoAId}`,
      headers: {
        authorization: `Bearer ${tokenSoniaA}`
      }
    });

    expect(getRes.statusCode).toBe(200);
    const body = getRes.json();
    expect(body.id).toBe(recursoAId);
    expect(body.operacao_id).toBe(operacaoAId);
    expect(body.titulo).toBe('Ficha do Cliente Ana');
    expect(body.descricao).toBe('Dados cadastrais da Ana');
  });

  it('tentativa de acesso cruzado: Operação B não pode obter recurso da Operação A mesmo conhecendo o ID primário (404 Not Found)', async () => {
    // Dona Sônia (Operação A) cria um recurso
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/operacional/recursos',
      headers: {
        authorization: `Bearer ${tokenSoniaA}`
      },
      payload: {
        titulo: 'Ficha Confidencial do Cliente A',
        descricao: 'Dados internos da Operação A'
      }
    });

    expect(createRes.statusCode).toBe(201);
    const recursoAId = createRes.json().id;

    // Operação B tenta acessar diretamente o recursoAId conhecido
    const crossAccessRes = await app.inject({
      method: 'GET',
      url: `/api/operacional/recursos/${recursoAId}`,
      headers: {
        authorization: `Bearer ${tokenOutroB}`
      }
    });

    // Deve retornar 404 Not Found com RFC 7807 e NUNCA expor os dados da Operação A
    expect(crossAccessRes.statusCode).toBe(404);
    expect(crossAccessRes.headers['content-type']).toContain('application/problem+json');
    const errorBody = crossAccessRes.json();
    expect(errorBody.code).toBe('NOT_FOUND');
    expect(errorBody.title).toBe('Recurso Não Encontrado');
    expect(errorBody.titulo).toBeUndefined();
    expect(errorBody.descricao).toBeUndefined();
  });

  it('TenantPrismaClient injeta operacao_id compulsoriamente e impede bypass no nível do repositório', async () => {
    const tenantAPrisma = createTenantPrisma(prisma, operacaoAId);
    const tenantBPrisma = createTenantPrisma(prisma, operacaoBId);

    // Tenant A cria um recurso diretamente pelo tenantPrisma
    const recA = await tenantAPrisma.recursoExemplo.create({
      data: {
        id: gerarUuidV7(),
        titulo: 'Catálogo Exclusivo A',
        descricao: 'Segredo de A'
      } as any // sem passar operacao_id explicitamente!
    });

    expect(recA.operacao_id).toBe(operacaoAId);

    // Tenant B tenta buscar o ID de A usando findUnique
    const tentativaVazamento = await tenantBPrisma.recursoExemplo.findUnique({
      where: { id: recA.id }
    });

    // Deve retornar null devido à barreira do tenantPrisma
    expect(tentativaVazamento).toBeNull();

    // Tenant B tenta buscar o ID de A usando findUniqueOrThrow
    await expect(
      tenantBPrisma.recursoExemplo.findUniqueOrThrow({
        where: { id: recA.id }
      })
    ).rejects.toThrow();

    // Tenant B tenta atualizar o recurso de A
    await expect(
      tenantBPrisma.recursoExemplo.update({
        where: { id: recA.id },
        data: { titulo: 'Tentativa de Hijack' }
      })
    ).rejects.toThrow(`não pertence à operação '${operacaoBId}'`);

    // Tenant A tenta reatribuir o recurso para o tenant B através de update (deve ser forçado para operacaoAId)
    const atualizado = await tenantAPrisma.recursoExemplo.update({
      where: { id: recA.id },
      data: {
        titulo: 'Título Atualizado A',
        operacao_id: operacaoBId // tentativa de transferir para tenant B
      } as any
    });
    expect(atualizado.operacao_id).toBe(operacaoAId); // mantido estritamente em A

    // Tenant A não pode modificar Operação B diretamente
    await expect(
      tenantAPrisma.operacao.update({
        where: { id: operacaoBId },
        data: { nome: 'Operação B Infiltrada' }
      })
    ).rejects.toThrow(`Não é permitido modificar uma operação diferente`);
  });

  it('onDelete: Restrict em Operador com registros de auditoria impede deleção do operador', async () => {
    // Tenta deletar operador que possui registros de auditoria associados
    await expect(
      prisma.operador.delete({
        where: { id: operadorSoniaId }
      })
    ).rejects.toThrow();
  });
});
