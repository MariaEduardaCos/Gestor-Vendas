import fastify, { FastifyInstance, FastifyError } from 'fastify';
import cors from '@fastify/cors';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { boletosRoutes } from './routes/boletos.js';
import type { Buscador } from './services/consulta-online.js';

export interface BuildAppOptions {
  prisma?: PrismaClient;
  /** Como buscar nas fontes da pesquisa online (os testes trocam por respostas simuladas). */
  buscadorOnline?: Buscador;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  // Falha na largada se o segredo de sessão não estiver configurado fora do desenvolvimento.
  segredoSessao();

  const app = fastify({
    logger: process.env.NODE_ENV === 'test' ? false : true
  });

  const prisma = options.prisma ?? new PrismaClient();
  app.decorate('prisma', prisma);
  app.decorate('buscadorOnline', options.buscadorOnline ?? ((url, init) => fetch(url, init)));

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
  app.register(boletosRoutes);

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

  // Em produção o próprio servidor entrega as telas (build do pacote web), num endereço só.
  const pastaWeb = process.env.WEB_DIST || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  if (process.env.NODE_ENV !== 'test' && existsSync(path.join(pastaWeb, 'index.html'))) {
    app.register(fastifyStatic, { root: pastaWeb, wildcard: false });
    // Rotas do React (ex.: /financeiro) abrem o index.html; /api e /ws continuam com 404 em JSON.
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api') && !request.url.startsWith('/ws')) {
        return reply.type('text/html').sendFile('index.html');
      }
      return reply.status(404).type('application/problem+json').send(
        createProblemDetails(404, 'NOT_FOUND', 'Não Encontrado', `Rota ${request.method} ${request.url} não existe.`)
      );
    });
  }

  return app;
}
