import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { WebSocket } from 'ws';
import { buildApp } from '../src/app.js';
import { pareamentoHub } from '../src/infrastructure/pareamentoHub.js';
import { createSessionToken } from '../src/plugins/session.js';
import {
  gerarUuidV7,
  deserializarMensagem,
  serializarMensagem,
  PAREAMENTO_TTL_PADRAO_MS,
  type PareamentoMensagem
} from '@consultorasync/core';

describe('Story 1.6: Pareamento Efêmero Celular-Computador com WebSocket (Server)', () => {
  const prisma = new PrismaClient();
  const app = buildApp({ prisma });

  const operacaoAId = gerarUuidV7();
  const operacaoBId = gerarUuidV7();
  const operadorSoniaId = gerarUuidV7();
  const operadorOutroId = gerarUuidV7();

  let tokenSoniaA: string;
  let tokenOutroB: string;
  let serverPort: number;
  let serverAddress: string;

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.registroAuditoria.deleteMany({
      where: { operacao_id: { in: [operacaoAId, operacaoBId] } }
    });
    await prisma.operador.deleteMany({
      where: { operacao_id: { in: [operacaoAId, operacaoBId] } }
    });
    await prisma.operacao.deleteMany({
      where: { id: { in: [operacaoAId, operacaoBId] } }
    });

    await prisma.operacao.create({
      data: { id: operacaoAId, nome: 'Operação Beleza Viva' }
    });
    await prisma.operador.create({
      data: { id: operadorSoniaId, operacao_id: operacaoAId, nome: 'Dona Sônia', ativo: true }
    });

    await prisma.operacao.create({
      data: { id: operacaoBId, nome: 'Operação Perfumes & Cia' }
    });
    await prisma.operador.create({
      data: { id: operadorOutroId, operacao_id: operacaoBId, nome: 'Revendedora B', ativo: true }
    });

    tokenSoniaA = createSessionToken({
      operacao_id: operacaoAId,
      operador_id: operadorSoniaId,
      operador_nome: 'Dona Sônia'
    });

    tokenOutroB = createSessionToken({
      operacao_id: operacaoBId,
      operador_id: operadorOutroId,
      operador_nome: 'Revendedora B'
    });

    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (typeof address === 'object' && address !== null) {
      serverPort = address.port;
      serverAddress = `127.0.0.1:${serverPort}`;
    }
  });

  afterAll(async () => {
    pareamentoHub.limpar();
    await app.close();
    await prisma.registroAuditoria.deleteMany({
      where: { operacao_id: { in: [operacaoAId, operacaoBId] } }
    });
    await prisma.operador.deleteMany({
      where: { operacao_id: { in: [operacaoAId, operacaoBId] } }
    });
    await prisma.operacao.deleteMany({
      where: { id: { in: [operacaoAId, operacaoBId] } }
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    pareamentoHub.limpar();
  });

  // Helper para conectar WebSocket e coletar mensagens
  function criarClienteWs(url: string): {
    ws: WebSocket;
    mensagens: PareamentoMensagem[];
    aguardarMensagem: (predicate: (msg: PareamentoMensagem) => boolean, timeoutMs?: number) => Promise<PareamentoMensagem>;
    aguardarAberto: () => Promise<void>;
    fechar: () => Promise<void>;
  } {
    const ws = new WebSocket(url);
    const mensagens: PareamentoMensagem[] = [];

    ws.on('message', (data) => {
      const parsed = deserializarMensagem(data.toString());
      if (parsed) mensagens.push(parsed);
    });

    const aguardarAberto = () =>
      new Promise<void>((resolve, reject) => {
        if (ws.readyState === WebSocket.OPEN) return resolve();
        ws.once('open', () => resolve());
        ws.once('error', reject);
      });

    const aguardarMensagem = (
      predicate: (msg: PareamentoMensagem) => boolean,
      timeoutMs = 3000
    ): Promise<PareamentoMensagem> => {
      return new Promise((resolve, reject) => {
        const jaExiste = mensagens.find(predicate);
        if (jaExiste) return resolve(jaExiste);

        const timer = setTimeout(() => {
          ws.off('message', handler);
          reject(new Error(`Timeout aguardando mensagem que satisfaça o predicado (recebidas: ${JSON.stringify(mensagens)})`));
        }, timeoutMs);

        const handler = (data: any) => {
          const parsed = deserializarMensagem(data.toString());
          if (parsed && predicate(parsed)) {
            clearTimeout(timer);
            ws.off('message', handler);
            resolve(parsed);
          }
        };

        ws.on('message', handler);
      });
    };

    const fechar = () =>
      new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) return resolve();
        ws.once('close', () => resolve());
        ws.close();
      });

    return { ws, mensagens, aguardarMensagem, aguardarAberto, fechar };
  }

  describe('Endpoints HTTP REST de Pareamento', () => {
    it('POST /api/pareamento/criar deve gerar sessão efêmera com TTL de 10m e exigir autenticação (AD-6, FR-014)', async () => {
      // 1. Sem token deve ser rejeitado (401)
      const resSemAuth = await app.inject({
        method: 'POST',
        url: '/api/pareamento/criar'
      });
      expect(resSemAuth.statusCode).toBe(401);

      // 2. Com sessão de Dona Sônia
      const res = await app.inject({
        method: 'POST',
        url: '/api/pareamento/criar',
        headers: { authorization: `Bearer ${tokenSoniaA}` }
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();

      expect(data.token).toBeDefined();
      expect(typeof data.token).toBe('string');
      expect(data.operacao_id).toBe(operacaoAId);
      expect(data.status).toBe('AGUARDANDO_CELULAR');
      expect(data.celularConectado).toBe(false);
      expect(data.tempoRestanteMs).toBeGreaterThan(590_000);
      expect(data.tempoRestanteMs).toBeLessThanOrEqual(PAREAMENTO_TTL_PADRAO_MS);
      expect(data.urlPareamento).toContain(`leitor_token=${encodeURIComponent(data.token)}`);
    });

    it('GET /api/pareamento/:token deve permitir consulta pública sem autenticação e sem dados confidenciais (AD-6)', async () => {
      // Cria sessão
      const resCriar = await app.inject({
        method: 'POST',
        url: '/api/pareamento/criar',
        headers: { authorization: `Bearer ${tokenSoniaA}` }
      });
      const token = resCriar.json().token;

      // Consulta pública
      const res = await app.inject({
        method: 'GET',
        url: `/api/pareamento/${token}`
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.token).toBe(token);
      expect(data.status).toBe('AGUARDANDO_CELULAR');
      expect(data.tempoRestanteMs).toBeGreaterThan(0);
      // NUNCA deve expor clientes, saldos, ou operacao_id para o celular (AD-6)
      expect(data.clientes).toBeUndefined();
      expect(data.operacao_id).toBeUndefined();
      expect(data.saldo).toBeUndefined();

      // Token inexistente
      const res404 = await app.inject({
        method: 'GET',
        url: '/api/pareamento/token-inexistente'
      });
      expect(res404.statusCode).toBe(404);
    });

    it('POST /api/pareamento/renovar deve reativar o TTL da sessão em 1 toque', async () => {
      const resCriar = await app.inject({
        method: 'POST',
        url: '/api/pareamento/criar',
        headers: { authorization: `Bearer ${tokenSoniaA}` }
      });
      const tokenOriginal = resCriar.json().token;

      const resRenovar = await app.inject({
        method: 'POST',
        url: '/api/pareamento/renovar',
        headers: { authorization: `Bearer ${tokenSoniaA}` },
        payload: { token: tokenOriginal }
      });

      expect(resRenovar.statusCode).toBe(200);
      const dataRenovada = resRenovar.json();
      expect(dataRenovada.token).toBe(tokenOriginal);
      expect(dataRenovada.tempoRestanteMs).toBeGreaterThan(590_000);
      expect(dataRenovada.status).toBe('AGUARDANDO_CELULAR');
    });
  });

  describe('Comunicação em Tempo Real via WebSocket (GET /ws/pareamento/:token)', () => {
    it('deve conectar desktop e mobile, atualizar status para CONECTADO e transmitir eventos SCAN em tempo real', async () => {
      // 1. Cria sessão
      const resCriar = await app.inject({
        method: 'POST',
        url: '/api/pareamento/criar',
        headers: { authorization: `Bearer ${tokenSoniaA}` }
      });
      const { token } = resCriar.json();

      // 2. Desktop conecta ao canal
      const desktop = criarClienteWs(`ws://${serverAddress}/ws/pareamento/${token}?ponta=desktop`);
      await desktop.aguardarAberto();

      // Desktop deve receber status inicial AGUARDANDO_CELULAR
      const msgInicial = await desktop.aguardarMensagem(
        (m) => m.tipo === 'STATUS' && m.status === 'AGUARDANDO_CELULAR'
      );
      expect(msgInicial.status).toBe('AGUARDANDO_CELULAR');

      // 3. Celular lê o QR Code e conecta ao canal (AD-6: sem login)
      const mobile = criarClienteWs(`ws://${serverAddress}/ws/pareamento/${token}?ponta=mobile`);
      await mobile.aguardarAberto();

      // Mobile recebe status CONECTADO
      const msgMobile = await mobile.aguardarMensagem(
        (m) => m.tipo === 'STATUS' && m.status === 'CONECTADO'
      );
      expect(msgMobile.status).toBe('CONECTADO');

      // Desktop recebe notificação imediata de que o celular CONECTOU (UX-DR9)
      const msgDesktopConectado = await desktop.aguardarMensagem(
        (m) => m.tipo === 'STATUS' && m.status === 'CONECTADO'
      );
      expect(msgDesktopConectado.status).toBe('CONECTADO');

      // 4. Celular transmite bipagem de código de barras
      mobile.ws.send(
        serializarMensagem({
          tipo: 'SCAN',
          codigo: '7891234567890'
        })
      );

      // Desktop recebe o código lido instantaneamente
      const msgScanRecebida = await desktop.aguardarMensagem((m) => m.tipo === 'SCAN');
      expect(msgScanRecebida.tipo).toBe('SCAN');
      if (msgScanRecebida.tipo === 'SCAN') {
        expect(msgScanRecebida.codigo).toBe('7891234567890');
      }

      // 5. Teste de PING/PONG para manutenção de liveness
      mobile.ws.send(serializarMensagem({ tipo: 'PING' }));
      const msgPong = await mobile.aguardarMensagem((m) => m.tipo === 'PONG');
      expect(msgPong.tipo).toBe('PONG');

      await desktop.fechar();
      await mobile.fechar();
    });

    it('deve atualizar desktop para DESCONECTADO se o celular perder conexão e voltar a CONECTADO na reconexão', async () => {
      const resCriar = await app.inject({
        method: 'POST',
        url: '/api/pareamento/criar',
        headers: { authorization: `Bearer ${tokenSoniaA}` }
      });
      const { token } = resCriar.json();

      const desktop = criarClienteWs(`ws://${serverAddress}/ws/pareamento/${token}?ponta=desktop`);
      await desktop.aguardarAberto();

      // Mobile 1 conecta
      const mobile1 = criarClienteWs(`ws://${serverAddress}/ws/pareamento/${token}?ponta=mobile`);
      await mobile1.aguardarAberto();

      await desktop.aguardarMensagem((m) => m.tipo === 'STATUS' && m.status === 'CONECTADO');

      // Celular desconecta abruptamente (queda de rede)
      await mobile1.fechar();

      // Desktop recebe status DESCONECTADO
      const msgDesconectado = await desktop.aguardarMensagem(
        (m) => m.tipo === 'STATUS' && m.status === 'DESCONECTADO'
      );
      expect(msgDesconectado.status).toBe('DESCONECTADO');

      // Celular reconecta com o mesmo token (backoff automático do celular)
      const mobile2 = criarClienteWs(`ws://${serverAddress}/ws/pareamento/${token}?ponta=mobile`);
      await mobile2.aguardarAberto();

      // Desktop volta para CONECTADO sem perder o estado prévio
      const msgReconectado = await desktop.aguardarMensagem(
        (m) => m.tipo === 'STATUS' && m.status === 'CONECTADO'
      );
      expect(msgReconectado.status).toBe('CONECTADO');

      await desktop.fechar();
      await mobile2.fechar();
    });

    it('Isolamento Multi-inquilino Absoluto: Bips da Operação A NUNCA chegam ao desktop da Operação B', async () => {
      // Operação A (Dona Sônia) cria pareamento
      const resA = await app.inject({
        method: 'POST',
        url: '/api/pareamento/criar',
        headers: { authorization: `Bearer ${tokenSoniaA}` }
      });
      const tokenA = resA.json().token;

      // Operação B (Revendedora B) cria pareamento
      const resB = await app.inject({
        method: 'POST',
        url: '/api/pareamento/criar',
        headers: { authorization: `Bearer ${tokenOutroB}` }
      });
      const tokenB = resB.json().token;

      // Desktops conectam
      const desktopA = criarClienteWs(`ws://${serverAddress}/ws/pareamento/${tokenA}?ponta=desktop`);
      const desktopB = criarClienteWs(`ws://${serverAddress}/ws/pareamento/${tokenB}?ponta=desktop`);
      await desktopA.aguardarAberto();
      await desktopB.aguardarAberto();

      // Celular A conecta e bipa produto exclusivo da Operação A
      const mobileA = criarClienteWs(`ws://${serverAddress}/ws/pareamento/${tokenA}?ponta=mobile`);
      await mobileA.aguardarAberto();
      await desktopA.aguardarMensagem((m) => m.tipo === 'STATUS' && m.status === 'CONECTADO');

      mobileA.ws.send(
        serializarMensagem({
          tipo: 'SCAN',
          codigo: '789_PRODUTO_EXCLUSIVO_A'
        })
      );

      // Desktop A recebe o código
      const msgA = await desktopA.aguardarMensagem((m) => m.tipo === 'SCAN');
      expect((msgA as any).codigo).toBe('789_PRODUTO_EXCLUSIVO_A');

      // Desktop B NÃO recebe NADA referente ao código da Operação A
      const msgScanEmB = desktopB.mensagens.find((m) => m.tipo === 'SCAN');
      expect(msgScanEmB).toBeUndefined();

      await desktopA.fechar();
      await desktopB.fechar();
      await mobileA.fechar();
    });

    it('Expiração de TTL: encerra a sessão com status EXPIRADO e fecha os sockets conectados', async () => {
      // Cria sessão com TTL curto de 150ms para teste determinístico de expiração
      const resCriar = await app.inject({
        method: 'POST',
        url: '/api/pareamento/criar',
        headers: { authorization: `Bearer ${tokenSoniaA}` },
        payload: { ttlMs: 150 }
      });
      const { token } = resCriar.json();

      const desktop = criarClienteWs(`ws://${serverAddress}/ws/pareamento/${token}?ponta=desktop`);
      const mobile = criarClienteWs(`ws://${serverAddress}/ws/pareamento/${token}?ponta=mobile`);
      await desktop.aguardarAberto();
      await mobile.aguardarAberto();

      // Aguarda expiração do TTL
      const msgExpDesktop = await desktop.aguardarMensagem(
        (m) => m.tipo === 'STATUS' && m.status === 'EXPIRADO',
        1000
      );
      expect(msgExpDesktop.status).toBe('EXPIRADO');

      const msgExpMobile = await mobile.aguardarMensagem(
        (m) => m.tipo === 'STATUS' && m.status === 'EXPIRADO',
        1000
      );
      expect(msgExpMobile.status).toBe('EXPIRADO');

      // Tentativa de reconectar a um token expirado deve ser rejeitada
      const mobileAtrasado = criarClienteWs(`ws://${serverAddress}/ws/pareamento/${token}?ponta=mobile`);
      const erroOuFechamento = await mobileAtrasado.aguardarMensagem((m) => m.tipo === 'ERRO', 1000);
      expect(erroOuFechamento.tipo).toBe('ERRO');
      expect((erroOuFechamento as any).codigo).toBe('EXPIRADO');

      await desktop.fechar();
      await mobile.fechar();
      await mobileAtrasado.fechar();
    });

    it('Isolamento de Tenant na Renovação: operador da Operação B não pode renovar ou capturar sessão da Operação A', async () => {
      // Operação A cria pareamento
      const resA = await app.inject({
        method: 'POST',
        url: '/api/pareamento/criar',
        headers: { authorization: `Bearer ${tokenSoniaA}` }
      });
      const sessaoA = resA.json();

      // Operador da Operação B tenta renovar o token da Operação A
      const resRenovacaoB = await app.inject({
        method: 'POST',
        url: '/api/pareamento/renovar',
        headers: { authorization: `Bearer ${tokenOutroB}` },
        payload: { token: sessaoA.token }
      });

      expect(resRenovacaoB.statusCode).toBe(200);
      const sessaoB = resRenovacaoB.json();

      // A resposta para B deve ser uma nova sessão gerada para B, com token diferente e associada à Operação B
      expect(sessaoB.token).not.toBe(sessaoA.token);
      expect(sessaoB.operacao_id).toBe(operacaoBId);

      // A sessão original de A permanece intacta e pertencendo à Operação A de Dona Sônia
      const sessaoAOriginal = pareamentoHub.obterSessao(sessaoA.token);
      expect(sessaoAOriginal).not.toBeNull();
      expect(sessaoAOriginal?.operacao_id).toBe(operacaoAId);
    });
  });
});
