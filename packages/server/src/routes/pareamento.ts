import type { FastifyPluginAsync } from 'fastify';
import { createProblemDetails, type TipoPontaPareamento } from '@consultorasync/core';
import { pareamentoHub } from '../infrastructure/pareamentoHub.js';

interface CriarPareamentoBody {
  ttlMs?: number;
}

interface RenovarPareamentoBody {
  token?: string;
  ttlMs?: number;
}

interface PareamentoParams {
  token: string;
}

interface PareamentoWsQuery {
  ponta?: string;
}

export const pareamentoRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/pareamento/criar
   * Solicita uma sessão efêmera de pareamento (TTL de 10 minutos)
   * Requer sessão operacional ativa no computador (AD-6).
   */
  fastify.post<{ Body?: CriarPareamentoBody }>(
    '/api/pareamento/criar',
    {
      preHandler: fastify.requireSession
    },
    async (request, reply) => {
      const session = request.session!;
      const ttlMs = request.body?.ttlMs;

      const sessaoDto = pareamentoHub.criarSessao(
        session.operacaoId,
        session.operadorId,
        session.operadorNome,
        ttlMs
      );

      // Constrói URL de pareamento para exibição no QR Code usando origin/referer ou host
      let baseOrigin = process.env.APP_BASE_URL;
      if (!baseOrigin) {
        if (request.headers.origin) {
          baseOrigin = request.headers.origin;
        } else if (request.headers.referer) {
          try {
            baseOrigin = new URL(request.headers.referer).origin;
          } catch {}
        }
      }
      if (!baseOrigin) {
        const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost:5173';
        const proto = request.headers['x-forwarded-proto'] || (request.protocol ?? 'http');
        baseOrigin = `${proto}://${host}`;
      }
      const urlPareamento = `${baseOrigin}/?leitor_token=${encodeURIComponent(sessaoDto.token)}`;

      return reply.status(201).send({
        ...sessaoDto,
        urlPareamento
      });
    }
  );

  /**
   * POST /api/pareamento/renovar
   * Renova uma sessão de pareamento em 1 toque (AD-6).
   * Requer sessão operacional ativa no computador.
   */
  fastify.post<{ Body?: RenovarPareamentoBody }>(
    '/api/pareamento/renovar',
    {
      preHandler: fastify.requireSession
    },
    async (request, reply) => {
      const session = request.session!;
      const token = request.body?.token || '';
      const ttlMs = request.body?.ttlMs;

      const sessaoDto = pareamentoHub.renovarSessao(
        token,
        session.operacaoId,
        session.operadorId,
        session.operadorNome,
        ttlMs
      );

      let baseOrigin = process.env.APP_BASE_URL;
      if (!baseOrigin) {
        if (request.headers.origin) {
          baseOrigin = request.headers.origin;
        } else if (request.headers.referer) {
          try {
            baseOrigin = new URL(request.headers.referer).origin;
          } catch {}
        }
      }
      if (!baseOrigin) {
        const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost:5173';
        const proto = request.headers['x-forwarded-proto'] || (request.protocol ?? 'http');
        baseOrigin = `${proto}://${host}`;
      }
      const urlPareamento = `${baseOrigin}/?leitor_token=${encodeURIComponent(sessaoDto.token)}`;

      return reply.status(200).send({
        ...sessaoDto,
        urlPareamento
      });
    }
  );

  /**
   * GET /api/pareamento/:token
   * Consulta pública e restrita de status do token (usada pelo celular ou computador sem expor dados).
   * Nunca exige login e nunca retorna clientes ou dados contábeis (AD-6).
   */
  fastify.get<{ Params: PareamentoParams }>(
    '/api/pareamento/:token',
    async (request, reply) => {
      const { token } = request.params;
      const sessao = pareamentoHub.obterSessao(token);

      if (!sessao) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Sessão Não Encontrada',
            'A sessão de pareamento não existe ou foi expirada após 10 minutos.'
          )
        );
      }

      // Retorna apenas dados de telemetria sem dados de clientes ou contas
      return reply.status(200).send({
        token: sessao.token,
        status: sessao.status,
        expiraEm: sessao.expiraEm,
        tempoRestanteMs: sessao.tempoRestanteMs,
        celularConectado: sessao.celularConectado
      });
    }
  );

  /**
   * GET /ws/pareamento/:token
   * Canal WebSocket para conexão em tempo real entre celular e computador.
   * Não exige login de operador no celular (AD-6).
   */
  fastify.get<{ Params: PareamentoParams; Querystring: PareamentoWsQuery }>(
    '/ws/pareamento/:token',
    { websocket: true },
    (socket, request) => {
      const { token } = request.params;
      const pontaParam = (request.query?.ponta || '').toLowerCase();
      const tipoPonta: TipoPontaPareamento = pontaParam === 'desktop' ? 'DESKTOP' : 'MOBILE';

      pareamentoHub.conectarSocket(token, socket, tipoPonta);
    }
  );
};
