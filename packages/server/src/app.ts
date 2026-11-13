import fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import { PrismaClient } from '@prisma/client';
import { createProblemDetails, DomainError } from '@consultorasync/core';
import { sessionPlugin } from './plugins/session.js';
import { origensPermitidas, segredoSessao } from './config.js';
import { authRoutes } from './routes/auth.js';
import { operacionalRoutes } from './routes/operacional.js';
import { clientesRoutes } from './routes/clientes.js';
import { marcasRoutes } from './routes/marcas.js';
import { produtosRoutes } from './routes/produtos.js';
import { estoqueRoutes } from './routes/estoque.js';
import { pareamentoRoutes } from './routes/pareamento.js';
import { encomendasRoutes } from './routes/encomendas.js';
import { comprasRoutes } from './routes/compras.js';
import { vendasRoutes } from './routes/vendas.js';
import { contasRoutes } from './routes/contas.js';
import { catalogoRoutes } from './routes/catalogo.js';
import { cobrancaRoutes } from './routes/cobranca.js';
import { exportacaoRoutes } from './routes/exportacao.js';

export interface BuildAppOptions {
  prisma?: PrismaClient;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  // Falha na largada se o segredo de sessão não estiver configurado fora do desenvolvimento.
  segredoSessao();

  const app = fastify({
    logger: process.env.NODE_ENV === 'test' ? false : true
  });

  const prisma = options.prisma ?? new PrismaClient();
  app.decorate('prisma', prisma);

  // CORS
  app.register(cors, {
    origin: origensPermitidas(),
    credentials: true
  });

  // WebSocket Hub
  app.register(fastifyWebsocket);

  // Session Plugin
  app.register(sessionPlugin);

  // Routes
  app.register(authRoutes);
  app.register(operacionalRoutes);
  app.register(clientesRoutes);
  app.register(marcasRoutes);
  app.register(produtosRoutes);
  app.register(estoqueRoutes);
  app.register(pareamentoRoutes);
  app.register(encomendasRoutes);
  app.register(comprasRoutes);
  app.register(vendasRoutes);
  app.register(contasRoutes);
  app.register(catalogoRoutes);
  app.register(cobrancaRoutes);
  app.register(exportacaoRoutes);

  // Global Error Handler conforme RFC 7807
  app.setErrorHandler((error: FastifyError | Error, request, reply) => {
    reply.type('application/problem+json');

    if (error instanceof DomainError) {
      return reply.status(error.problem.status).send(error.problem);
    }

    const fastifyError = error as FastifyError;
    if (fastifyError.statusCode) {
      return reply.status(fastifyError.statusCode).send(
        createProblemDetails(
          fastifyError.statusCode,
          fastifyError.code || 'HTTP_ERROR',
          fastifyError.name || 'Erro HTTP',
          fastifyError.message
        )
      );
    }

    // Erros não tratados
    console.error('SERVER CAUGHT ERROR:', error);
    return reply.status(500).send(
      createProblemDetails(
        500,
        'INTERNAL_SERVER_ERROR',
        'Erro Interno do Servidor',
        'Ocorreu um erro inesperado durante a execução da operação.'
      )
    );
  });

  return app;
}
