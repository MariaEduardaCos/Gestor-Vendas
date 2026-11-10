import type { FastifyPluginAsync } from 'fastify';
import { gerarUuidV7, createProblemDetails } from '@consultorasync/core';

export const operacionalRoutes: FastifyPluginAsync = async (fastify) => {
  // Registra uma transação/ação operacional com auditoria nominal
  fastify.post<{ Body: { acao: string; detalhes?: string } }>(
    '/api/operacional/transacoes',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { acao, detalhes } = request.body || {};
      const session = request.session!;

      if (!acao) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Ação Obrigatória', 'O campo acao é obrigatório.')
        );
      }

      const id = gerarUuidV7();
      const registro = await request.tenantPrisma.registroAuditoria.create({
        data: {
          id,
          operacao_id: session.operacaoId,
          operador_id: session.operadorId,
          operador_nome: session.operadorNome,
          acao,
          detalhes: detalhes ?? null,
          criado_em: new Date()
        }
      });

      return reply.status(201).send({
        id: registro.id,
        operacao_id: registro.operacao_id,
        operador_id: registro.operador_id,
        operador_nome: registro.operador_nome,
        acao: registro.acao,
        detalhes: registro.detalhes,
        criado_em: registro.criado_em.toISOString()
      });
    }
  );

  // Lista registros de auditoria da operação atual
  fastify.get(
    '/api/operacional/auditoria',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const registros = await request.tenantPrisma.registroAuditoria.findMany({
        orderBy: { criado_em: 'desc' }
      });

      return reply.status(200).send(
        registros.map((r) => ({
          ...r,
          criado_em: r.criado_em.toISOString()
        }))
      );
    }
  );

  // Cria um recurso de teste/exemplo da operação
  fastify.post<{ Body: { titulo: string; descricao?: string } }>(
    '/api/operacional/recursos',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { titulo, descricao } = request.body || {};
      const session = request.session!;

      if (!titulo) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Título Obrigatório', 'O campo titulo é obrigatório.')
        );
      }

      const id = gerarUuidV7();
      const recurso = await request.tenantPrisma.recursoExemplo.create({
        data: {
          id,
          operacao_id: session.operacaoId,
          titulo,
          descricao: descricao ?? null,
          criado_em: new Date()
        }
      });

      return reply.status(201).send({
        id: recurso.id,
        operacao_id: recurso.operacao_id,
        titulo: recurso.titulo,
        descricao: recurso.descricao,
        criado_em: recurso.criado_em.toISOString()
      });
    }
  );

  // Consulta um recurso por ID com garantia estrita de isolamento de inquilino
  fastify.get<{ Params: { id: string } }>(
    '/api/operacional/recursos/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;

      const recurso = await request.tenantPrisma.recursoExemplo.findUnique({
        where: { id }
      });

      if (!recurso) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Recurso Não Encontrado',
            'O recurso solicitado não existe ou não pertence a esta operação.'
          )
        );
      }

      return reply.status(200).send({
        id: recurso.id,
        operacao_id: recurso.operacao_id,
        titulo: recurso.titulo,
        descricao: recurso.descricao,
        criado_em: recurso.criado_em.toISOString()
      });
    }
  );
};
