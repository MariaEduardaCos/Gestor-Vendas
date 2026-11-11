import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  PAREAMENTO_TTL_PADRAO_MS,
  validarSessaoExpirada,
  calcularTempoRestanteMs,
  serializarMensagem,
  deserializarMensagem,
  type StatusPareamento,
  type SessaoPareamentoDTO,
  type TipoPontaPareamento,
  type PareamentoMensagem
} from '@consultorasync/core';

export interface SessaoInterna {
  token: string;
  operacao_id: string;
  operador_id: string;
  operador_nome: string;
  criadoEm: number;
  ttlMs: number;
  desktopSockets: Set<WebSocket>;
  mobileSockets: Set<WebSocket>;
  timerExpira: NodeJS.Timeout | null;
}

export class PareamentoHub {
  private sessoes: Map<string, SessaoInterna> = new Map();

  /**
   * Gera um token criptograficamente seguro e aleatório (AD-6).
   */
  public gerarToken(): string {
    return crypto.randomBytes(24).toString('base64url');
  }

  /**
   * Cria uma nova sessão efêmera vinculada à operacao_id com TTL estrito de 10 minutos (600.000 ms).
   */
  public criarSessao(
    operacao_id: string,
    operador_id: string,
    operador_nome: string,
    ttlMs: number = PAREAMENTO_TTL_PADRAO_MS
  ): SessaoPareamentoDTO {
    const token = this.gerarToken();
    const agora = Date.now();

    const sessao: SessaoInterna = {
      token,
      operacao_id,
      operador_id,
      operador_nome,
      criadoEm: agora,
      ttlMs,
      desktopSockets: new Set(),
      mobileSockets: new Set(),
      timerExpira: null
    };

    sessao.timerExpira = setTimeout(() => {
      this.expirarSessao(token);
    }, ttlMs);

    this.sessoes.set(token, sessao);

    return this.paraDTO(sessao);
  }

  /**
   * Renova uma sessão existente ou cria uma nova se inexistente/expirada (1 toque).
   */
  public renovarSessao(
    tokenOuOperacaoId: string,
    operacao_id: string,
    operador_id: string,
    operador_nome: string,
    ttlMs: number = PAREAMENTO_TTL_PADRAO_MS
  ): SessaoPareamentoDTO {
    let sessao = this.sessoes.get(tokenOuOperacaoId);
    const agora = Date.now();

    // Se a sessão existir e pertencer à MESMA operação do operador autenticado (isolamento estrito AD-1, AD-6)
    if (sessao && sessao.operacao_id === operacao_id) {
      if (sessao.timerExpira) {
        clearTimeout(sessao.timerExpira);
      }
      sessao.criadoEm = agora;
      sessao.ttlMs = ttlMs;
      sessao.timerExpira = setTimeout(() => {
        this.expirarSessao(sessao!.token);
      }, ttlMs);

      const status: StatusPareamento = sessao.mobileSockets.size > 0 ? 'CONECTADO' : 'AGUARDANDO_CELULAR';
      const msg: PareamentoMensagem = {
        tipo: 'STATUS',
        status,
        detalhe: 'Sessão renovada com sucesso',
        tempoRestanteMs: ttlMs
      };
      this.broadcast(sessao, msg);

      return this.paraDTO(sessao);
    }

    // Se a sessão expirou, não existe ou pertencia a outro tenant, cria uma nova exclusivamente para este tenant
    return this.criarSessao(operacao_id, operador_id, operador_nome, ttlMs);
  }

