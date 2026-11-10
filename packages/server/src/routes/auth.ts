import crypto from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { createProblemDetails } from '@consultorasync/core';
import { createSessionToken } from '../plugins/session.js';

interface LoginBody {
  operacao_id: string;
  operador_id: string;
  pin?: string;
}

export function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: LoginBody }>('/api/auth/login', async (request, reply) => {
    const { operacao_id, operador_id, pin } = request.body || {};

    if (!operacao_id || !operador_id) {
      return reply.status(400).type('application/problem+json').send(
        createProblemDetails(
          400,
          'BAD_REQUEST',
          'Requisição Inválida',
          'Os campos operacao_id e operador_id são obrigatórios.'
        )
      );
    }

    // Busca a operação
    const operacao = await fastify.prisma.operacao.findUnique({
      where: { id: operacao_id }
    });

    if (!operacao) {
      return reply.status(401).type('application/problem+json').send(
        createProblemDetails(
          401,
          'UNAUTHORIZED',
          'Credenciais Inválidas',
          'Operação não encontrada ou credenciais inválidas.'
        )
      );
    }

    // Busca o operador pertencente a essa operacao_id
    const operador = await fastify.prisma.operador.findFirst({
      where: {
        id: operador_id,
        operacao_id: operacao_id,
        ativo: true
      }
    });

    if (!operador) {
      return reply.status(401).type('application/problem+json').send(
        createProblemDetails(
          401,
          'UNAUTHORIZED',
          'Credenciais Inválidas',
          'Operador não encontrado, inativo ou não pertence a esta operação.'
        )
      );
    }

    // Validação de PIN seguro se configurado
    if (operador.pin_hash) {
      if (!pin) {
        return reply.status(401).type('application/problem+json').send(
          createProblemDetails(
            401,
            'UNAUTHORIZED',
            'PIN Inválido',
            'O PIN de acesso do operador é obrigatório.'
          )
        );
      }

      const inputHash = hashPin(pin);
      const isExpectedHex = operador.pin_hash.length === 64;
      const expectedBuffer = isExpectedHex
        ? Buffer.from(operador.pin_hash, 'hex')
        : Buffer.from(hashPin(operador.pin_hash), 'hex');
      const inputBuffer = Buffer.from(inputHash, 'hex');

      if (!crypto.timingSafeEqual(expectedBuffer, inputBuffer)) {
        return reply.status(401).type('application/problem+json').send(
          createProblemDetails(
            401,
            'UNAUTHORIZED',
            'PIN Inválido',
            'O PIN informado para o operador está incorreto.'
          )
        );
      }
    }

    const token = createSessionToken({
      operacao_id: operacao.id,
      operador_id: operador.id,
      operador_nome: operador.nome
    });

    return reply.status(200).send({
      token,
      session: {
        operacao_id: operacao.id,
        operador_id: operador.id,
        operador_nome: operador.nome,
        criado_em: new Date().toISOString()
      }
    });
  });

  fastify.get('/api/auth/session', {
    preHandler: fastify.requireSession
  }, async (request, reply) => {
    const session = request.session!;
    return reply.status(200).send({
      operacao_id: session.operacaoId,
      operador_id: session.operadorId,
      operador_nome: session.operadorNome,
      criada_em: session.criadaEm
    });
  });

  fastify.post('/api/auth/logout', {
    preHandler: fastify.requireSession
  }, async (_request, reply) => {
    return reply.status(200).send({ success: true });
  });
};
