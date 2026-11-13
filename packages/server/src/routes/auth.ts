import crypto from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { createProblemDetails, gerarUuidV7 } from '@consultorasync/core';
import { createSessionToken } from '../plugins/session.js';
import { modoDesenvolvimento } from '../config.js';

interface LoginBody {
  operacao_id: string;
  operador_id: string;
  pin?: string;
}

// ---------------------------------------------------------------------------
// PIN: guardado com scrypt + sal. Aceita os formatos antigos (sha256 hex) para
// não trancar quem já tinha PIN cadastrado.
// ---------------------------------------------------------------------------

const PREFIXO_SCRYPT = 'scrypt';

export function hashPin(pin: string): string {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pin, sal, 32);
  return `${PREFIXO_SCRYPT}$${sal.toString('base64url')}$${hash.toString('base64url')}`;
}

function sha256Hex(texto: string): string {
  return crypto.createHash('sha256').update(texto).digest('hex');
}

export function conferirPin(pin: string, guardado: string): boolean {
  if (guardado.startsWith(`${PREFIXO_SCRYPT}$`)) {
    const [, salB64, hashB64] = guardado.split('$');
    if (!salB64 || !hashB64) return false;
    const esperado = Buffer.from(hashB64, 'base64url');
    const calculado = crypto.scryptSync(pin, Buffer.from(salB64, 'base64url'), esperado.length);
    return crypto.timingSafeEqual(esperado, calculado);
  }
  // Legado: sha256 em hex, ou o próprio PIN gravado sem hash (dados antigos de teste)
  const esperadoHex = guardado.length === 64 ? guardado : sha256Hex(guardado);
  return crypto.timingSafeEqual(Buffer.from(esperadoHex, 'hex'), Buffer.from(sha256Hex(pin), 'hex'));
}

export const REGRA_PIN = /^\d{4,8}$/;
export const REGRA_USUARIO = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export function normalizarUsuario(usuario: unknown): string {
  return typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
}

// ---------------------------------------------------------------------------
// Bloqueio de tentativas: 5 erros seguidos no mesmo usuário trancam por 15 min.
// Em memória: suficiente para um servidor único (o caso do projeto).
// ---------------------------------------------------------------------------

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const tentativas = new Map<string, { falhas: number; bloqueadoAte: number }>();

function minutosBloqueado(chave: string): number {
  const t = tentativas.get(chave);
  if (!t || t.bloqueadoAte <= Date.now()) return 0;
  return Math.ceil((t.bloqueadoAte - Date.now()) / 60000);
}

function registrarFalha(chave: string) {
  const t = tentativas.get(chave) ?? { falhas: 0, bloqueadoAte: 0 };
  t.falhas += 1;
  if (t.falhas >= MAX_TENTATIVAS) {
    t.bloqueadoAte = Date.now() + BLOQUEIO_MS;
    t.falhas = 0;
  }
  tentativas.set(chave, t);
}

/** Só para testes: zera o controle de tentativas. */
export function limparTentativasDeLogin() {
  tentativas.clear();
}

function problema(reply: FastifyReply, status: number, codigo: string, titulo: string, detalhe: string) {
  return reply.status(status).type('application/problem+json').send(createProblemDetails(status, codigo, titulo, detalhe));
}