  /**
   * Força a expiração de uma sessão, notifica ambas as pontas e limpa a memória (evita memory leak).
   */
  public expirarSessao(token: string): void {
    const sessao = this.sessoes.get(token);
    if (!sessao) return;

    if (sessao.timerExpira) {
      clearTimeout(sessao.timerExpira);
      sessao.timerExpira = null;
    }

    const expiradoMsg: PareamentoMensagem = {
      tipo: 'STATUS',
      status: 'EXPIRADO',
      detalhe: 'Sessão expirada após 10 minutos',
      tempoRestanteMs: 0
    };

    this.broadcast(sessao, expiradoMsg);

    // Fecha sockets conectados de forma graciosa
    for (const ws of [...sessao.desktopSockets, ...sessao.mobileSockets]) {
      try {
        ws.close(1000, 'Sessão expirada');
      } catch {}
    }

    sessao.desktopSockets.clear();
    sessao.mobileSockets.clear();

    // Remove do mapa interno liberando a referência de memória
    this.sessoes.delete(token);
  }

  /**
   * Consulta uma sessão pelo token e verifica TTL.
   */
  public obterSessao(token: string): SessaoPareamentoDTO | null {
    const sessao = this.sessoes.get(token);
    if (!sessao) return null;

    if (validarSessaoExpirada(sessao.criadoEm, sessao.ttlMs)) {
      this.expirarSessao(token);
      return null;
    }

    return this.paraDTO(sessao);
  }

  /**
   * Registra e gerencia uma conexão WebSocket (desktop ou mobile) para o token.
   */
  public conectarSocket(token: string, socket: WebSocket, tipoPonta: TipoPontaPareamento): boolean {
    const sessao = this.sessoes.get(token);

    if (!sessao || validarSessaoExpirada(sessao.criadoEm, sessao.ttlMs)) {
      const msgErro: PareamentoMensagem = {
        tipo: 'ERRO',
        motivo: 'Sessão inexistente ou expirada',
        codigo: 'EXPIRADO'
      };
      try {
        socket.send(serializarMensagem(msgErro));
        socket.close(1008, 'Sessão inválida ou expirada');
      } catch {}
      return false;
    }

    const tempoRestante = calcularTempoRestanteMs(sessao.criadoEm, sessao.ttlMs);

    if (tipoPonta === 'DESKTOP') {
      sessao.desktopSockets.add(socket);

      const status: StatusPareamento = sessao.mobileSockets.size > 0 ? 'CONECTADO' : 'AGUARDANDO_CELULAR';
      const statusMsg: PareamentoMensagem = {
        tipo: 'STATUS',
        status,
        detalhe: sessao.mobileSockets.size > 0 ? 'Celular conectado' : 'Aguardando leitura do QR Code',
        tempoRestanteMs: tempoRestante
      };
      try {
        socket.send(serializarMensagem(statusMsg));
      } catch {}
    } else {
      // MOBILE
      sessao.mobileSockets.add(socket);

      // Notifica o mobile que conectou com sucesso
      const statusMobile: PareamentoMensagem = {
        tipo: 'STATUS',
        status: 'CONECTADO',
        detalhe: 'Conectado ao computador com sucesso',
        tempoRestanteMs: tempoRestante
      };
      try {
        socket.send(serializarMensagem(statusMobile));
      } catch {}

      // Notifica todos os desktops da sessão em tempo real (UX-DR9)
      const statusDesktop: PareamentoMensagem = {
        tipo: 'STATUS',
        status: 'CONECTADO',
        detalhe: 'Celular conectado',
        tempoRestanteMs: tempoRestante
      };
      this.broadcastParaDesktops(sessao, statusDesktop);
    }

    socket.on('message', (dados: any) => {
      try {
        if (validarSessaoExpirada(sessao.criadoEm, sessao.ttlMs)) {
          this.expirarSessao(token);
          return;
        }

        const texto = typeof dados === 'string' ? dados : dados.toString('utf-8');
        const mensagem = deserializarMensagem(texto);
        if (!mensagem) return;

        if (mensagem.tipo === 'SCAN') {
          // Encaminha a leitura EXCLUSIVAMENTE para os desktops da sessão (AD-6: isolamento absoluto)
          this.broadcastParaDesktops(sessao, mensagem);
        } else if (mensagem.tipo === 'PING') {
          socket.send(serializarMensagem({ tipo: 'PONG' }));
        }
      } catch (err) {
        console.warn('Erro ao processar mensagem no PareamentoHub:', err);
      }
    });

    socket.on('close', () => {
      if (tipoPonta === 'DESKTOP') {
        sessao.desktopSockets.delete(socket);

        // Se não há mais desktops conectados e a sessão ainda está válida, avisa o celular sobre desconexão
        if (sessao.desktopSockets.size === 0 && !validarSessaoExpirada(sessao.criadoEm, sessao.ttlMs)) {
          const desconectadoMsg: PareamentoMensagem = {
            tipo: 'STATUS',
            status: 'DESCONECTADO',
            detalhe: 'Computador desconectado',
            tempoRestanteMs: calcularTempoRestanteMs(sessao.criadoEm, sessao.ttlMs)
          };
          this.broadcastParaMobiles(sessao, desconectadoMsg);
        }
      } else {
        sessao.mobileSockets.delete(socket);

        // Se não há mais celulares conectados e a sessão ainda está válida, avisa desktop sobre desconexão
        if (sessao.mobileSockets.size === 0 && !validarSessaoExpirada(sessao.criadoEm, sessao.ttlMs)) {
          const desconectadoMsg: PareamentoMensagem = {
            tipo: 'STATUS',
            status: 'DESCONECTADO',
            detalhe: 'Celular desconectado',
            tempoRestanteMs: calcularTempoRestanteMs(sessao.criadoEm, sessao.ttlMs)
          };
          this.broadcastParaDesktops(sessao, desconectadoMsg);
        }
      }
    });

    return true;
  }

