import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { gerarUuidV7 } from '@consultorasync/core';

describe('Story 3.1 & 3.2: Conferência de Caixa da Fábrica, Idempotência e Reserva Física (FR-020, FR-022, AD-3, AD-7)', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });

  const operacaoAId = gerarUuidV7();
  const operacaoBId = gerarUuidV7();
  const operadorSoniaId = gerarUuidV7();
  const operadorBId = gerarUuidV7();

  let tokenSoniaA: string;
  let tokenOutroB: string;

  let marcaNaturaAId: string;
  let clienteAnaAId: string;
  let produtoHidratanteAId: string;
  let produtoBatomAId: string;

  let compraId: string;
  let itemHidratanteClienteId: string;
  let itemBatomProntaEntregaId: string;
  let itemContaAnaId: string;

  beforeAll(async () => {
    await prisma.$connect();

    // Limpeza de tabelas na ordem correta
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

    // Operação A e B
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
      payload: { operacao_id: operacaoBId, operador_id: operadorBId }
    });
    tokenOutroB = loginB.json().token;

    // Marca Natura
    marcaNaturaAId = gerarUuidV7();
    await prisma.marca.create({
      data: {
        id: marcaNaturaAId,
        operacao_id: operacaoAId,
        nome: 'Natura',
        percentual_padrao: 30
      }
    });

    // Cliente Ana
    clienteAnaAId = gerarUuidV7();
    await prisma.cliente.create({
      data: {
        id: clienteAnaAId,
        operacao_id: operacaoAId,
        nome: 'Ana Silva',
        telefone: '11999991111'
      }
    });

    // Produtos
    produtoHidratanteAId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoHidratanteAId,
        operacao_id: operacaoAId,
        marca_id: marcaNaturaAId,
        nome: 'Hidratante Tododia Noz Pecã',
        variante: '400ml',
        codigo_barras: '7891234567890',
        preco_venda_centavos: 6000,
        custo_centavos: 4200,
        proveniencia_custo: 'TABELA_ORIGINAL'
      }
    });

    produtoBatomAId = gerarUuidV7();
    await prisma.produto.create({
      data: {
        id: produtoBatomAId,
        operacao_id: operacaoAId,
        marca_id: marcaNaturaAId,
        nome: 'Batom Una Matte',
        variante: 'Vermelho',
        codigo_barras: '7899876543210',
        preco_venda_centavos: 4000,
        custo_centavos: 2800,
        proveniencia_custo: 'ESTIMADO_PERCENTUAL'
      }
    });

    // Cria Encomenda prévia da Ana para o hidratante
    const encResp = await app.inject({
      method: 'POST',
      url: '/api/encomendas',
      headers: { Authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        cliente_id: clienteAnaAId,
        descricao: 'Encomenda da Ana para conferência',
        itens: [
          {
            produto_id: produtoHidratanteAId,
            quantidade: 1
          }
        ]
      }
    });
    const encData = encResp.json();
    itemContaAnaId = encData.itens[0].id;

    // Cria Compra à Marca contendo 1 Hidratante da Ana e 2 Batons de Pronta-Entrega
    const compraResp = await app.inject({
      method: 'POST',
      url: '/api/compras-marca',
      headers: { Authorization: `Bearer ${tokenSoniaA}` },
      payload: {
        marca_id: marcaNaturaAId,
        numero_pedido: 'PED-CONF-001',
        itens: [
          {
            produto_id: produtoHidratanteAId,
            destinacao: 'CLIENTE',
            cliente_id: clienteAnaAId,
            item_conta_id: itemContaAnaId,
            quantidade: 1
          },
          {
            produto_id: produtoBatomAId,
            destinacao: 'PRONTA_ENTREGA',
            quantidade: 2
          }
        ]
      }
    });
    const compraData = compraResp.json();
    compraId = compraData.id;
    itemHidratanteClienteId = compraData.itens.find((i: any) => i.produto_id === produtoHidratanteAId).id;
    itemBatomProntaEntregaId = compraData.itens.find((i: any) => i.produto_id === produtoBatomAId).id;
  });

  afterAll(async () => {
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
    await prisma.$disconnect();
    await app.close();
  });

  describe('GET /api/compras-marca/:id/conferencia (FR-020, UX-DR2)', () => {
    it('deve retornar os itens esperados da compra prontos para leitura na conferência de caixa', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/compras-marca/${compraId}/conferencia`,
        headers: { Authorization: `Bearer ${tokenSoniaA}` }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.compra_id).toBe(compraId);
      expect(data.marca_nome).toBe('Natura');
      expect(data.status).toBe('PEDIDO_REGISTRADO');
      expect(data.itens.length).toBe(2);

      const itemHidratante = data.itens.find((i: any) => i.produto_id === produtoHidratanteAId);
      expect(itemHidratante).toBeDefined();
      expect(itemHidratante.quantidade_pedida).toBe(1);
      expect(itemHidratante.quantidade_recebida).toBe(0);
      expect(itemHidratante.quantidade_pendente).toBe(1);
      expect(itemHidratante.destinacao).toBe('CLIENTE');
      expect(itemHidratante.cliente_nome).toBe('Ana Silva');

      const itemBatom = data.itens.find((i: any) => i.produto_id === produtoBatomAId);
      expect(itemBatom).toBeDefined();
      expect(itemBatom.quantidade_pedida).toBe(2);
      expect(itemBatom.quantidade_pendente).toBe(2);
      expect(itemBatom.destinacao).toBe('PRONTA_ENTREGA');
    });

    it('deve isolar por tenant (Operação B não pode consultar compra da Operação A)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/compras-marca/${compraId}/conferencia`,
        headers: { Authorization: `Bearer ${tokenOutroB}` }
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe('COMPRA_NAO_ENCONTRADA');
    });
  });

  describe('POST /api/compras-marca/:id/conferencia e Idempotência (AD-3, AD-7, FR-020, FR-022)', () => {
    const chaveIdempotenciaLote1 = 'c0a80101-0000-4000-8000-000000000001';

    it('deve rejeitar conferência sem chave de idempotência (AD-7)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/compras-marca/${compraId}/conferencia`,
        headers: { Authorization: `Bearer ${tokenSoniaA}` },
        payload: {
          itens_conferidos: [
            {
              item_compra_id: itemBatomProntaEntregaId,
              quantidade: 1
            }
          ]
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('IDEMPOTENCY_KEY_OBRIGATORIA');
    });

    it('deve rejeitar quantidade negativa ou zero (FR-020)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/compras-marca/${compraId}/conferencia`,
        headers: {
          Authorization: `Bearer ${tokenSoniaA}`,
          'Idempotency-Key': 'chave-invalida-negativa'
        },
        payload: {
          itens_conferidos: [
            {
              item_compra_id: itemBatomProntaEntregaId,
              quantidade: 0
            }
          ]
        }
      });

      if (response.statusCode !== 400) {
        console.log('CONFERENCIA ERROR BODY:', response.body);
      }
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('QUANTIDADE_INVALIDA');
    });

    it('deve rejeitar quantidade excedente à pendência da compra (FR-020)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/compras-marca/${compraId}/conferencia`,
        headers: {
          Authorization: `Bearer ${tokenSoniaA}`,
          'Idempotency-Key': 'chave-invalida-excedente'
        },
        payload: {
          itens_conferidos: [
            {
              item_compra_id: itemBatomProntaEntregaId,
              quantidade: 5 // pediu apenas 2!
            }
          ]
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('EXCEDENTE_NAO_PERMITIDO');
    });

    it('deve conferir lote com sucesso, satisfazer Presentes = Reservados + ProntaEntrega e criar reserva nominal para cliente (Story 3.1 & 3.2)', async () => {
      // Confere 1 Hidratante da Ana e 1 Batom de Pronta-Entrega (recebimento parcial do pedido)
      const response = await app.inject({
        method: 'POST',
        url: `/api/compras-marca/${compraId}/conferencia`,
        headers: {
          Authorization: `Bearer ${tokenSoniaA}`,
          'Idempotency-Key': chaveIdempotenciaLote1
        },
        payload: {
          itens_conferidos: [
            {
              item_compra_id: itemHidratanteClienteId,
              quantidade: 1
            },
            {
              item_compra_id: itemBatomProntaEntregaId,
              quantidade: 1
            }
          ]
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.compra_id).toBe(compraId);
      expect(data.total_itens_conferidos_neste_lote).toBe(2);
      expect(data.status_compra).toBe('CONFERENCIA_EM_ANDAMENTO'); // Falta ainda 1 batom!

      // 1. Verificação do Estoque Físico e Reserva da Ana (AD-3, FR-022)
      const estoqueHidratante = await prisma.estoqueItem.findUnique({
        where: {
          operacao_id_produto_id: {
            operacao_id: operacaoAId,
            produto_id: produtoHidratanteAId
          }
        }
      });
      expect(estoqueHidratante).toBeDefined();
      expect(estoqueHidratante?.presentes).toBe(1);
      expect(estoqueHidratante?.reservados).toBe(1); // 1 reservado para a Ana!
      expect(estoqueHidratante?.pronta_entrega).toBe(0); // 0 livres para venda avulsa
      expect(estoqueHidratante!.presentes).toBe(
        estoqueHidratante!.reservados + estoqueHidratante!.pronta_entrega
      );

      // Status da encomenda da Ana atualizado para RESERVADO_PRESENTE
      const itemConta = await prisma.itemConta.findUnique({
        where: { id: itemContaAnaId }
      });
      expect(itemConta?.status_entrega).toBe('RESERVADO_PRESENTE');

      // 2. Verificação do Estoque do Batom (Pronta-Entrega)
      const estoqueBatom = await prisma.estoqueItem.findUnique({
        where: {
          operacao_id_produto_id: {
            operacao_id: operacaoAId,
            produto_id: produtoBatomAId
          }
        }
      });
      expect(estoqueBatom).toBeDefined();
      expect(estoqueBatom?.presentes).toBe(1);
      expect(estoqueBatom?.reservados).toBe(0);
      expect(estoqueBatom?.pronta_entrega).toBe(1); // 1 frasco livre na estante!
      expect(estoqueBatom!.presentes).toBe(
        estoqueBatom!.reservados + estoqueBatom!.pronta_entrega
      );

      // 3. Verificação de Auditoria Nominal (NFR-003, AD-1)
      const audit = await prisma.registroAuditoria.findFirst({
        where: {
          operacao_id: operacaoAId,
          acao: 'CONFERIR_COMPRA_MARCA'
        },
        orderBy: { criado_em: 'desc' }
      });
      expect(audit).toBeDefined();
      expect(audit?.operador_nome).toBe('Dona Sônia');
      expect(audit?.detalhes).toContain(chaveIdempotenciaLote1);
    });

    it('deve responder idempotentemente na retransmissao da mesma chave SEM duplicar estoque nem movimentacoes (AD-7, NFR-001)', async () => {
      // Simula retransmissão de rede com a exata mesma chave
      const responseRetry = await app.inject({
        method: 'POST',
        url: `/api/compras-marca/${compraId}/conferencia`,
        headers: {
          Authorization: `Bearer ${tokenSoniaA}`,
          'Idempotency-Key': chaveIdempotenciaLote1
        },
        payload: {
          itens_conferidos: [
            {
              item_compra_id: itemHidratanteClienteId,
              quantidade: 1
            },
            {
              item_compra_id: itemBatomProntaEntregaId,
              quantidade: 1
            }
          ]
        }
      });

      expect(responseRetry.statusCode).toBe(200);
      const data = responseRetry.json();
      expect(data.total_itens_conferidos_neste_lote).toBe(2);

      // O estoque físico NÃO pode ter sido somado uma segunda vez!
      const estoqueHidratante = await prisma.estoqueItem.findUnique({
        where: {
          operacao_id_produto_id: {
            operacao_id: operacaoAId,
            produto_id: produtoHidratanteAId
          }
        }
      });
      expect(estoqueHidratante?.presentes).toBe(1); // Permanece 1, e não 2!
      expect(estoqueHidratante?.reservados).toBe(1);

      const estoqueBatom = await prisma.estoqueItem.findUnique({
        where: {
          operacao_id_produto_id: {
            operacao_id: operacaoAId,
            produto_id: produtoBatomAId
          }
        }
      });
      expect(estoqueBatom?.presentes).toBe(1); // Permanece 1, e não 2!
      expect(estoqueBatom?.pronta_entrega).toBe(1);

      // O número de movimentações de estoque deve ser exatamente 2 (1 para cada produto do primeiro envio)
      const movCount = await prisma.movimentacaoEstoque.count({
        where: {
          operacao_id: operacaoAId,
          compra_id: compraId
        }
      });
      expect(movCount).toBe(2);
    });

    it('deve concluir a conferencia total ao receber a ultima unidade pendente (Story 3.3)', async () => {
      const chaveLote2 = 'c0a80101-0000-4000-8000-000000000002';

      // Confere o 2º batom que estava pendente
      const responseLote2 = await app.inject({
        method: 'POST',
        url: `/api/compras-marca/${compraId}/conferencia`,
        headers: {
          Authorization: `Bearer ${tokenSoniaA}`,
          'Idempotency-Key': chaveLote2
        },
        payload: {
          itens_conferidos: [
            {
              item_compra_id: itemBatomProntaEntregaId,
              quantidade: 1
            }
          ]
        }
      });

      expect(responseLote2.statusCode).toBe(200);
      const data = responseLote2.json();
      expect(data.status_compra).toBe('CONFERIDA');
      expect(data.conferencia_concluida).toBe(true);

      const estoqueBatom = await prisma.estoqueItem.findUnique({
        where: {
          operacao_id_produto_id: {
            operacao_id: operacaoAId,
            produto_id: produtoBatomAId
          }
        }
      });
      expect(estoqueBatom?.presentes).toBe(2);
      expect(estoqueBatom?.pronta_entrega).toBe(2);
      expect(estoqueBatom!.presentes).toBe(
        estoqueBatom!.reservados + estoqueBatom!.pronta_entrega
      );
    });
  });

  describe('Story 3.3: Tratamento de Falta de Fábrica e Emissão de Obrigação Contábil (FR-024, AD-3, AD-5, AD-7)', () => {
    let compraFaltaId: string;
    let itemCompraFaltaProntaEntregaId: string;
    let itemCompraFaltaClienteId: string;
    let clienteBiaId: string;
    let contaBiaId: string;
    let itemContaBiaId: string;

    beforeEach(async () => {
      // 1. Criar Cliente Bia
      const resCli = await app.inject({
        method: 'POST',
        url: '/api/clientes',
        headers: { Authorization: `Bearer ${tokenSoniaA}` },
        payload: {
          nome: 'Bia Santos Encomenda',
          telefone: '(11) 98888-2222'
        }
      });
      clienteBiaId = resCli.json().id;

      // 2. Criar Encomenda para Bia (R$ 80,00 = 8000 centavos)
      const resEnc = await app.inject({
        method: 'POST',
        url: '/api/encomendas',
        headers: { Authorization: `Bearer ${tokenSoniaA}` },
        payload: {
          cliente_id: clienteBiaId,
          itens: [
            {
              produto_id: produtoHidratanteAId,
              quantidade: 1
            }
          ]
        }
      });
      const encData = resEnc.json();
      contaBiaId = encData.conta.id;
      itemContaBiaId = encData.itens[0].id;

      // 3. Simular que a Bia já antecipou o pagamento integral da encomenda (Quitada: total_pago = 8000 centavos)
      await prisma.conta.update({
        where: { id: contaBiaId },
        data: {
          total_pago: 8000,
          status: 'QUITADA'
        }
      });

      // 4. Criar Compra à Marca com o perfume da Bia + 1 batom para pronta-entrega
      const resCompra = await app.inject({
        method: 'POST',
        url: '/api/compras-marca',
        headers: { Authorization: `Bearer ${tokenSoniaA}` },
        payload: {
          marca_id: marcaNaturaAId,
          numero_pedido: 'PED-FALTA-999',
          itens: [
            {
              produto_id: produtoHidratanteAId,
              destinacao: 'CLIENTE',
              quantidade: 1,
              cliente_id: clienteBiaId,
              encomenda_id: encData.id,
              item_conta_id: itemContaBiaId
            },
            {
              produto_id: produtoBatomAId,
              destinacao: 'PRONTA_ENTREGA',
              quantidade: 1
            }
          ]
        }
      });

      const compraData = resCompra.json();
      compraFaltaId = compraData.id;
      itemCompraFaltaClienteId = compraData.itens.find((i: any) => i.destinacao === 'CLIENTE').id;
      itemCompraFaltaProntaEntregaId = compraData.itens.find((i: any) => i.destinacao === 'PRONTA_ENTREGA').id;
    });

    it('deve rejeitar registro de falta sem chave de idempotencia (AD-7)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/compras-marca/${compraFaltaId}/falta-fabrica`,
        headers: { Authorization: `Bearer ${tokenSoniaA}` },
        payload: {
          item_compra_id: itemCompraFaltaClienteId,
          quantidade_em_falta: 1
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('IDEMPOTENCY_KEY_OBRIGATORIA');
    });

    it('deve rejeitar falta com quantidade superior a pendencia do item', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/compras-marca/${compraFaltaId}/falta-fabrica`,
        headers: {
          Authorization: `Bearer ${tokenSoniaA}`,
          'Idempotency-Key': 'f0a80101-0000-4000-8000-000000000001'
        },
        payload: {
          item_compra_id: itemCompraFaltaClienteId,
          quantidade_em_falta: 5 // Item só tem 1 unidade pendente
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('FALTA_EXCEDE_PENDENCIA');
    });

    it('deve cancelar item de cliente em falta sem alterar estoque fisico e emitir obrigacao contabil quando conta ja estiver quitada (FR-024, Refinamento Elicitacao, AD-3, AD-5)', async () => {
      const estoqueHidratanteAntes = await prisma.estoqueItem.findUnique({
        where: {
          operacao_id_produto_id: {
            operacao_id: operacaoAId,
            produto_id: produtoHidratanteAId
          }
        }
      });
      const presentesAntes = estoqueHidratanteAntes?.presentes || 0;
      const reservadosAntes = estoqueHidratanteAntes?.reservados || 0;

      const chaveFalta = 'f0a80101-0000-4000-8000-000000000002';
      const response = await app.inject({
        method: 'POST',
        url: `/api/compras-marca/${compraFaltaId}/falta-fabrica`,
        headers: {
          Authorization: `Bearer ${tokenSoniaA}`,
          'Idempotency-Key': chaveFalta
        },
        payload: {
          item_compra_id: itemCompraFaltaClienteId,
          quantidade_em_falta: 1,
          motivo: 'Produto esgotado no ciclo da fábrica'
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.quantidade_cancelada_falta).toBe(1);
      expect(data.item_compra_id).toBe(itemCompraFaltaClienteId);

      // 1. Estoque físico NÃO deve ter sofrido baixa (pois frasco nunca chegou, AD-3)
      const estoqueHidratanteDepois = await prisma.estoqueItem.findUnique({
        where: {
          operacao_id_produto_id: {
            operacao_id: operacaoAId,
            produto_id: produtoHidratanteAId
          }
        }
      });
      expect(estoqueHidratanteDepois?.presentes || 0).toBe(presentesAntes);
      expect(estoqueHidratanteDepois?.reservados || 0).toBe(reservadosAntes);

      // 2. ItemConta deve estar CANCELADO_FALTA_FABRICA
      const itemContaAtualizado = await prisma.itemConta.findUnique({
        where: { id: itemContaBiaId }
      });
      expect(itemContaAtualizado?.status_entrega).toBe('CANCELADO_FALTA_FABRICA');

      // 3. Conta da cliente deve ter valor_total reduzido para 0 e emitir obrigação contábil de estorno/crédito (AD-5, FR-024)
      const contaAtualizada = await prisma.conta.findUnique({
        where: { id: contaBiaId }
      });
      expect(contaAtualizada?.valor_total).toBe(0); // 8000 - 8000 = 0
      expect(contaAtualizada?.total_pago).toBe(8000); // Permanece o valor pago
      expect(data.obrigacao_contabil).toBeDefined();
      expect(data.obrigacao_contabil.tipo).toBe('ESTORNO_OU_CREDITO_PENDENTE');
      expect(data.obrigacao_contabil.excedente_centavos).toBe(8000);
      expect(data.obrigacao_contabil.cliente_id).toBe(clienteBiaId);

      // 4. Auditoria deve registrar a obrigação contábil
      const auditoria = await prisma.registroAuditoria.findFirst({
        where: {
          operacao_id: operacaoAId,
          acao: 'OBRIGACAO_CONTABIL_EXCEDENTE_FALTA'
        }
      });
      expect(auditoria).toBeDefined();

      // 5. Retransmissão com a mesma chave de idempotência deve retornar 200 idêntico sem duplicar (AD-7)
      const responseRetry = await app.inject({
        method: 'POST',
        url: `/api/compras-marca/${compraFaltaId}/falta-fabrica`,
        headers: {
          Authorization: `Bearer ${tokenSoniaA}`,
          'Idempotency-Key': chaveFalta
        },
        payload: {
          item_compra_id: itemCompraFaltaClienteId,
          quantidade_em_falta: 1
        }
      });
      expect(responseRetry.statusCode).toBe(200);
      expect(responseRetry.json().quantidade_cancelada_falta).toBe(1);

      // 6. Concluir o batom de pronta-entrega para verificar que a compra passa a CONFERIDA
      const chaveConfBatom = 'f0a80101-0000-4000-8000-000000000003';
      const resConfBatom = await app.inject({
        method: 'POST',
        url: `/api/compras-marca/${compraFaltaId}/conferencia`,
        headers: {
          Authorization: `Bearer ${tokenSoniaA}`,
          'Idempotency-Key': chaveConfBatom
        },
        payload: {
          itens_conferidos: [
            {
              item_compra_id: itemCompraFaltaProntaEntregaId,
              quantidade: 1
            }
          ]
        }
      });
      expect(resConfBatom.statusCode).toBe(200);
      expect(resConfBatom.json().status_compra).toBe('CONFERIDA');
      expect(resConfBatom.json().conferencia_concluida).toBe(true);
    });
  });
});
