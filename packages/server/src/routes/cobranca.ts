import type { FastifyPluginAsync } from 'fastify';
import {
  calcularCobranca,
  createProblemDetails,
  gerarUuidV7,
  gerarVencimentosMensais,
  hojeNoFuso,
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
};