  private broadcastParaMobiles(sessao: SessaoInterna, msg: PareamentoMensagem): void {
    const payload = serializarMensagem(msg);
    for (const ws of sessao.mobileSockets) {
      try {
        if (ws.readyState === (ws as any).OPEN || ws.readyState === 1) {
          ws.send(payload);
        }
      } catch {}
    }
  }

  private broadcast(sessao: SessaoInterna, msg: PareamentoMensagem): void {
    const payload = serializarMensagem(msg);
    for (const ws of [...sessao.desktopSockets, ...sessao.mobileSockets]) {
      try {
        if (ws.readyState === (ws as any).OPEN || ws.readyState === 1) {
          ws.send(payload);
        }
      } catch {}
    }
  }

  private broadcastParaDesktops(sessao: SessaoInterna, msg: PareamentoMensagem): void {
    const payload = serializarMensagem(msg);
    for (const ws of sessao.desktopSockets) {
      try {
        if (ws.readyState === (ws as any).OPEN || ws.readyState === 1) {
          ws.send(payload);
        }
      } catch {}
    }
  }

  private paraDTO(sessao: SessaoInterna): SessaoPareamentoDTO {
    const expirada = validarSessaoExpirada(sessao.criadoEm, sessao.ttlMs);
    let status: StatusPareamento = 'AGUARDANDO_CELULAR';

    if (expirada) {
      status = 'EXPIRADO';
    } else if (sessao.mobileSockets.size > 0) {
      status = 'CONECTADO';
    }

    return {
      token: sessao.token,
      operacao_id: sessao.operacao_id,
      criadoEm: new Date(sessao.criadoEm).toISOString(),
      expiraEm: new Date(sessao.criadoEm + sessao.ttlMs).toISOString(),
      status,
      tempoRestanteMs: calcularTempoRestanteMs(sessao.criadoEm, sessao.ttlMs),
      celularConectado: sessao.mobileSockets.size > 0
    };
  }

  public limpar(): void {
    for (const sessao of this.sessoes.values()) {
      if (sessao.timerExpira) clearTimeout(sessao.timerExpira);
    }
    this.sessoes.clear();
  }
}

export const pareamentoHub = new PareamentoHub();