function respostaSessao(operacao: { id: string }, operador: { id: string; nome: string; usuario?: string | null }) {
  const token = createSessionToken({
    operacao_id: operacao.id,
    operador_id: operador.id,
    operador_nome: operador.nome
  });
  return {
    token,
    session: {
      operacao_id: operacao.id,
      operador_id: operador.id,
      operador_nome: operador.nome,
      usuario: operador.usuario ?? null,
      criado_em: new Date().toISOString()
    }
  };
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /** O que a tela de entrada precisa saber antes do login. */
  fastify.get('/api/auth/config', async () => ({
    modo_desenvolvimento: modoDesenvolvimento()
  }));

  /** Primeiro acesso: cria o negócio (operação) e a revendedora com usuário e PIN. */
  fastify.post<{ Body: { nome_negocio?: string; nome?: string; usuario?: string; pin?: string } }>(
    '/api/auth/cadastro',
    async (request, reply) => {
      const nomeNegocio = request.body?.nome_negocio?.trim();
      const nome = request.body?.nome?.trim();
      const usuario = normalizarUsuario(request.body?.usuario);
      const pin = request.body?.pin ?? '';

      if (!nomeNegocio || !nome) {
        return problema(reply, 400, 'BAD_REQUEST', 'Dados incompletos', 'Informe o nome do negócio e o seu nome.');
      }
      if (!REGRA_USUARIO.test(usuario)) {
        return problema(reply, 400, 'USUARIO_INVALIDO', 'Usuário inválido', 'Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.');
      }
      if (!REGRA_PIN.test(pin)) {
        return problema(reply, 400, 'PIN_INVALIDO', 'PIN inválido', 'O PIN deve ter de 4 a 8 números.');
      }
      const existente = await fastify.prisma.operador.findUnique({ where: { usuario } });
      if (existente) {
        return problema(reply, 409, 'USUARIO_EM_USO', 'Usuário em uso', 'Esse usuário já existe. Escolha outro.');
      }

      const operacao = await fastify.prisma.operacao.create({ data: { id: gerarUuidV7(), nome: nomeNegocio } });
      const operador = await fastify.prisma.operador.create({
        data: { id: gerarUuidV7(), operacao_id: operacao.id, nome, usuario, pin_hash: hashPin(pin), ativo: true }
      });
      return reply.status(201).send(respostaSessao(operacao, operador));
    }
  );

  /** Entrada do dia a dia: usuário + PIN. */
  fastify.post<{ Body: { usuario?: string; pin?: string } }>('/api/auth/entrar', async (request, reply) => {
    const usuario = normalizarUsuario(request.body?.usuario);
    const pin = request.body?.pin ?? '';
    if (!usuario || !pin) {
      return problema(reply, 400, 'BAD_REQUEST', 'Dados incompletos', 'Informe o usuário e o PIN.');
    }

    const bloqueio = minutosBloqueado(usuario);
    if (bloqueio > 0) {
      return problema(reply, 429, 'MUITAS_TENTATIVAS', 'Acesso bloqueado', `Muitas tentativas erradas. Tente de novo em ${bloqueio} min.`);
    }

    const operador = await fastify.prisma.operador.findUnique({ where: { usuario } });
    const valido = !!operador && operador.ativo && !!operador.pin_hash && conferirPin(pin, operador.pin_hash);
    if (!operador || !valido) {
      registrarFalha(usuario);
      // Mesma mensagem para usuário inexistente e PIN errado: não revela quem tem conta.
      return problema(reply, 401, 'UNAUTHORIZED', 'Não foi possível entrar', 'Usuário ou PIN incorretos.');
    }

    tentativas.delete(usuario);
    return reply.status(200).send(respostaSessao({ id: operador.operacao_id }, operador));
  });

  /** Define ou troca o usuário e o PIN de quem está conectada. */
  fastify.put<{ Body: { usuario?: string; pin_atual?: string; pin_novo?: string } }>(
    '/api/auth/acesso',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const session = request.session!;
      const operador = await fastify.prisma.operador.findFirst({
        where: { id: session.operadorId, operacao_id: session.operacaoId }
      });
      if (!operador) return problema(reply, 404, 'NOT_FOUND', 'Não encontrado', 'Pessoa não encontrada.');

      const usuario = normalizarUsuario(request.body?.usuario ?? operador.usuario);
      const pinNovo = request.body?.pin_novo ?? '';
      const pinAtual = request.body?.pin_atual ?? '';

      if (!REGRA_USUARIO.test(usuario)) {
        return problema(reply, 400, 'USUARIO_INVALIDO', 'Usuário inválido', 'Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.');
      }
      if (pinNovo && !REGRA_PIN.test(pinNovo)) {
        return problema(reply, 400, 'PIN_INVALIDO', 'PIN inválido', 'O PIN deve ter de 4 a 8 números.');
      }
      if (!operador.pin_hash && !pinNovo) {
        return problema(reply, 400, 'PIN_OBRIGATORIO', 'PIN obrigatório', 'Crie um PIN para poder entrar com o usuário.');
      }
      // Quem já tem PIN confirma o atual antes de mudar qualquer dado de acesso.
      if (operador.pin_hash && !conferirPin(pinAtual, operador.pin_hash)) {
        return problema(reply, 401, 'PIN_INCORRETO', 'PIN atual incorreto', 'Confirme o PIN atual para alterar o acesso.');
      }
      const dono = await fastify.prisma.operador.findUnique({ where: { usuario } });
      if (dono && dono.id !== operador.id) {
        return problema(reply, 409, 'USUARIO_EM_USO', 'Usuário em uso', 'Esse usuário já existe. Escolha outro.');
      }

      const atualizado = await fastify.prisma.operador.update({
        where: { id: operador.id },
        data: { usuario, ...(pinNovo ? { pin_hash: hashPin(pinNovo) } : {}) }
      });
      return reply.status(200).send({ usuario: atualizado.usuario, possui_pin: !!atualizado.pin_hash });
    }
  );

  /**
   * Entrada por identificadores (usada pelos testes e integrações internas).
   * Fora do modo desenvolvimento, exige que a pessoa tenha PIN.
   */
  fastify.post<{ Body: LoginBody }>('/api/auth/login', async (request, reply) => {
    const { operacao_id, operador_id, pin } = request.body || {};

    if (!operacao_id || !operador_id) {
      return problema(reply, 400, 'BAD_REQUEST', 'Requisição Inválida', 'Os campos operacao_id e operador_id são obrigatórios.');
    }

    const operacao = await fastify.prisma.operacao.findUnique({ where: { id: operacao_id } });
    if (!operacao) {
      return problema(reply, 401, 'UNAUTHORIZED', 'Credenciais Inválidas', 'Operação não encontrada ou credenciais inválidas.');
    }

    const operador = await fastify.prisma.operador.findFirst({
      where: { id: operador_id, operacao_id, ativo: true }
    });
    if (!operador) {
      return problema(reply, 401, 'UNAUTHORIZED', 'Credenciais Inválidas', 'Operador não encontrado, inativo ou não pertence a esta operação.');
    }

    if (operador.pin_hash) {
      if (!pin) {
        return problema(reply, 401, 'UNAUTHORIZED', 'PIN Inválido', 'O PIN de acesso do operador é obrigatório.');
      }
      if (!conferirPin(pin, operador.pin_hash)) {
        return problema(reply, 401, 'UNAUTHORIZED', 'PIN Inválido', 'O PIN informado para o operador está incorreto.');
      }
    } else if (!modoDesenvolvimento()) {
      return problema(reply, 401, 'UNAUTHORIZED', 'PIN Obrigatório', 'Defina um PIN para esta pessoa antes de entrar.');
    }

    return reply.status(200).send(respostaSessao(operacao, operador));
  });

  fastify.get('/api/auth/session', { preHandler: fastify.requireSession }, async (request, reply) => {
    const session = request.session!;
    const operador = await fastify.prisma.operador.findUnique({
      where: { id: session.operadorId },
      select: { usuario: true, pin_hash: true }
    });
    return reply.status(200).send({
      operacao_id: session.operacaoId,
      operador_id: session.operadorId,
      operador_nome: session.operadorNome,
      usuario: operador?.usuario ?? null,
      possui_pin: !!operador?.pin_hash,
      criada_em: session.criadaEm
    });
  });

  fastify.post('/api/auth/logout', { preHandler: fastify.requireSession }, async (_request, reply) => {
    return reply.status(200).send({ success: true });
  });

  // Conta de demonstração: só existe em desenvolvimento. Em produção a rota nem é registrada.
  if (!modoDesenvolvimento()) return;

  fastify.post('/api/auth/dev-session', async (_request, reply) => {
    let operacao = await fastify.prisma.operacao.findFirst({ where: { nome: { contains: 'Beleza Viva' } } });
    if (!operacao) operacao = await fastify.prisma.operacao.findFirst();
    if (!operacao) {
      operacao = await fastify.prisma.operacao.create({
        data: { id: gerarUuidV7(), nome: 'Consultoria Beleza Viva (Dona Sônia)' }
      });
    }

    let operador = await fastify.prisma.operador.findFirst({
      where: { operacao_id: operacao.id, nome: { contains: 'Sônia' } }
    });
    if (!operador) {
      operador = await fastify.prisma.operador.create({
        data: { id: gerarUuidV7(), operacao_id: operacao.id, nome: 'Dona Sônia', ativo: true }
      });
    }

    return reply.status(200).send(respostaSessao(operacao, operador));
  });
};
