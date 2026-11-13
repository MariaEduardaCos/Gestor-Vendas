import type { FastifyPluginAsync } from 'fastify';
import {
  calcularCobranca,
  createProblemDetails,
  gerarUuidV7,
  gerarVencimentosMensais,
  hojeNoFuso,
  montarFilaCobranca,
  normalizarVencimentos
} from '@consultorasync/core';

/** Resumo de cobrança a partir da conta e das datas de vencimento gravadas. */
export function resumoCobrancaDaConta(
  conta: { valor_total: number; total_pago: number },
  parcelas: Array<{ vencimento: string }> = []
) {
  return calcularCobranca(conta, parcelas.map((p) => p.vencimento), hojeNoFuso());
}

/**
 * Aceita a lista de datas ou "primeiro vencimento + número de parcelas mensais".
 * Lista vazia remove os vencimentos (conta sem vencimento nunca fica atrasada).
 */
export function lerVencimentos(body: { vencimentos?: unknown; primeiro_vencimento?: unknown; parcelas?: unknown } | undefined): string[] | undefined {
  if (!body) return undefined;
  if (body.primeiro_vencimento !== undefined && body.primeiro_vencimento !== null && body.primeiro_vencimento !== '') {
    return gerarVencimentosMensais(String(body.primeiro_vencimento), Number(body.parcelas ?? 1));
  }
  if (body.vencimentos === undefined || body.vencimentos === null) return undefined;
  return normalizarVencimentos(body.vencimentos);
}

