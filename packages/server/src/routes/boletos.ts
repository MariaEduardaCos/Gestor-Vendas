import type { FastifyPluginAsync } from 'fastify';
import { gerarUuidV7, createProblemDetails } from '@consultorasync/core';

interface BoletoBody {
  descricao?: string;
  valor_centavos?: number;
  vencimento?: string;
  linha_digitavel?: string | null;
  marca_id?: string | null;
  compra_id?: string | null;
}

/** Linha digitável (47 ou 48 dígitos) ou código de barras do boleto (44). Aceita com pontos e espaços. */
function limparLinhaDigitavel(valor: unknown): string | null | 'INVALIDA' {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const digitos = String(valor).replace(/[\s.\-]/g, '');
  if (!/^\d+$/.test(digitos) || ![44, 47, 48].includes(digitos.length)) return 'INVALIDA';
  return digitos;
}

function lerVencimento(valor: unknown): Date | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(valor)) return null;
  // Meio-dia UTC: a data não muda de dia em nenhum fuso do Brasil.
  const d = new Date(`${valor.slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const invalido = (detalhe: string) => createProblemDetails(400, 'BAD_REQUEST', 'Dados Inválidos', detalhe);
const naoEncontrado = () =>
  createProblemDetails(404, 'NOT_FOUND', 'Boleto Não Encontrado', 'O boleto não existe ou não pertence a esta operação.');

export const boletosRoutes: FastifyPluginAsync = async (fastify) => {
  const formatar = (b: any, hoje: string) => {
    const vencimento = b.vencimento.toISOString().slice(0, 10);
    return {
      id: b.id,
      descricao: b.descricao,
      valor_centavos: b.valor_centavos,
      vencimento,
      linha_digitavel: b.linha_digitavel,
      status: b.status,
      vencido: b.status === 'ABERTO' && vencimento < hoje,
      pago_em: b.pago_em?.toISOString() ?? null,
      marca_id: b.marca_id,
      marca_nome: b.marca?.nome ?? null,
      compra_id: b.compra_id,
      compra_numero_pedido: b.compra?.numero_pedido ?? null,
      criado_em: b.criado_em.toISOString()
    };
  };
  const hojeLocal = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10); // horário de Brasília
  const incluir = { marca: true, compra: true } as const;

  async function validar(request: any, body: BoletoBody, parcial: boolean) {
    const dados: Record<string, unknown> = {};
    if (!parcial || body.descricao !== undefined) {
      const descricao = String(body.descricao ?? '').trim();
      if (descricao.length < 2 || descricao.length > 120) return { erro: 'Informe uma descrição de 2 a 120 letras.' };
      dados.descricao = descricao;
    }
    if (!parcial || body.valor_centavos !== undefined) {
      const v = body.valor_centavos;
      if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0 || v > 100_000_000) return { erro: 'Informe o valor do boleto.' };
      dados.valor_centavos = v;
    }
    if (!parcial || body.vencimento !== undefined) {
      const d = lerVencimento(body.vencimento);
      if (!d) return { erro: 'Informe a data de vencimento.' };
      dados.vencimento = d;
    }
    if (body.linha_digitavel !== undefined) {
      const linha = limparLinhaDigitavel(body.linha_digitavel);
      if (linha === 'INVALIDA') return { erro: 'A linha digitável deve ter 47 ou 48 números (ou 44 do código de barras).' };
      dados.linha_digitavel = linha;
    }
    if (body.compra_id !== undefined) {
      if (body.compra_id) {
        const compra = await request.tenantPrisma.compraMarca.findUnique({ where: { id: String(body.compra_id) } });
        if (!compra) return { erro: 'O pedido informado não foi encontrado.' };
        dados.compra_id = compra.id;
        if (!body.marca_id) dados.marca_id = compra.marca_id;
      } else dados.compra_id = null;
    }
    if (body.marca_id !== undefined) {
      if (body.marca_id) {
        const marca = await request.tenantPrisma.marca.findUnique({ where: { id: String(body.marca_id) } });
        if (!marca) return { erro: 'A marca informada não foi encontrada.' };
        dados.marca_id = marca.id;
      } else if (!dados.marca_id) dados.marca_id = null;
    }
    return { dados };
  }

  // GET /api/boletos - Boletos da operação, com totais em aberto e vencidos
  fastify.get('/api/boletos', { preHandler: fastify.requireSession }, async (request, reply) => {
    const hoje = hojeLocal();
    const boletos = await request.tenantPrisma.boleto.findMany({ include: incluir, orderBy: [{ status: 'asc' }, { vencimento: 'asc' }] });
    const lista = boletos.map((b) => formatar(b, hoje));
    const abertos = lista.filter((b) => b.status === 'ABERTO');
    return reply.send({
      boletos: lista,
      total_aberto_centavos: abertos.reduce((t, b) => t + b.valor_centavos, 0),
      total_vencido_centavos: abertos.filter((b) => b.vencido).reduce((t, b) => t + b.valor_centavos, 0),
      total_pago_centavos: lista.filter((b) => b.status === 'PAGO').reduce((t, b) => t + b.valor_centavos, 0)
    });
  });

  // POST /api/boletos - Adicionar boleto
  fastify.post<{ Body: BoletoBody }>('/api/boletos', { preHandler: fastify.requireSession }, async (request, reply) => {
    const session = request.session!;
    const v = await validar(request, request.body || {}, false);
    if (v.erro) return reply.status(400).type('application/problem+json').send(invalido(v.erro));
    const boleto = await request.tenantPrisma.boleto.create({
      data: { id: gerarUuidV7(), operacao_id: session.operacaoId, ...(v.dados as any) },
      include: incluir
    });
    await request.tenantPrisma.registroAuditoria.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: session.operacaoId,
        operador_id: session.operadorId,
        operador_nome: session.operadorNome,
        acao: 'ADICIONAR_BOLETO',
        detalhes: `Boleto "${boleto.descricao}" de ${boleto.valor_centavos} centavos, vence em ${boleto.vencimento.toISOString().slice(0, 10)} (ID: ${boleto.id})`,
        criado_em: new Date()
      }
    });
    return reply.status(201).send(formatar(boleto, hojeLocal()));
  });

  // PUT /api/boletos/:id - Corrigir dados do boleto
  fastify.put<{ Params: { id: string }; Body: BoletoBody }>('/api/boletos/:id', { preHandler: fastify.requireSession }, async (request, reply) => {
    const existente = await request.tenantPrisma.boleto.findUnique({ where: { id: request.params.id } });
    if (!existente) return reply.status(404).type('application/problem+json').send(naoEncontrado());
    const v = await validar(request, request.body || {}, true);
    if (v.erro) return reply.status(400).type('application/problem+json').send(invalido(v.erro));
    const boleto = await request.tenantPrisma.boleto.update({ where: { id: existente.id }, data: v.dados as any, include: incluir });
    return reply.send(formatar(boleto, hojeLocal()));
  });

  // POST /api/boletos/:id/pagar e /reabrir - Marcar como pago ou desfazer
  for (const [acao, status] of [['pagar', 'PAGO'], ['reabrir', 'ABERTO']] as const) {
    fastify.post<{ Params: { id: string } }>(`/api/boletos/:id/${acao}`, { preHandler: fastify.requireSession }, async (request, reply) => {
      const session = request.session!;
      const existente = await request.tenantPrisma.boleto.findUnique({ where: { id: request.params.id } });
      if (!existente) return reply.status(404).type('application/problem+json').send(naoEncontrado());
      const boleto = await request.tenantPrisma.boleto.update({
        where: { id: existente.id },
        data: { status, pago_em: status === 'PAGO' ? new Date() : null },
        include: incluir
      });
      await request.tenantPrisma.registroAuditoria.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: session.operacaoId,
          operador_id: session.operadorId,
          operador_nome: session.operadorNome,
          acao: status === 'PAGO' ? 'PAGAR_BOLETO' : 'REABRIR_BOLETO',
          detalhes: `Boleto "${boleto.descricao}" (ID: ${boleto.id})`,
          criado_em: new Date()
        }
      });
      return reply.send(formatar(boleto, hojeLocal()));
    });
  }

  // DELETE /api/boletos/:id - Excluir boleto lançado por engano
  fastify.delete<{ Params: { id: string } }>('/api/boletos/:id', { preHandler: fastify.requireSession }, async (request, reply) => {
    const session = request.session!;
    const existente = await request.tenantPrisma.boleto.findUnique({ where: { id: request.params.id } });
    if (!existente) return reply.status(404).type('application/problem+json').send(naoEncontrado());
    await request.tenantPrisma.boleto.delete({ where: { id: existente.id } });
    await request.tenantPrisma.registroAuditoria.create({
      data: {
        id: gerarUuidV7(),
        operacao_id: session.operacaoId,
        operador_id: session.operadorId,
        operador_nome: session.operadorNome,
        acao: 'EXCLUIR_BOLETO',
        detalhes: `Boleto "${existente.descricao}" de ${existente.valor_centavos} centavos (ID: ${existente.id})`,
        criado_em: new Date()
      }
    });
    return reply.send({ id: existente.id, sucesso: true });
  });
};
