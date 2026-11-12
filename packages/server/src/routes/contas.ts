import { FastifyPluginAsync } from 'fastify';
import {
  createProblemDetails,
  DomainError,
  gerarUuidV7,
  Centavos
} from '@consultorasync/core';
import { calcularStatusEntregaConta } from './vendas.js';

interface RegistrarPagamentoBody {
  valor_centavos: number;
  forma_pagamento: 'DINHEIRO' | 'PIX' | 'CARTAO' | 'CREDITO_CARTEIRA';
  taxa_cartao_centavos?: number;
  data_pagamento?: string;
  idempotency_key?: string;
}

interface EstornoPagamentoBody {
  motivo: string;
}

interface ResolverExcedenteBody {
  acao: 'DEVOLVER_DINHEIRO' | 'CONVERTER_CREDITO';
  motivo?: string;
}

export const contasRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/contas/:id - Detalhes da conta com projeção "Visão Sem Itens Aguardados" (AD-4, UX-DR6)
  fastify.get<{ Params: { id: string } }>(
    '/api/contas/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;

      const conta = await request.tenantPrisma.conta.findUnique({
        where: { id },
        include: {
          cliente: true,
          itens: {
            include: { produto: true }
          },
          pagamentos: {
            orderBy: { criado_em: 'desc' }
          },
          excedentes: {
            orderBy: { criado_em: 'desc' }
          }
        }
      });

      if (!conta) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(404, 'NOT_FOUND', 'Conta Não Encontrada', 'A conta solicitada não foi localizada.')
        );
      }

      const itensAtivos = conta.itens.filter((i: any) => i.status_entrega !== 'CANCELADO');
      const itensSemAguardados = itensAtivos.filter((i: any) => i.status_entrega !== 'AGUARDANDO_FABRICA');
      
      const totalSemAguardados = itensSemAguardados.reduce(
        (acc: number, cur: any) => acc + cur.quantidade * cur.preco_unitario_centavos,
        0
      );

      const saldoDevedorTotal = Math.max(0, conta.valor_total - conta.total_pago);
      const saldoCobravelHoje = Math.max(0, totalSemAguardados - conta.total_pago);

      return reply.status(200).send({
        id: conta.id,
        operacao_id: conta.operacao_id,
        cliente_id: conta.cliente_id,
        cliente_nome: conta.cliente.nome,
        encomenda_id: conta.encomenda_id,
        valor_total: conta.valor_total,
        valor_total_formatado: Centavos.deInteiro(conta.valor_total).paraFormatado(),
        total_pago: conta.total_pago,
        total_pago_formatado: Centavos.deInteiro(conta.total_pago).paraFormatado(),
        saldo_devedor_total: saldoDevedorTotal,
        saldo_devedor_total_formatado: Centavos.deInteiro(saldoDevedorTotal).paraFormatado(),
        total_sem_aguardados: totalSemAguardados,
        total_sem_aguardados_formatado: Centavos.deInteiro(totalSemAguardados).paraFormatado(),
        saldo_cobravel_hoje: saldoCobravelHoje,
        saldo_cobravel_hoje_formatado: Centavos.deInteiro(saldoCobravelHoje).paraFormatado(),
        status: conta.status,
        status_entrega_consolidado: calcularStatusEntregaConta(conta.itens),
        criado_em: conta.criado_em.toISOString(),
        itens: conta.itens.map((i: any) => ({
          id: i.id,
          produto_id: i.produto_id,
          produto_nome: i.produto.nome,
          quantidade: i.quantidade,
          preco_unitario_centavos: i.preco_unitario_centavos,
          preco_unitario_formatado: Centavos.deInteiro(i.preco_unitario_centavos).paraFormatado(),
          subtotal_centavos: i.quantidade * i.preco_unitario_centavos,
          subtotal_formatado: Centavos.deInteiro(i.quantidade * i.preco_unitario_centavos).paraFormatado(),
          status_entrega: i.status_entrega
        })),
        pagamentos: conta.pagamentos.map((p: any) => ({
          id: p.id,
          valor_pago_centavos: p.valor_pago_centavos,
          valor_pago_formatado: Centavos.deInteiro(p.valor_pago_centavos).paraFormatado(),
          taxa_cartao_centavos: p.taxa_cartao_centavos,
          taxa_cartao_formatado: Centavos.deInteiro(p.taxa_cartao_centavos).paraFormatado(),
          valor_liquido_centavos: p.valor_liquido_centavos,
          valor_liquido_formatado: Centavos.deInteiro(p.valor_liquido_centavos).paraFormatado(),
          forma_pagamento: p.forma_pagamento,
          status: p.status,
          motivo_estorno: p.motivo_estorno,
          data_pagamento: p.data_pagamento.toISOString(),
          criado_em: p.criado_em.toISOString(),
          operador_nome: p.operador_nome
        })),
        excedentes: conta.excedentes.map((e: any) => ({
          id: e.id,
          valor_centavos: e.valor_centavos,
          valor_formatado: Centavos.deInteiro(e.valor_centavos).paraFormatado(),
          origem: e.origem,
          status: e.status,
          resolvido_em: e.resolvido_em ? e.resolvido_em.toISOString() : null,
          motivo_resolucao: e.motivo_resolucao,
          criado_em: e.criado_em.toISOString()
        }))
      });
    }
  );

  // POST /api/contas/:id/pagamentos - Registro de pagamento (Pix, Dinheiro, Cartão, Crédito) (FR-034, FR-035, FR-036, AD-7)
  fastify.post<{ Params: { id: string }; Body: RegistrarPagamentoBody }>(
    '/api/contas/:id/pagamentos',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const {
        valor_centavos,
        forma_pagamento,
        taxa_cartao_centavos = 0,
        data_pagamento,
        idempotency_key
      } = request.body || {};

      const session = request.session!;

      // Validação de Idempotência Obrigatória via UUID v4 (AD-7)
      if (idempotency_key) {
        const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidV4Regex.test(idempotency_key)) {
          return reply.status(400).type('application/problem+json').send(
            createProblemDetails(400, 'INVALID_IDEMPOTENCY_KEY', 'Chave de Idempotência Inválida', 'A chave de idempotência deve ser um UUID v4.')
          );
        }

        const registroExistente = await request.tenantPrisma.registroIdempotencia.findUnique({
          where: {
            operacao_id_chave: {
              operacao_id: session.operacaoId,
              chave: idempotency_key
            }
          }
        });

        if (registroExistente) {
          const payload = JSON.parse(registroExistente.resposta_json);
          return reply.status(registroExistente.status_code).send(payload);
        }
      }

      // Validações básicas de negócio (FR-034, FR-035)
      if (!Number.isInteger(valor_centavos) || valor_centavos <= 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'VALOR_INVALIDO', 'Valor de Pagamento Inválido', 'O valor do pagamento deve ser um número inteiro positivo em centavos.')
        );
      }

      if (!['DINHEIRO', 'PIX', 'CARTAO', 'CREDITO_CARTEIRA'].includes(forma_pagamento)) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'FORMA_PAGAMENTO_INVALIDA', 'Forma de Pagamento Inválida', 'Forma deve ser DINHEIRO, PIX, CARTAO ou CREDITO_CARTEIRA.')
        );
      }

      const taxa = Number.isInteger(taxa_cartao_centavos) && taxa_cartao_centavos > 0 ? taxa_cartao_centavos : 0;
      if (taxa >= valor_centavos) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'TAXA_EXCESSIVA', 'Taxa Inválida', 'A taxa de cartão absorvida deve ser estritamente menor que o valor pago.')
        );
      }

      const valorLiquido = valor_centavos - taxa;

      try {
        const resultado = await request.tenantPrisma.$transaction(async (tx: any) => {
          const conta = await tx.conta.findUnique({
            where: { id },
            include: { cliente: true }
          });

          if (!conta) {
            throw new DomainError(
              createProblemDetails(404, 'NOT_FOUND', 'Conta Não Encontrada', 'A conta informada não existe.')
            );
          }

          const saldoDevedor = Math.max(0, conta.valor_total - conta.total_pago);
          if (saldoDevedor <= 0) {
            throw new DomainError(
              createProblemDetails(400, 'CONTA_JA_QUITADA', 'Conta Já Quitada', 'Esta conta já está totalmente quitada.')
            );
          }

          if (valor_centavos > saldoDevedor) {
            throw new DomainError(
              createProblemDetails(
                400,
                'VALOR_EXCEDE_SALDO',
                'Valor Superior ao Saldo',
                `O valor de pagamento (${Centavos.deInteiro(valor_centavos).paraFormatado()}) é superior ao saldo devedor em aberto (${Centavos.deInteiro(saldoDevedor).paraFormatado()}).`
              )
            );
          }

          // Se o pagamento for via Crédito da Carteira, deduz do cliente
          if (forma_pagamento === 'CREDITO_CARTEIRA') {
            if (conta.cliente.saldo_credito_centavos < valor_centavos) {
              throw new DomainError(
                createProblemDetails(
                  400,
                  'SALDO_CREDITO_INSUFICIENTE',
                  'Crédito Insuficiente',
                  `A cliente possui apenas ${Centavos.deInteiro(conta.cliente.saldo_credito_centavos).paraFormatado()} de crédito disponível.`
                )
              );
            }

            await tx.cliente.update({
              where: { id: conta.cliente_id },
              data: {
                saldo_credito_centavos: {
                  decrement: valor_centavos
                }
              }
            });
          }

          const novoTotalPago = conta.total_pago + valor_centavos;
          const novoStatus = novoTotalPago >= conta.valor_total ? 'QUITADA' : 'PARCIALMENTE_PAGA';

          const contaAtualizada = await tx.conta.update({
            where: { id },
            data: {
              total_pago: novoTotalPago,
              status: novoStatus
            }
          });

          const pagamento = await tx.pagamentoConta.create({
            data: {
              id: gerarUuidV7(),
              operacao_id: session.operacaoId,
              conta_id: id,
              valor_pago_centavos: valor_centavos,
              taxa_cartao_centavos: taxa,
              valor_liquido_centavos: valorLiquido,
              forma_pagamento,
              data_pagamento: data_pagamento ? new Date(data_pagamento) : new Date(),
              status: 'CONFIRMADO',
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              criado_em: new Date()
            }
          });

          // Auditoria nominal do pagamento
          await tx.registroAuditoria.create({
            data: {
              id: gerarUuidV7(),
              operacao_id: session.operacaoId,
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              acao: 'REGISTRAR_PAGAMENTO',
              detalhes: JSON.stringify({
                conta_id: id,
                pagamento_id: pagamento.id,
                cliente_id: conta.cliente_id,
                valor_pago_centavos: valor_centavos,
                taxa_cartao_centavos: taxa,
                valor_liquido_centavos: valorLiquido,
                forma_pagamento,
                novo_status_conta: novoStatus
              }),
              criado_em: new Date()
            }
          });

          const resposta = {
            mensagem: 'Pagamento registrado com sucesso!',
            pagamento: {
              id: pagamento.id,
              valor_pago_centavos: pagamento.valor_pago_centavos,
              valor_pago_formatado: Centavos.deInteiro(pagamento.valor_pago_centavos).paraFormatado(),
              taxa_cartao_centavos: pagamento.taxa_cartao_centavos,
              taxa_cartao_formatado: Centavos.deInteiro(pagamento.taxa_cartao_centavos).paraFormatado(),
              valor_liquido_centavos: pagamento.valor_liquido_centavos,
              valor_liquido_formatado: Centavos.deInteiro(pagamento.valor_liquido_centavos).paraFormatado(),
              forma_pagamento: pagamento.forma_pagamento,
              data_pagamento: pagamento.data_pagamento.toISOString()
            },
            conta: {
              id: contaAtualizada.id,
              valor_total: contaAtualizada.valor_total,
              total_pago: contaAtualizada.total_pago,
              saldo_devedor: Math.max(0, contaAtualizada.valor_total - contaAtualizada.total_pago),
              status: contaAtualizada.status
            }
          };

          if (idempotency_key) {
            await tx.registroIdempotencia.create({
              data: {
                id: gerarUuidV7(),
                operacao_id: session.operacaoId,
                chave: idempotency_key,
                recurso: `/api/contas/${id}/pagamentos`,
                status_code: 201,
                resposta_json: JSON.stringify(resposta)
              }
            });
          }

          return resposta;
        });

        return reply.status(201).send(resultado);
      } catch (err: any) {
        if (err instanceof DomainError) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Erro ao Registrar Pagamento', err.message || 'Erro inesperado.')
        );
      }
    }
  );

  // POST /api/pagamentos/:id/estorno - Estorno auditado de pagamento com recálculo de saldo (FR-037, AD-1, NFR-003)
  fastify.post<{ Params: { id: string }; Body: EstornoPagamentoBody }>(
    '/api/pagamentos/:id/estorno',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const { motivo } = request.body || {};

      if (!motivo || motivo.trim().length < 3) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'MOTIVO_OBRIGATORIO', 'Justificativa Obrigatória', 'Informe o motivo do estorno com no mínimo 3 caracteres.')
        );
      }

      const session = request.session!;

      try {
        const resultado = await request.tenantPrisma.$transaction(async (tx: any) => {
          const pagamento = await tx.pagamentoConta.findUnique({
            where: { id },
            include: { conta: true }
          });

          if (!pagamento) {
            throw new DomainError(
              createProblemDetails(404, 'NOT_FOUND', 'Pagamento Não Encontrado', 'O pagamento solicitado não foi localizado.')
            );
          }

          if (pagamento.status === 'ESTORNADO') {
            throw new DomainError(
              createProblemDetails(400, 'PAGAMENTO_JA_ESTORNADO', 'Pagamento Já Estornado', 'Este pagamento já foi estornado anteriormente.')
            );
          }

          // Se foi pago com crédito da carteira, devolve o crédito para o cliente
          if (pagamento.forma_pagamento === 'CREDITO_CARTEIRA') {
            await tx.cliente.update({
              where: { id: pagamento.conta.cliente_id },
              data: {
                saldo_credito_centavos: {
                  increment: pagamento.valor_pago_centavos
                }
              }
            });
          }

          // Marca o pagamento como ESTORNADO mantendo histórico preservado (FR-037)
          const pagamentoAtualizado = await tx.pagamentoConta.update({
            where: { id },
            data: {
              status: 'ESTORNADO',
              motivo_estorno: motivo.trim(),
              estornado_em: new Date(),
              estornado_por: session.operadorNome
            }
          });

          // Recalcula total_pago da conta baseado apenas nos pagamentos CONFIRMADOS
          const pagamentosAtivos = await tx.pagamentoConta.findMany({
            where: {
              conta_id: pagamento.conta_id,
              status: 'CONFIRMADO'
            }
          });

          const novoTotalPago = pagamentosAtivos.reduce(
            (acc: number, cur: any) => acc + cur.valor_pago_centavos,
            0
          );

          const novoStatus =
            novoTotalPago >= pagamento.conta.valor_total
              ? 'QUITADA'
              : novoTotalPago > 0
              ? 'PARCIALMENTE_PAGA'
              : 'ABERTA';

          const contaAtualizada = await tx.conta.update({
            where: { id: pagamento.conta_id },
            data: {
              total_pago: novoTotalPago,
              status: novoStatus
            }
          });

          // Registro de auditoria nominal
          await tx.registroAuditoria.create({
            data: {
              id: gerarUuidV7(),
              operacao_id: session.operacaoId,
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              acao: 'ESTORNAR_PAGAMENTO',
              detalhes: JSON.stringify({
                pagamento_id: id,
                conta_id: pagamento.conta_id,
                valor_estornado: pagamento.valor_pago_centavos,
                motivo: motivo.trim(),
                novo_total_pago_conta: novoTotalPago,
                novo_status_conta: novoStatus
              }),
              criado_em: new Date()
            }
          });

          return {
            mensagem: 'Pagamento estornado com sucesso e saldo reaberto.',
            pagamento: pagamentoAtualizado,
            conta: {
              id: contaAtualizada.id,
              valor_total: contaAtualizada.valor_total,
              total_pago: contaAtualizada.total_pago,
              saldo_devedor: Math.max(0, contaAtualizada.valor_total - contaAtualizada.total_pago),
              status: contaAtualizada.status
            }
          };
        });

        return reply.status(200).send(resultado);
      } catch (err: any) {
        if (err instanceof DomainError) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Erro ao Estornar Pagamento', err.message || 'Erro inesperado.')
        );
      }
    }
  );

  // GET /api/clientes/:id/excedentes - Listagem de excedentes da cliente (FR-038)
  fastify.get<{ Params: { id: string } }>(
    '/api/clientes/:id/excedentes',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;

      const excedentes = await request.tenantPrisma.excedentePendente.findMany({
        where: { cliente_id: id },
        orderBy: { criado_em: 'desc' }
      });

      return reply.status(200).send(
        excedentes.map((e: any) => ({
          id: e.id,
          conta_id: e.conta_id,
          cliente_id: e.cliente_id,
          valor_centavos: e.valor_centavos,
          valor_formatado: Centavos.deInteiro(e.valor_centavos).paraFormatado(),
          origem: e.origem,
          status: e.status,
          resolvido_em: e.resolvido_em ? e.resolvido_em.toISOString() : null,
          motivo_resolucao: e.motivo_resolucao,
          operador_nome: e.operador_nome,
          criado_em: e.criado_em.toISOString()
        }))
      );
    }
  );

  // POST /api/excedentes/:id/resolver - Resolução de excedente: Devolução em Dinheiro/Pix ou Crédito (FR-039, FR-040, AD-5, UX-DR8)
  fastify.post<{ Params: { id: string }; Body: ResolverExcedenteBody }>(
    '/api/excedentes/:id/resolver',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const { acao, motivo } = request.body || {};

      if (!['DEVOLVER_DINHEIRO', 'CONVERTER_CREDITO'].includes(acao)) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'ACAO_INVALIDA', 'Ação Inválida', 'Ação deve ser DEVOLVER_DINHEIRO ou CONVERTER_CREDITO.')
        );
      }

      const session = request.session!;

      try {
        const resultado = await request.tenantPrisma.$transaction(async (tx: any) => {
          const excedente = await tx.excedentePendente.findUnique({
            where: { id },
            include: { cliente: true }
          });

          if (!excedente) {
            throw new DomainError(
              createProblemDetails(404, 'NOT_FOUND', 'Excedente Não Encontrado', 'O excedente solicitado não foi localizado.')
            );
          }

          if (excedente.status !== 'PENDENTE') {
            throw new DomainError(
              createProblemDetails(400, 'EXCEDENTE_JA_RESOLVIDO', 'Excedente Já Resolvido', `Este excedente já foi resolvido como ${excedente.status}.`)
            );
          }

          let novoStatus = 'DEVOLVIDO_DINHEIRO';
          let mensagem = `Devolução de ${Centavos.deInteiro(excedente.valor_centavos).paraFormatado()} em Dinheiro/Pix registrada com sucesso.`;

          if (acao === 'CONVERTER_CREDITO') {
            novoStatus = 'CONVERTIDO_CREDITO';
            mensagem = `Valor de ${Centavos.deInteiro(excedente.valor_centavos).paraFormatado()} adicionado à carteira de crédito da cliente.`;

            // Adiciona crédito na carteira da cliente (FR-040)
            await tx.cliente.update({
              where: { id: excedente.cliente_id },
              data: {
                saldo_credito_centavos: {
                  increment: excedente.valor_centavos
                }
              }
            });
          }

          const excedenteAtualizado = await tx.excedentePendente.update({
            where: { id },
            data: {
              status: novoStatus,
              resolvido_em: new Date(),
              motivo_resolucao: motivo ? motivo.trim() : null
            }
          });

          // Auditoria nominal da resolução do excedente
          await tx.registroAuditoria.create({
            data: {
              id: gerarUuidV7(),
              operacao_id: session.operacaoId,
              operador_id: session.operadorId,
              operador_nome: session.operadorNome,
              acao: acao === 'CONVERTER_CREDITO' ? 'CONVERTER_EXCEDENTE_CREDITO' : 'DEVOLVER_EXCEDENTE_DINHEIRO',
              detalhes: JSON.stringify({
                excedente_id: id,
                cliente_id: excedente.cliente_id,
                valor_centavos: excedente.valor_centavos,
                acao,
                motivo: motivo ? motivo.trim() : null
              }),
              criado_em: new Date()
            }
          });

          return {
            mensagem,
            excedente: excedenteAtualizado
          };
        });

        return reply.status(200).send(resultado);
      } catch (err: any) {
        if (err instanceof DomainError) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Erro ao Resolver Excedente', err.message || 'Erro inesperado.')
        );
      }
    }
  );

  // GET /api/relatorios/resumo-financeiro - Painel consolidado segregado (FR-041, UX-DR9, NFR-010)
  fastify.get(
    '/api/relatorios/resumo-financeiro',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      // 1. Total Vendido: soma de valor_total de todas as contas ativas
      const contas = await request.tenantPrisma.conta.findMany();
      const totalVendidoCentavos = contas.reduce((acc: number, cur: any) => acc + cur.valor_total, 0);

      // 2. Total Efetivamente Recebido: soma de pagamentos confirmados (bruto e líquido)
      const pagamentosConfirmados = await request.tenantPrisma.pagamentoConta.findMany({
        where: { status: 'CONFIRMADO' }
      });
      const totalRecebidoBrutoCentavos = pagamentosConfirmados.reduce((acc: number, cur: any) => acc + cur.valor_pago_centavos, 0);
      const totalTaxasCartaoCentavos = pagamentosConfirmados.reduce((acc: number, cur: any) => acc + cur.taxa_cartao_centavos, 0);
      const totalRecebidoLiquidoCentavos = pagamentosConfirmados.reduce((acc: number, cur: any) => acc + cur.valor_liquido_centavos, 0);

      // 3. Total a Receber (Em Aberto): contas em aberto / pendentes
      const totalAReceberCentavos = contas.reduce(
        (acc: number, cur: any) => acc + Math.max(0, cur.valor_total - cur.total_pago),
        0
      );

      // 4. Total Devolvido a Clientes em Dinheiro / Pix (excedentes resolvidos)
      const excedentesDevolvidos = await request.tenantPrisma.excedentePendente.findMany({
        where: { status: 'DEVOLVIDO_DINHEIRO' }
      });
      const totalDevolvidoCentavos = excedentesDevolvidos.reduce((acc: number, cur: any) => acc + cur.valor_centavos, 0);

      // 5. Créditos Ativos em Carteiras de Clientes
      const clientes = await request.tenantPrisma.cliente.findMany();
      const totalCreditosAtivosCentavos = clientes.reduce((acc: number, cur: any) => acc + cur.saldo_credito_centavos, 0);

      return reply.status(200).send({
        total_vendido_centavos: totalVendidoCentavos,
        total_vendido_formatado: Centavos.deInteiro(totalVendidoCentavos).paraFormatado(),

        total_recebido_bruto_centavos: totalRecebidoBrutoCentavos,
        total_recebido_bruto_formatado: Centavos.deInteiro(totalRecebidoBrutoCentavos).paraFormatado(),

        total_taxas_cartao_centavos: totalTaxasCartaoCentavos,
        total_taxas_cartao_formatado: Centavos.deInteiro(totalTaxasCartaoCentavos).paraFormatado(),

        total_recebido_liquido_centavos: totalRecebidoLiquidoCentavos,
        total_recebido_liquido_formatado: Centavos.deInteiro(totalRecebidoLiquidoCentavos).paraFormatado(),

        total_a_receber_centavos: totalAReceberCentavos,
        total_a_receber_formatado: Centavos.deInteiro(totalAReceberCentavos).paraFormatado(),

        total_devolvido_centavos: totalDevolvidoCentavos,
        total_devolvido_formatado: Centavos.deInteiro(totalDevolvidoCentavos).paraFormatado(),

        total_creditos_ativos_centavos: totalCreditosAtivosCentavos,
        total_creditos_ativos_formatado: Centavos.deInteiro(totalCreditosAtivosCentavos).paraFormatado(),

        // Nota explícita: não calcular prematuramente Lucro Líquido (FR-041)
        observacao_metrica: 'Métricas segregadas de caixa e compromisso comercial conforme diretriz FR-041 e NFR-010.'
      });
    }
  );
};
