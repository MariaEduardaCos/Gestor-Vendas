import crypto from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { SessaoOperacional, createProblemDetails } from '@consultorasync/core';
import { createTenantPrisma, type TenantPrismaClient } from '../db/tenant-prisma.js';
import type { PrismaClient } from '@prisma/client';

export interface SessionPayload {
  operacao_id: string;
  operador_id: string;
  operador_nome: string;
  iat: number;
  exp: number;
}

const DEFAULT_SECRET = process.env.SESSION_SECRET || 'consultorasync-dev-session-secret-key-32b';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export function createSessionToken(
  data: { operacao_id: string; operador_id: string; operador_nome: string },
  secret = DEFAULT_SECRET
): string {
  const payload: SessionPayload = {
    operacao_id: data.operacao_id,
    operador_id: data.operador_id,
    operador_nome: data.operador_nome,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifySessionToken(token: string, secret = DEFAULT_SECRET): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    requireSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    session: SessaoOperacional | null;
    tenantPrisma: TenantPrismaClient;
  }
}

const sessionPluginCallback: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('session', null);
  fastify.decorateRequest('tenantPrisma', null as any);

  const requireSession = async (request: FastifyRequest, reply: FastifyReply) => {
    let token: string | undefined;

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (typeof request.headers['x-session-token'] === 'string') {
      token = request.headers['x-session-token'].trim();
    } else if (typeof request.headers.cookie === 'string') {
      const cookies = request.headers.cookie.split(';');
      for (const cookie of cookies) {
        const [k, v] = cookie.trim().split('=');
        if ((k === 'session_token' || k === 'token') && v) {
          token = decodeURIComponent(v);
          break;
        }
      }
    }

    if (!token) {
      return reply.status(401).type('application/problem+json').send(
        createProblemDetails(401, 'UNAUTHORIZED', 'Não Autorizado', 'Sessão operacional ausente ou inválida.')
      );
    }

    const payload = verifySessionToken(token);
    if (!payload) {
      return reply.status(401).type('application/problem+json').send(
        createProblemDetails(401, 'UNAUTHORIZED', 'Não Autorizado', 'Sessão operacional expirada ou inválida.')
      );
    }

    // O token é assinado e não guarda estado: confirma que a pessoa ainda existe e está ativa
    // naquela operação (ex.: banco recriado, operador desativado), senão a sessão é recusada.
    const operador = await fastify.prisma.operador.findFirst({
      where: { id: payload.operador_id, operacao_id: payload.operacao_id, ativo: true },
      select: { id: true }
    });
    if (!operador) {
      return reply.status(401).type('application/problem+json').send(
        createProblemDetails(401, 'UNAUTHORIZED', 'Não Autorizado', 'Sessão encerrada. Entre novamente.')
      );
    }

    request.session = new SessaoOperacional({
      operacaoId: payload.operacao_id,
      operadorId: payload.operador_id,
      operadorNome: payload.operador_nome
    });

    request.tenantPrisma = createTenantPrisma(fastify.prisma, payload.operacao_id);
  };

  fastify.decorate('requireSession', requireSession);
};

export const sessionPlugin = fp(sessionPluginCallback, {
  name: 'session-plugin',
  fastify: '5.x'
});
