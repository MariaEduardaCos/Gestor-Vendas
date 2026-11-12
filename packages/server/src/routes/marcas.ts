import type { FastifyPluginAsync } from 'fastify';
import {
  Marca,
  gerarUuidV7,
  createProblemDetails
} from '@consultorasync/core';

interface MarcaBody {
  nome: string;
  percentual_padrao?: number | null;
}

interface MarcasQuery {
  busca?: string;
  q?: string;
}

export const marcasRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/marcas - Cadastrar nova marca
  fastify.post<{ Body: MarcaBody }>(
    '/api/marcas',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { nome, percentual_padrao } = request.body || {};
      const session = request.session!;

      let marcaDomain: Marca;
      try {
        marcaDomain = new Marca({
          id: gerarUuidV7(),
          operacaoId: session.operacaoId,
          nome,
          percentualPadrao: percentual_padrao
        });
      } catch (err: any) {
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Dados Inválidos', err.message || 'Erro ao validar marca.')
        );
      }

      const marca = await request.tenantPrisma.marca.create({
        data: {
          id: marcaDomain.id,
          operacao_id: session.operacaoId,
          nome: marcaDomain.nome,
          percentual_padrao: marcaDomain.percentualPadrao,
          criado_em: new Date(marcaDomain.criadoEm),
          atualizado_em: new Date(marcaDomain.atualizadoEm)
        }
      });

      // Auditoria nominal com operador e timestamp UTC (NFR-003)
      await request.tenantPrisma.registroAuditoria.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: session.operacaoId,
          operador_id: session.operadorId,
          operador_nome: session.operadorNome,
          acao: 'CADASTRAR_MARCA',
          detalhes: `Cadastro de marca: ${marca.nome} com percentual padrão: ${marca.percentual_padrao ?? 'Nenhum'}% (ID: ${marca.id})`,
          criado_em: new Date()
        }
      });

      return reply.status(201).send({
        id: marca.id,
        operacao_id: marca.operacao_id,
        nome: marca.nome,
        percentual_padrao: marca.percentual_padrao,
        criado_em: marca.criado_em.toISOString(),
        atualizado_em: marca.atualizado_em.toISOString()
      });
    }
  );

  // GET /api/marcas - Listar marcas da operação ativa
  fastify.get<{ Querystring: MarcasQuery }>(
    '/api/marcas',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const termo = (request.query.busca || request.query.q || '').trim();

      const marcas = await request.tenantPrisma.marca.findMany({
        where: termo.length > 0
          ? {
              nome: { contains: termo }
            }
          : {},
        orderBy: { nome: 'asc' },
        include: { _count: { select: { produtos: true } } }
      });

      return reply.status(200).send(
        marcas.map((m) => ({
          id: m.id,
          operacao_id: m.operacao_id,
          nome: m.nome,
          percentual_padrao: m.percentual_padrao,
          catalogo_ciclo: m.catalogo_ciclo,
          catalogo_atualizado_em: m.catalogo_atualizado_em?.toISOString() ?? null,
          quantidade_produtos: m._count.produtos,
          criado_em: m.criado_em.toISOString(),
          atualizado_em: m.atualizado_em.toISOString()
        }))
      );
    }
  );

  // GET /api/marcas/:id - Obter detalhes da marca
  fastify.get<{ Params: { id: string } }>(
    '/api/marcas/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;

      const marca = await request.tenantPrisma.marca.findUnique({
        where: { id }
      });

      if (!marca) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Marca Não Encontrada',
            'A marca solicitada não existe ou não pertence a esta operação.'
          )
        );
      }

      return reply.status(200).send({
        id: marca.id,
        operacao_id: marca.operacao_id,
        nome: marca.nome,
        percentual_padrao: marca.percentual_padrao,
        criado_em: marca.criado_em.toISOString(),
        atualizado_em: marca.atualizado_em.toISOString()
      });
    }
  );

  // PUT /api/marcas/:id - Atualizar marca
  fastify.put<{ Params: { id: string }; Body: MarcaBody }>(
    '/api/marcas/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const { nome, percentual_padrao } = request.body || {};
      const session = request.session!;

      const existente = await request.tenantPrisma.marca.findUnique({
        where: { id }
      });

      if (!existente) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Marca Não Encontrada',
            'A marca solicitada não existe ou não pertence a esta operação.'
          )
        );
      }

      let marcaDomain: Marca;
      try {
        marcaDomain = new Marca({
          id: existente.id,
          operacaoId: existente.operacao_id,
          nome: existente.nome,
          percentualPadrao: existente.percentual_padrao,
          criadoEm: existente.criado_em.toISOString(),
          atualizadoEm: existente.atualizado_em.toISOString()
        });

        marcaDomain.atualizar({
          nome,
          percentualPadrao: percentual_padrao
        });
      } catch (err: any) {
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Dados Inválidos', err.message || 'Erro ao atualizar marca.')
        );
      }

      const atualizada = await request.tenantPrisma.marca.update({
        where: { id },
        data: {
          nome: marcaDomain.nome,
          percentual_padrao: marcaDomain.percentualPadrao,
          atualizado_em: new Date()
        }
      });

      // Auditoria nominal com operador e timestamp UTC
      await request.tenantPrisma.registroAuditoria.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: session.operacaoId,
          operador_id: session.operadorId,
          operador_nome: session.operadorNome,
          acao: 'EDITAR_MARCA',
          detalhes: `Edição de marca: ${atualizada.nome} (ID: ${atualizada.id})`,
          criado_em: new Date()
        }
      });

      return reply.status(200).send({
        id: atualizada.id,
        operacao_id: atualizada.operacao_id,
        nome: atualizada.nome,
        percentual_padrao: atualizada.percentual_padrao,
        criado_em: atualizada.criado_em.toISOString(),
        atualizado_em: atualizada.atualizado_em.toISOString()
      });
    }
  );

  // DELETE /api/marcas/:id - Excluir marca
  fastify.delete<{ Params: { id: string } }>(
    '/api/marcas/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const session = request.session!;

      const existente = await request.tenantPrisma.marca.findUnique({
        where: { id }
      });

      if (!existente) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Marca Não Encontrada',
            'A marca solicitada não existe ou não pertence a esta operação.'
          )
        );
      }

      await request.tenantPrisma.marca.delete({
        where: { id }
      });

      // Auditoria de exclusão
      await request.tenantPrisma.registroAuditoria.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: session.operacaoId,
          operador_id: session.operadorId,
          operador_nome: session.operadorNome,
          acao: 'EXCLUIR_MARCA',
          detalhes: `Exclusão de marca: ${existente.nome} (ID: ${existente.id})`,
          criado_em: new Date()
        }
      });

      return reply.status(200).send({
        id: existente.id,
        sucesso: true,
        mensagem: 'Marca excluída com sucesso.'
      });
    }
  );
};
