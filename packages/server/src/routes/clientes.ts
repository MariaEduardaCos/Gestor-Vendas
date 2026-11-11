import type { FastifyPluginAsync } from 'fastify';
import {
  Cliente,
  formatarTelefone,
  gerarUuidV7,
  createProblemDetails
} from '@consultorasync/core';

interface ClienteBody {
  nome: string;
  telefone?: string | null;
  endereco?: string | null;
}

interface ClientesQuery {
  busca?: string;
  q?: string;
}

export const clientesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/clientes - Cadastro de novo cliente (ou gaveta rápida)
  fastify.post<{ Body: ClienteBody }>(
    '/api/clientes',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { nome, telefone, endereco } = request.body || {};
      const session = request.session!;

      let clienteDomain: Cliente;
      try {
        clienteDomain = new Cliente({
          id: gerarUuidV7(),
          operacaoId: session.operacaoId,
          nome,
          telefone,
          endereco
        });
      } catch (err: any) {
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Dados Inválidos', err.message || 'Erro ao validar cliente.')
        );
      }

      const cliente = await request.tenantPrisma.cliente.create({
        data: {
          id: clienteDomain.id,
          operacao_id: session.operacaoId,
          nome: clienteDomain.nome,
          telefone: clienteDomain.telefone,
          endereco: clienteDomain.endereco,
          saldo_credito_centavos: clienteDomain.saldoCreditoCentavos,
          criado_em: new Date(clienteDomain.criadoEm),
          atualizado_em: new Date(clienteDomain.atualizadoEm)
        }
      });

      // Auditoria nominal com operador e timestamp UTC (NFR-003)
      await request.tenantPrisma.registroAuditoria.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: session.operacaoId,
          operador_id: session.operadorId,
          operador_nome: session.operadorNome,
          acao: 'CADASTRAR_CLIENTE',
          detalhes: `Cadastro de cliente: ${cliente.nome} (ID: ${cliente.id})`,
          criado_em: new Date()
        }
      });

      return reply.status(201).send({
        id: cliente.id,
        operacao_id: cliente.operacao_id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        telefone_formatado: clienteDomain.telefoneFormatado,
        endereco: cliente.endereco,
        saldo_credito_centavos: cliente.saldo_credito_centavos,
        criado_em: cliente.criado_em.toISOString(),
        atualizado_em: cliente.atualizado_em.toISOString()
      });
    }
  );

  // GET /api/clientes - Busca rápida por nome ou telefone (< 2s)
  fastify.get<{ Querystring: ClientesQuery }>(
    '/api/clientes',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const termo = (request.query.busca || request.query.q || '').trim();
      const digitosTermo = termo.replace(/\D/g, '');

      let clientes = await request.tenantPrisma.cliente.findMany({
        where: termo.length > 0
          ? {
              OR: [
                { nome: { contains: termo } },
                { telefone: { contains: termo } }
              ]
            }
          : {},
        orderBy: { nome: 'asc' }
      });

      // Se a busca contiver dígitos (ex: "6499876"), garante match em telefones formatados como "(64) 99876-5432"
      if (termo.length > 0 && digitosTermo.length >= 2) {
        const todosComTelefone = await request.tenantPrisma.cliente.findMany({
          where: { telefone: { not: null } },
          orderBy: { nome: 'asc' }
        });

        const idsExistentes = new Set(clientes.map((c) => c.id));
        for (const c of todosComTelefone) {
          if (!idsExistentes.has(c.id) && c.telefone) {
            const digitosCliente = c.telefone.replace(/\D/g, '');
            if (digitosCliente.includes(digitosTermo)) {
              clientes.push(c);
              idsExistentes.add(c.id);
            }
          }
        }
        clientes.sort((a, b) => a.nome.localeCompare(b.nome));
      }

      return reply.status(200).send(
        clientes.map((c) => ({
          id: c.id,
          operacao_id: c.operacao_id,
          nome: c.nome,
          telefone: c.telefone,
          telefone_formatado: formatarTelefone(c.telefone),
          endereco: c.endereco,
          saldo_credito_centavos: c.saldo_credito_centavos,
          criado_em: c.criado_em.toISOString(),
          atualizado_em: c.atualizado_em.toISOString()
        }))
      );
    }
  );

  // GET /api/clientes/:id - Ficha detalhada do cliente com contas e encomendas
  fastify.get<{ Params: { id: string } }>(
    '/api/clientes/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;

      const cliente = await request.tenantPrisma.cliente.findUnique({
        where: { id },
        include: {
          contas: true,
          encomendas: true
        }
      });

      if (!cliente) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Cliente Não Encontrado',
            'O cliente solicitado não existe ou não pertence a esta operação.'
          )
        );
      }

      return reply.status(200).send({
        id: cliente.id,
        operacao_id: cliente.operacao_id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        telefone_formatado: formatarTelefone(cliente.telefone),
        endereco: cliente.endereco,
        saldo_credito_centavos: cliente.saldo_credito_centavos,
        contas: cliente.contas.map((c) => ({
          id: c.id,
          valor_total: c.valor_total,
          total_pago: c.total_pago,
          status: c.status,
          criado_em: c.criado_em.toISOString()
        })),
        encomendas: cliente.encomendas.map((e) => ({
          id: e.id,
          descricao: e.descricao,
          status: e.status,
          criado_em: e.criado_em.toISOString()
        })),
        criado_em: cliente.criado_em.toISOString(),
        atualizado_em: cliente.atualizado_em.toISOString()
      });
    }
  );

  // PUT /api/clientes/:id - Edição de dados do cliente com auditoria
  fastify.put<{ Params: { id: string }; Body: ClienteBody }>(
    '/api/clientes/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const { nome, telefone, endereco } = request.body || {};
      const session = request.session!;

      const existente = await request.tenantPrisma.cliente.findUnique({
        where: { id }
      });

      if (!existente) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Cliente Não Encontrado',
            'O cliente solicitado não existe ou não pertence a esta operação.'
          )
        );
      }

      let clienteDomain: Cliente;
      try {
        clienteDomain = new Cliente({
          id: existente.id,
          operacaoId: existente.operacao_id,
          nome: existente.nome,
          telefone: existente.telefone,
          endereco: existente.endereco,
          saldoCreditoCentavos: existente.saldo_credito_centavos,
          criadoEm: existente.criado_em.toISOString(),
          atualizadoEm: existente.atualizado_em.toISOString()
        });

        clienteDomain.atualizar({ nome, telefone, endereco });
      } catch (err: any) {
        if (err.problem) {
          return reply.status(err.problem.status).type('application/problem+json').send(err.problem);
        }
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(400, 'BAD_REQUEST', 'Dados Inválidos', err.message || 'Erro ao atualizar cliente.')
        );
      }

      const atualizado = await request.tenantPrisma.cliente.update({
        where: { id },
        data: {
          nome: clienteDomain.nome,
          telefone: clienteDomain.telefone,
          endereco: clienteDomain.endereco,
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
          acao: 'EDITAR_CLIENTE',
          detalhes: `Edição de cliente: ${atualizado.nome} (ID: ${atualizado.id})`,
          criado_em: new Date()
        }
      });

      return reply.status(200).send({
        id: atualizado.id,
        operacao_id: atualizado.operacao_id,
        nome: atualizado.nome,
        telefone: atualizado.telefone,
        telefone_formatado: clienteDomain.telefoneFormatado,
        endereco: atualizado.endereco,
        saldo_credito_centavos: atualizado.saldo_credito_centavos,
        criado_em: atualizado.criado_em.toISOString(),
        atualizado_em: atualizado.atualizado_em.toISOString()
      });
    }
  );

  // DELETE /api/clientes/:id - Exclusão de cliente (bloqueada se possuir vínculos)
  fastify.delete<{ Params: { id: string } }>(
    '/api/clientes/:id',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const { id } = request.params;
      const session = request.session!;

      const existente = await request.tenantPrisma.cliente.findUnique({
        where: { id }
      });

      if (!existente) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(
            404,
            'NOT_FOUND',
            'Cliente Não Encontrado',
            'O cliente solicitado não existe ou não pertence a esta operação.'
          )
        );
      }

      // Verifica se cliente possui contas ou encomendas
      const contasCount = await request.tenantPrisma.conta.count({
        where: { cliente_id: id }
      });
      const encomendasCount = await request.tenantPrisma.encomenda.count({
        where: { cliente_id: id }
      });

      if (contasCount > 0 || encomendasCount > 0 || existente.saldo_credito_centavos > 0) {
        return reply.status(400).type('application/problem+json').send(
          createProblemDetails(
            400,
            'CLIENTE_POSSUI_VINCULOS',
            'Exclusão Não Permitida',
            'Não é permitido excluir cliente que possua vendas, encomendas, contas vinculadas ou saldo de crédito ativo.'
          )
        );
      }

      await request.tenantPrisma.cliente.delete({
        where: { id }
      });

      // Auditoria de exclusão
      await request.tenantPrisma.registroAuditoria.create({
        data: {
          id: gerarUuidV7(),
          operacao_id: session.operacaoId,
          operador_id: session.operadorId,
          operador_nome: session.operadorNome,
          acao: 'EXCLUIR_CLIENTE',
          detalhes: `Exclusão de cliente: ${existente.nome} (ID: ${existente.id})`,
          criado_em: new Date()
        }
      });

      return reply.status(200).send({
        id: existente.id,
        sucesso: true,
        mensagem: 'Cliente excluído com sucesso.'
      });
    }
  );
};
