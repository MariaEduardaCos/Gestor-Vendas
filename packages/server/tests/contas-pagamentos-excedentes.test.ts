import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Épico 5: Gestão de Contas, Cobrança Transparente, Pagamentos e Resolução de Excedentes', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let sessionToken: string;
  let operacaoId: string;
  let operadorId: string;

  beforeEach(async () => {
    prisma = new PrismaClient();
    app = buildApp({ prisma });
    await app.ready();

    // Limpar tabelas relevantes
    await prisma.registroIdempotencia.deleteMany({});
    await prisma.pagamentoConta.deleteMany({});
    await prisma.excedentePendente.deleteMany({});
    await prisma.registroAuditoria.deleteMany({});
    await prisma.movimentacaoEstoque.deleteMany({});
    await prisma.estoqueItem.deleteMany({});
    await prisma.itemConta.deleteMany({});
    await prisma.conta.deleteMany({});
    await prisma.encomenda.deleteMany({});
    await prisma.produto.deleteMany({});
    await prisma.cliente.deleteMany({});
    await prisma.operador.deleteMany({});
    await prisma.operacao.deleteMany({});

    operacaoId = gerarUuidV7();
    operadorId = gerarUuidV7();

    await prisma.operacao.create({
      data: {
        id: operacaoId,
        nome: 'Operação Épico 5'
      }
    });

    await prisma.operador.create({
      data: {
        id: operadorId,
        operacao_id: operacaoId,
        nome: 'Dona Sônia',
        ativo: true
      }
    });

    // Login para obter sessionToken
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        operacao_id: operacaoId,
        operador_id: operadorId
      }
    });

    expect(loginRes.statusCode).toBe(200);
    const loginData = JSON.parse(loginRes.body);
    sessionToken = loginData.token;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('Story 5.1: Saldo Individual por Conta e Projeção da "Visão Sem Itens Aguardados" (FR-032, FR-033, AD-4, UX-DR6)', () => {
    it('deve manter saldos e extratos de contas distintas da mesma cliente estritamente isolados (FR-032, AD-4)', async () => {
      const cliente = await prisma.cliente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Juliana Paes'
        }
      });

      // Duas compras independentes: Conta A (R$ 100,00) e Conta B (R$ 80,00)
      const contaA = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 10000,
          total_pago: 2000,
          status: 'PARCIALMENTE_PAGA'
        }
      });

      const contaB = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 8000,
          total_pago: 0,
          status: 'ABERTA'
        }
      });

      const resA = await app.inject({
        method: 'GET',
        url: `/api/contas/${contaA.id}`,
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      expect(resA.statusCode).toBe(200);
      const dataA = JSON.parse(resA.body);
      expect(dataA.valor_total).toBe(10000);
      expect(dataA.total_pago).toBe(2000);
      expect(dataA.saldo_devedor_total).toBe(8000);

      const resB = await app.inject({
        method: 'GET',
        url: `/api/contas/${contaB.id}`,
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      expect(resB.statusCode).toBe(200);
      const dataB = JSON.parse(resB.body);
      expect(dataB.valor_total).toBe(8000);
      expect(dataB.total_pago).toBe(0);
      expect(dataB.saldo_devedor_total).toBe(8000);
    });

    it('deve projetar "Visão Sem Itens Aguardados" considerando apenas itens disponíveis/entregues sem alterar conta no banco (FR-033, AD-4, UX-DR6)', async () => {
      const cliente = await prisma.cliente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Clara Nunes'
        }
      });

      const prodPresente = await prisma.produto.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Batom Matte Vermelho',
          preco_venda_centavos: 6000
        }
      });

      const prodAguardando = await prisma.produto.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Perfume Essencial Oud',
          preco_venda_centavos: 14000
        }
      });

      // Conta com valor total R$ 200,00 (R$ 60,00 presente + R$ 140,00 aguardando)
      const conta = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 20000,
          total_pago: 2000, // Já pagou R$ 20,00
          status: 'PARCIALMENTE_PAGA'
        }
      });

      await prisma.itemConta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          conta_id: conta.id,
          produto_id: prodPresente.id,
          quantidade: 1,
          preco_unitario_centavos: 6000,
          status_entrega: 'RESERVADO_PRESENTE'
        }
      });

      await prisma.itemConta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          conta_id: conta.id,
          produto_id: prodAguardando.id,
          quantidade: 1,
          preco_unitario_centavos: 14000,
          status_entrega: 'AGUARDANDO_FABRICA'
        }
      });

      const res = await app.inject({
        method: 'GET',
        url: `/api/contas/${conta.id}`,
        headers: { Authorization: `Bearer ${sessionToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);

      // Total oficial e saldo total inalterados (FR-032, AD-4)
      expect(data.valor_total).toBe(20000);
      expect(data.total_pago).toBe(2000);
      expect(data.saldo_devedor_total).toBe(18000);

      // Projeção acolhedora apenas do que já chegou (R$ 60,00 - R$ 20,00 = R$ 40,00) (FR-033, UX-DR6)
      expect(data.total_sem_aguardados).toBe(6000);
      expect(data.saldo_cobravel_hoje).toBe(4000);
      expect(data.status_entrega_consolidado).toBe('DISPONIVEL_RETIRADA');
    });
  });

  describe('Story 5.2: Registro de Pagamento em Dinheiro, Pix ou Cartão com Taxa Absorvida (FR-034, FR-035, FR-036, AD-7)', () => {
    it('deve registrar pagamento parcial via Pix e atualizar status da conta para PARCIALMENTE_PAGA (FR-034, FR-036)', async () => {
      const cliente = await prisma.cliente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Mariana Lima'
        }
      });

      const conta = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 10000,
          total_pago: 0,
          status: 'ABERTA'
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/contas/${conta.id}/pagamentos`,
        headers: { Authorization: `Bearer ${sessionToken}` },
        payload: {
          valor_centavos: 4000,
          forma_pagamento: 'PIX'
        }
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.pagamento.valor_pago_centavos).toBe(4000);
      expect(data.pagamento.forma_pagamento).toBe('PIX');
      expect(data.conta.total_pago).toBe(4000);
      expect(data.conta.saldo_devedor).toBe(6000);
      expect(data.conta.status).toBe('PARCIALMENTE_PAGA');
    });

    it('deve registrar pagamento no cartão absorvendo a taxa informada sem penalizar o saldo da cliente (FR-034, FR-035, NFR-010)', async () => {
      const cliente = await prisma.cliente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Renata Sorrah'
        }
      });

      const conta = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 8000,
          total_pago: 0,
          status: 'ABERTA'
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/contas/${conta.id}/pagamentos`,
        headers: { Authorization: `Bearer ${sessionToken}` },
        payload: {
          valor_centavos: 8000,
          forma_pagamento: 'CARTAO',
          taxa_cartao_centavos: 250 // R$ 2,50 de taxa
        }
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      // Saldo da cliente zera e quita integralmente os R$ 80,00
      expect(data.conta.total_pago).toBe(8000);
      expect(data.conta.saldo_devedor).toBe(0);
      expect(data.conta.status).toBe('QUITADA');

      // Pagamento armazena taxa de R$ 2,50 e valor líquido real de R$ 77,50
      expect(data.pagamento.taxa_cartao_centavos).toBe(250);
      expect(data.pagamento.valor_liquido_centavos).toBe(7750);
    });

    it('deve rejeitar pagamento maior que o saldo em aberto da conta (FR-034)', async () => {
      const cliente = await prisma.cliente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Fernanda Montenegro'
        }
      });

      const conta = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 5000,
          total_pago: 2000,
          status: 'PARCIALMENTE_PAGA'
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/contas/${conta.id}/pagamentos`,
        headers: { Authorization: `Bearer ${sessionToken}` },
        payload: {
          valor_centavos: 4000, // Saldo em aberto é apenas R$ 30,00 (3000)
          forma_pagamento: 'DINHEIRO'
        }
      });

      expect(res.statusCode).toBe(400);
      const error = JSON.parse(res.body);
      expect(error.code).toBe('VALOR_EXCEDE_SALDO');
    });

    it('deve assegurar idempotência com UUID v4 evitando pagamentos duplicados por repetição de clique (AD-7, NFR-008)', async () => {
      const cliente = await prisma.cliente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Patrícia Pillar'
        }
      });

      const conta = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 10000,
          total_pago: 0,
          status: 'ABERTA'
        }
      });

      const chaveIdempotencia = '11111111-2222-4333-8444-555555555555';

      const payload = {
        valor_centavos: 5000,
        forma_pagamento: 'PIX',
        idempotency_key: chaveIdempotencia
      };

      const res1 = await app.inject({
        method: 'POST',
        url: `/api/contas/${conta.id}/pagamentos`,
        headers: { Authorization: `Bearer ${sessionToken}` },
        payload
      });
      expect(res1.statusCode).toBe(201);

      // Segunda chamada com mesma chave
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/contas/${conta.id}/pagamentos`,
        headers: { Authorization: `Bearer ${sessionToken}` },
        payload
      });
      expect(res2.statusCode).toBe(201);

      // Banco deve ter exatamente 1 pagamento e saldo de R$ 50,00
      const pagamentos = await prisma.pagamentoConta.findMany({
        where: { conta_id: conta.id }
      });
      expect(pagamentos.length).toBe(1);

      const contaDb = await prisma.conta.findUnique({ where: { id: conta.id } });
      expect(contaDb?.total_pago).toBe(5000);
    });
  });

  describe('Story 5.3: Estorno Auditado de Pagamento com Recalculo de Saldo (FR-037, AD-1, NFR-003)', () => {
    it('deve estornar pagamento existente com justificativa obrigatória, reabrir o saldo da conta e preservar histórico (FR-037)', async () => {
      const cliente = await prisma.cliente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Gloria Pires'
        }
      });

      const conta = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 10000,
          total_pago: 10000,
          status: 'QUITADA'
        }
      });

      const pagamento = await prisma.pagamentoConta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          conta_id: conta.id,
          valor_pago_centavos: 10000,
          valor_liquido_centavos: 10000,
          forma_pagamento: 'PIX',
          status: 'CONFIRMADO',
          operador_id: operadorId,
          operador_nome: 'Dona Sônia'
        }
      });

      // Estorna o pagamento
      const res = await app.inject({
        method: 'POST',
        url: `/api/pagamentos/${pagamento.id}/estorno`,
        headers: { Authorization: `Bearer ${sessionToken}` },
        payload: {
          motivo: 'Cliente fez Pix para chave errada e comprovante foi invalidado.'
        }
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.pagamento.status).toBe('ESTORNADO');
      expect(data.pagamento.motivo_estorno).toContain('chave errada');
      expect(data.conta.total_pago).toBe(0);
      expect(data.conta.saldo_devedor).toBe(10000);
      expect(data.conta.status).toBe('ABERTA');

      // Verifica auditoria nominal gerada
      const auditoria = await prisma.registroAuditoria.findFirst({
        where: { acao: 'ESTORNAR_PAGAMENTO' }
      });
      expect(auditoria).not.toBeNull();
      expect(auditoria?.operador_nome).toBe('Dona Sônia');
    });

    it('deve rejeitar estorno em pagamento já previamente estornado (FR-037)', async () => {
      const cliente = await prisma.cliente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Susana Vieira'
        }
      });

      const conta = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 5000,
          total_pago: 0,
          status: 'ABERTA'
        }
      });

      const pagamento = await prisma.pagamentoConta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          conta_id: conta.id,
          valor_pago_centavos: 5000,
          valor_liquido_centavos: 5000,
          forma_pagamento: 'DINHEIRO',
          status: 'ESTORNADO',
          motivo_estorno: 'Erro de digitação',
          operador_id: operadorId,
          operador_nome: 'Dona Sônia'
        }
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/pagamentos/${pagamento.id}/estorno`,
        headers: { Authorization: `Bearer ${sessionToken}` },
        payload: { motivo: 'Tentando estornar de novo' }
      });

      expect(res.statusCode).toBe(400);
      const error = JSON.parse(res.body);
      expect(error.code).toBe('PAGAMENTO_JA_ESTORNADO');
    });
  });

  describe('Story 5.4: Gestão de Excedente por Cancelamento, Devolução Financeira e Carteira de Crédito (FR-038, FR-039, FR-040, AD-5)', () => {
    it('deve gerar ExcedentePendente ao cancelar item de conta quitada e permitir devolução em dinheiro/Pix (FR-038, FR-039)', async () => {
      const cliente = await prisma.cliente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Debora Falabella'
        }
      });

      const produto = await prisma.produto.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Creme Hidratante Corporal',
          preco_venda_centavos: 3000
        }
      });

      await prisma.estoqueItem.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          produto_id: produto.id,
          presentes: 1,
          reservados: 1,
          pronta_entrega: 0
        }
      });

      // Conta de R$ 100,00 já quitada (total_pago = 10000)
      const conta = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 10000,
          total_pago: 10000,
          status: 'QUITADA'
        }
      });

      const item = await prisma.itemConta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          conta_id: conta.id,
          produto_id: produto.id,
          quantidade: 1,
          preco_unitario_centavos: 3000,
          status_entrega: 'RESERVADO_PRESENTE'
        }
      });

      const produto2 = await prisma.produto.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Perfume Floral',
          preco_venda_centavos: 7000
        }
      });

      await prisma.itemConta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          conta_id: conta.id,
          produto_id: produto2.id,
          quantidade: 1,
          preco_unitario_centavos: 7000,
          status_entrega: 'RESERVADO_PRESENTE'
        }
      });

      // Cancela o item de R$ 30,00 da conta
      const cancelRes = await app.inject({
        method: 'POST',
        url: `/api/contas/${conta.id}/itens/${item.id}/cancelar`,
        headers: { Authorization: `Bearer ${sessionToken}` },
        payload: { motivo: 'Cliente desistiu do creme hidratante.' }
      });
      expect(cancelRes.statusCode).toBe(200);

      // ExcedentePendente de R$ 30,00 (3000 centavos) deve ter sido registrado
      const excedentes = await prisma.excedentePendente.findMany({
        where: { cliente_id: cliente.id }
      });
      expect(excedentes.length).toBe(1);
      expect(excedentes[0].valor_centavos).toBe(3000);
      expect(excedentes[0].status).toBe('PENDENTE');

      // Resolve o excedente com devolução em dinheiro (FR-039)
      const resolveRes = await app.inject({
        method: 'POST',
        url: `/api/excedentes/${excedentes[0].id}/resolver`,
        headers: { Authorization: `Bearer ${sessionToken}` },
        payload: {
          acao: 'DEVOLVER_DINHEIRO',
          motivo: 'Devolvido R$ 30,00 em cédula para a cliente.'
        }
      });

      expect(resolveRes.statusCode).toBe(200);
      const resolveData = JSON.parse(resolveRes.body);
      expect(resolveData.excedente.status).toBe('DEVOLVIDO_DINHEIRO');

      // Carteira de crédito continua zerada pois foi devolvido em espécie
      const clienteDb = await prisma.cliente.findUnique({ where: { id: cliente.id } });
      expect(clienteDb?.saldo_credito_centavos).toBe(0);
    });

    it('deve converter excedente em crédito na carteira da cliente e permitir consumo em nova conta (FR-040, AD-5)', async () => {
      const cliente = await prisma.cliente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Adriana Esteves',
          saldo_credito_centavos: 0
        }
      });

      const contaAntiga = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 5000,
          total_pago: 5000,
          status: 'QUITADA'
        }
      });

      // Cria excedente pendente de R$ 50,00
      const excedente = await prisma.excedentePendente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          conta_id: contaAntiga.id,
          cliente_id: cliente.id,
          valor_centavos: 5000,
          origem: 'FALTA_FABRICA',
          status: 'PENDENTE',
          operador_id: operadorId,
          operador_nome: 'Dona Sônia'
        }
      });

      // Converte em crédito na carteira da cliente (FR-040)
      const convRes = await app.inject({
        method: 'POST',
        url: `/api/excedentes/${excedente.id}/resolver`,
        headers: { Authorization: `Bearer ${sessionToken}` },
        payload: {
          acao: 'CONVERTER_CREDITO',
          motivo: 'Cliente preferiu deixar como crédito para o próximo ciclo.'
        }
      });

      expect(convRes.statusCode).toBe(200);
      const convData = JSON.parse(convRes.body);
      expect(convData.excedente.status).toBe('CONVERTIDO_CREDITO');

      // Verifica saldo na carteira
      let clienteDb = await prisma.cliente.findUnique({ where: { id: cliente.id } });
      expect(clienteDb?.saldo_credito_centavos).toBe(5000);

      // Nova conta de R$ 80,00
      const novaConta = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente.id,
          valor_total: 8000,
          total_pago: 0,
          status: 'ABERTA'
        }
      });

      // Aplica R$ 30,00 de crédito na nova conta
      const pagRes = await app.inject({
        method: 'POST',
        url: `/api/contas/${novaConta.id}/pagamentos`,
        headers: { Authorization: `Bearer ${sessionToken}` },
        payload: {
          valor_centavos: 3000,
          forma_pagamento: 'CREDITO_CARTEIRA'
        }
      });

      expect(pagRes.statusCode).toBe(201);
      const pagData = JSON.parse(pagRes.body);
      expect(pagData.conta.total_pago).toBe(3000);
      expect(pagData.conta.saldo_devedor).toBe(5000);

      // Saldo restante na carteira de crédito: R$ 50,00 - R$ 30,00 = R$ 20,00 (2000 centavos)
      clienteDb = await prisma.cliente.findUnique({ where: { id: cliente.id } });
      expect(clienteDb?.saldo_credito_centavos).toBe(2000);
    });
  });

  describe('Story 5.5: Painel Consolidado de Vendas, Recebimentos e Saldos Segregados (FR-041, UX-DR9, NFR-010)', () => {
    it('deve calcular métricas financeiras consolidadas segregadas sem calcular prematuramente lucro líquido (FR-041, NFR-010)', async () => {
      const cliente1 = await prisma.cliente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          nome: 'Regina Case',
          saldo_credito_centavos: 1500
        }
      });

      // Conta 1: R$ 100,00 (paga R$ 40,00 no Pix)
      const conta1 = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente1.id,
          valor_total: 10000,
          total_pago: 4000,
          status: 'PARCIALMENTE_PAGA'
        }
      });

      await prisma.pagamentoConta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          conta_id: conta1.id,
          valor_pago_centavos: 4000,
          taxa_cartao_centavos: 0,
          valor_liquido_centavos: 4000,
          forma_pagamento: 'PIX',
          status: 'CONFIRMADO',
          operador_id: operadorId,
          operador_nome: 'Dona Sônia'
        }
      });

      // Conta 2: R$ 80,00 (paga R$ 80,00 no Cartão com R$ 2,00 de taxa)
      const conta2 = await prisma.conta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          cliente_id: cliente1.id,
          valor_total: 8000,
          total_pago: 8000,
          status: 'QUITADA'
        }
      });

      await prisma.pagamentoConta.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          conta_id: conta2.id,
          valor_pago_centavos: 8000,
          taxa_cartao_centavos: 200,
          valor_liquido_centavos: 7800,
          forma_pagamento: 'CARTAO',
          status: 'CONFIRMADO',
          operador_id: operadorId,
          operador_nome: 'Dona Sônia'
        }
      });

      // Excedente devolvido: R$ 20,00 em dinheiro
      await prisma.excedentePendente.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: operacaoId,
          conta_id: conta1.id,
          cliente_id: cliente1.id,
          valor_centavos: 2000,
          origem: 'CANCELAMENTO_ITEM',
          status: 'DEVOLVIDO_DINHEIRO',
          operador_id: operadorId,
          operador_nome: 'Dona Sônia'
        }
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/relatorios/resumo-financeiro',
        headers: { Authorization: `Bearer ${sessionToken}` }
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);

      // Total Vendido: 10000 + 8000 = 18000 centavos (R$ 180,00)
      expect(data.total_vendido_centavos).toBe(18000);

      // Total Recebido Bruto: 4000 + 8000 = 12000 centavos (R$ 120,00)
      expect(data.total_recebido_bruto_centavos).toBe(12000);

      // Total Taxas: 200 centavos (R$ 2,00)
      expect(data.total_taxas_cartao_centavos).toBe(200);

      // Total Líquido Recebido: 4000 + 7800 = 11800 centavos (R$ 118,00)
      expect(data.total_recebido_liquido_centavos).toBe(11800);

      // Total a Receber em aberto: (10000 - 4000) + (8000 - 8000) = 6000 centavos (R$ 60,00)
      expect(data.total_a_receber_centavos).toBe(6000);

      // Total Devolvido em Dinheiro/Pix: 2000 centavos (R$ 20,00)
      expect(data.total_devolvido_centavos).toBe(2000);

      // Créditos Ativos em Carteira: 1500 centavos (R$ 15,00)
      expect(data.total_creditos_ativos_centavos).toBe(1500);

      // Garantia de formato em centavos inteiros e sem rótulo prematuro de lucro (FR-041)
      expect(data.observacao_metrica).toContain('FR-041');
    });
  });
});