export const cobrancaRoutes: FastifyPluginAsync = async (fastify) => {
  // PUT /api/contas/:id/vencimentos — define, troca ou remove os vencimentos da conta (FR-036)
  fastify.put<{ Params: { id: string }; Body: { vencimentos?: string[]; primeiro_vencimento?: string; parcelas?: number } }>(
    '/api/contas/:id/vencimentos',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const session = request.session!;
      let vencimentos: string[];
      try {
        vencimentos = lerVencimentos(request.body) ?? [];
      } catch (e) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'VENCIMENTO_INVALIDO', 'Vencimento inválido', (e as Error).message)
        );
      }

      const conta = await request.tenantPrisma.conta.findUnique({ where: { id: request.params.id }, include: { cliente: true } });
      if (!conta) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(404, 'NOT_FOUND', 'Conta Não Encontrada', 'A conta não existe ou não pertence a esta operação.')
        );
      }

      await fastify.prisma.$transaction(async (tx) => {
        await tx.parcelaConta.deleteMany({ where: { conta_id: conta.id, operacao_id: session.operacaoId } });
        for (const [i, vencimento] of vencimentos.entries()) {
          await tx.parcelaConta.create({
            data: { id: gerarUuidV7(), operacao_id: session.operacaoId, conta_id: conta.id, numero: i + 1, vencimento }
          });
        }
        await tx.registroAuditoria.create({
          data: {
            id: gerarUuidV7(),
            operacao_id: session.operacaoId,
            operador_id: session.operadorId,
            operador_nome: session.operadorNome,
            acao: 'DEFINIR_VENCIMENTOS_CONTA',
            detalhes: vencimentos.length
              ? `Conta ${conta.id} de ${conta.cliente.nome}: ${vencimentos.length} vencimento(s) — ${vencimentos.join(', ')}`
              : `Conta ${conta.id} de ${conta.cliente.nome}: vencimentos removidos`,
            criado_em: new Date()
          }
        });
      });

      return reply.status(200).send({
        conta_id: conta.id,
        vencimentos,
        cobranca: resumoCobrancaDaConta(conta, vencimentos.map((vencimento) => ({ vencimento })))
      });
    }
  );

  /**
   * GET /api/cobranca/fila — quem cobrar hoje (uma linha por cliente) e quem já foi cobrada hoje.
   * Janela de lembrete configurável por ?dias=0..15 (padrão 3).
   */
  fastify.get<{ Querystring: { dias?: string } }>('/api/cobranca/fila', { preHandler: fastify.requireSession }, async (request) => {
    const db = request.tenantPrisma;
    const hoje = hojeNoFuso();
    const dias = Math.min(15, Math.max(0, Number.parseInt(request.query.dias ?? '3', 10) || 0));

    const contas = await db.conta.findMany({
      where: { status: { not: 'QUITADA' } },
      select: { id: true, cliente_id: true, valor_total: true, total_pago: true, parcelas: { select: { vencimento: true } } }
    });
    const fila = montarFilaCobranca(
      contas.map((c) => ({ ...c, vencimentos: c.parcelas.map((p) => p.vencimento) })),
      hoje,
      dias
    );

    const clienteIds = fila.map((i) => i.cliente_id);
    const [clientes, contatos] = await Promise.all([
      db.cliente.findMany({ where: { id: { in: clienteIds } }, select: { id: true, nome: true, telefone: true } }),
      db.contatoCobranca.findMany({
        where: { cliente_id: { in: clienteIds } },
        orderBy: { criado_em: 'desc' },
        select: { cliente_id: true, canal: true, criado_em: true }
      })
    ]);
    const clientePorId = new Map(clientes.map((c) => [c.id, c]));
    const ultimoContato = new Map<string, { canal: string; criado_em: Date }>();
    for (const c of contatos) if (!ultimoContato.has(c.cliente_id)) ultimoContato.set(c.cliente_id, c);

    const itens = fila.map((item) => {
      const cliente = clientePorId.get(item.cliente_id)!;
      const contato = ultimoContato.get(item.cliente_id);
      const contatoEm = contato ? hojeNoFuso(undefined, contato.criado_em) : null;
      return {
        ...item,
        cliente: { id: cliente.id, nome: cliente.nome, telefone: cliente.telefone },
        ultimo_contato: contato ? { canal: contato.canal, em: contato.criado_em.toISOString() } : null,
        cobrada_hoje: contatoEm === hoje
      };
    });

    return {
      hoje,
      dias_lembrete: dias,
      pendentes: itens.filter((i) => !i.cobrada_hoje),
      cobradas_hoje: itens.filter((i) => i.cobrada_hoje)
    };
  });

  /** POST /api/cobranca/contatos — registra que a cliente foi cobrada (WhatsApp ou outro meio). */
  fastify.post<{ Body: { cliente_id?: string; canal?: string; motivo?: string; valor_centavos?: number } }>(
    '/api/cobranca/contatos',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const session = request.session!;
      const { cliente_id, canal = 'WHATSAPP', motivo = 'ATRASADA', valor_centavos = 0 } = request.body ?? {};
      if (!['WHATSAPP', 'OUTRO'].includes(canal) || !['ATRASADA', 'VENCE_HOJE', 'VENCE_EM_BREVE'].includes(motivo)) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Dados inválidos', 'Canal ou motivo do contato inválido.')
        );
      }
      const valor = Number.isInteger(valor_centavos) && valor_centavos >= 0 ? valor_centavos : 0;
      const cliente = cliente_id ? await request.tenantPrisma.cliente.findFirst({ where: { id: cliente_id } }) : null;
      if (!cliente) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(404, 'NOT_FOUND', 'Cliente Não Encontrada', 'A cliente não existe ou não pertence a esta operação.')
        );
      }
      const contato = await request.tenantPrisma.contatoCobranca.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: session.operacaoId,
          cliente_id: cliente.id,
          canal,
          motivo,
          valor_centavos: valor,
          operador_id: session.operadorId,
          operador_nome: session.operadorNome
        }
      });
      return reply.status(201).send({ id: contato.id, cliente_id: cliente.id, canal, motivo, criado_em: contato.criado_em.toISOString() });
    }
  );

  /** DELETE /api/cobranca/contatos/hoje/:clienteId — desfaz o "cobrada hoje" (toque errado). */
  fastify.delete<{ Params: { clienteId: string } }>(
    '/api/cobranca/contatos/hoje/:clienteId',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const inicio = new Date(Date.now() - 36 * 60 * 60 * 1000);
      const recentes = await request.tenantPrisma.contatoCobranca.findMany({
        where: { cliente_id: request.params.clienteId, criado_em: { gte: inicio } },
        select: { id: true, criado_em: true }
      });
      const hoje = hojeNoFuso();
      const ids = recentes.filter((c) => hojeNoFuso(undefined, c.criado_em) === hoje).map((c) => c.id);
      if (ids.length) await request.tenantPrisma.contatoCobranca.deleteMany({ where: { id: { in: ids } } });
      return reply.status(200).send({ removidos: ids.length });
    }
  );
};
