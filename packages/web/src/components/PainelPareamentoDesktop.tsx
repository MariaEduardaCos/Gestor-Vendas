import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  type StatusPareamento,
  type SessaoPareamentoDTO,
  type PareamentoMensagem,
  deserializarMensagem
} from '@consultorasync/core';
import { tocarBipSuave } from '../utils/audio';

export interface PainelPareamentoDesktopProps {
  sessionToken?: string;
  onCodigoLido: (codigo: string) => void;
  className?: string;
}

export function PainelPareamentoDesktop({
  sessionToken,
  onCodigoLido,
  className = ''
}: PainelPareamentoDesktopProps) {
  const [sessao, setSessao] = useState<SessaoPareamentoDTO | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusPareamento>('AGUARDANDO_CELULAR');
  const [tempoRestanteMs, setTempoRestanteMs] = useState<number>(600_000);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimoCodigoBipado, setUltimoCodigoBipado] = useState<string | null>(null);
  const [bipsRecebidosCount, setBipsRecebidosCount] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Helper para formatar milissegundos em MM:SS
  const formatarTempo = (ms: number): string => {
    if (ms <= 0) return '00:00';
    const totalSegundos = Math.floor(ms / 1000);
    const minutos = Math.floor(totalSegundos / 60);
    const segundos = totalSegundos % 60;
    return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
  };

  // Conectar WebSocket desktop
  const conectarWs = useCallback((token: string) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocoloWs = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const urlWs = `${protocoloWs}//${host}/ws/pareamento/${encodeURIComponent(token)}?ponta=desktop`;

    const ws = new WebSocket(urlWs);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg: PareamentoMensagem | null = deserializarMensagem(event.data.toString());
      if (!msg) return;

      if (msg.tipo === 'STATUS') {
        if (isMountedRef.current) {
          setStatus(msg.status);
          if (typeof msg.tempoRestanteMs === 'number') {
            setTempoRestanteMs(msg.tempoRestanteMs);
          }
        }
      } else if (msg.tipo === 'SCAN') {
        tocarBipSuave();
        if (isMountedRef.current) {
          setUltimoCodigoBipado(msg.codigo);
          setBipsRecebidosCount((c) => c + 1);
        }
        onCodigoLido(msg.codigo);
      }
    };

    ws.onclose = () => {
      if (isMountedRef.current && statusRef.current !== 'EXPIRADO') {
        // Se a sessão ainda não expirou, atualiza para desconectado
        setStatus((s) => (s === 'CONECTADO' ? 'DESCONECTADO' : s));
      }
    };

    ws.onerror = (err) => {
      console.warn('Erro na conexão WebSocket desktop:', err);
    };
  }, [onCodigoLido]);

  // Criar ou inicializar pareamento
  const iniciarPareamento = useCallback(async () => {
    setCarregando(true);
    setErro(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch('/api/pareamento/criar', {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });

      if (!res.ok) {
        throw new Error('Não foi possível gerar a sessão de pareamento no servidor.');
      }

      const dados: SessaoPareamentoDTO = await res.json();
      if (!isMountedRef.current) return;

      setSessao(dados);
      setStatus(dados.status);
      setTempoRestanteMs(dados.tempoRestanteMs);

      // Gera imagem do QR Code a partir da URL retornada
      const urlAlvo = dados.urlPareamento || `${window.location.origin}/?leitor_token=${encodeURIComponent(dados.token)}`;
      const qrDataUrl = await QRCode.toDataURL(urlAlvo, {
        width: 240,
        margin: 2,
        color: {
          dark: '#1F1E1C',
          light: '#FFFFFF'
        }
      });

      if (isMountedRef.current) {
        setQrCodeDataUrl(qrDataUrl);
        conectarWs(dados.token);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setErro(err.message || 'Falha ao conectar com o serviço de pareamento.');
      }
    } finally {
      if (isMountedRef.current) {
        setCarregando(false);
      }
    }
  }, [sessionToken, conectarWs]);

  // Renovar sessão em 1 toque
  const handleRenovar = async () => {
    setCarregando(true);
    setErro(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch('/api/pareamento/renovar', {
        method: 'POST',
        headers,
        body: JSON.stringify({ token: sessao?.token })
      });

      if (!res.ok) {
        throw new Error('Falha ao renovar a sessão de pareamento.');
      }

      const dados: SessaoPareamentoDTO = await res.json();
      if (!isMountedRef.current) return;

      setSessao(dados);
      setStatus(dados.status);
      setTempoRestanteMs(dados.tempoRestanteMs);

      const urlAlvo = dados.urlPareamento || `${window.location.origin}/?leitor_token=${encodeURIComponent(dados.token)}`;
      const qrDataUrl = await QRCode.toDataURL(urlAlvo, {
        width: 240,
        margin: 2,
        color: {
          dark: '#1F1E1C',
          light: '#FFFFFF'
        }
      });

      if (isMountedRef.current) {
        setQrCodeDataUrl(qrDataUrl);
        conectarWs(dados.token);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setErro(err.message || 'Erro ao renovar a sessão.');
      }
    } finally {
      if (isMountedRef.current) {
        setCarregando(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    iniciarPareamento();

    return () => {
      isMountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [iniciarPareamento]);

  // Contador regressivo de tempo restante sincronizado com o servidor (sem drift de clock)
  useEffect(() => {
    if (!sessao?.expiraEm) return;
    const expiraEmMs = new Date(sessao.expiraEm).getTime();

    const atualizar = () => {
      const agora = Date.now();
      const restante = Math.max(0, expiraEmMs - agora);
      setTempoRestanteMs(restante);
      if (restante <= 0) {
        setStatus('EXPIRADO');
      }
    };

    atualizar();
    const intervalo = setInterval(atualizar, 1000);

    return () => clearInterval(intervalo);
  }, [sessao?.expiraEm]);

  return (
    <div className={`bg-surface-raised border border-border-hairline rounded-lg p-5 shadow-sm flex flex-col gap-5 ${className}`}>
      {/* Cabeçalho do Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-hairline pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-title-md">📱</span>
            <h3 className="text-title-md font-bold text-ink-primary">
              Parear Celular como Leitor Sem Fio
            </h3>
          </div>
          <p className="text-body-md text-ink-secondary mt-1">
            Transforme a câmera do seu celular em um leitor ótico imediato, sem digitar senhas.
          </p>
        </div>

        {/* Pílula Semântica de Status Visual (UX-DR9) */}
        <div className="flex items-center gap-2">
          {status === 'CONECTADO' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-strong bg-status-available-bg text-status-available border border-status-available">
              <span className="w-2.5 h-2.5 rounded-full bg-status-available animate-pulse" />
              Celular Conectado
            </span>
          ) : status === 'DESCONECTADO' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-strong bg-status-reserved-bg text-status-reserved border border-status-reserved">
              <span className="w-2.5 h-2.5 rounded-full bg-status-reserved animate-ping" />
              Celular Desconectado
            </span>
          ) : status === 'EXPIRADO' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-strong bg-status-alert-bg text-status-alert border border-status-alert">
              <span className="w-2.5 h-2.5 rounded-full bg-status-alert" />
              Sessão Expirada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-strong bg-status-reserved-bg text-status-reserved border border-status-reserved">
              <span className="w-2.5 h-2.5 rounded-full bg-status-reserved animate-pulse" />
              Aguardando Leitura do QR Code
            </span>
          )}
        </div>
      </div>

      {/* Erro acolhedor com botão de tentar novamente */}
      {erro && (
        <div className="bg-status-alert-bg border border-status-alert text-status-alert p-3 rounded-lg text-body-md flex items-center justify-between">
          <span>⚠️ {erro}</span>
          <button
            type="button"
            onClick={iniciarPareamento}
            className="text-label-strong underline hover:text-ink-primary ml-2 min-h-[44px] px-2"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Corpo Central: QR Code + Instruções Passo a Passo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Lado Esquerdo: Imagem QR Code Nítida ou Feedback de Expirado */}
        <div className="flex flex-col items-center justify-center p-4 bg-surface-sunken border border-border-hairline rounded-lg text-center min-h-[280px]">
          {carregando ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-body-md text-ink-secondary">Gerando conexão segura efêmera...</p>
            </div>
          ) : status === 'EXPIRADO' ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <span className="text-3xl text-status-alert">⏰</span>
              <h4 className="text-title-md font-bold text-ink-primary">
                Sessão de Pareamento Expirou
              </h4>
              <p className="text-body-md text-ink-secondary max-w-xs">
                O token de segurança expira a cada 10 minutos para proteger sua operação. Clique abaixo para reativar em 1 toque.
              </p>
              <button
                type="button"
                onClick={handleRenovar}
                className="min-h-touch-target px-6 bg-brand-primary hover:bg-brand-hover text-ink-inverse font-bold text-label-strong rounded-md shadow-sm transition-colors flex items-center gap-2"
              >
                <span>🔄</span> Renovar Sessão em 1 Toque
              </button>
            </div>
          ) : qrCodeDataUrl ? (
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 bg-white border border-border-strong rounded-xl shadow-sm">
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code de Pareamento do Celular"
                  className="w-48 h-48 md:w-56 md:h-56 object-contain"
                />
              </div>
              <div className="flex items-center gap-2 text-meta text-ink-secondary">
                <span>Expira em:</span>
                <span className="font-mono font-bold text-brand-primary text-body-md">
                  {formatarTempo(tempoRestanteMs)}
                </span>
                <button
                  type="button"
                  onClick={handleRenovar}
                  className="text-brand-primary font-bold hover:underline ml-2"
                  title="Renovar mais 10 minutos"
                >
                  (Renovar)
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Lado Direito: Instruções Claras para Dona Sônia */}
        <div className="flex flex-col gap-4">
          <h4 className="text-title-md font-bold text-ink-primary">
            Passo a passo simples:
          </h4>
          <ol className="flex flex-col gap-3 text-body-md text-ink-secondary list-decimal list-inside">
            <li className="leading-relaxed">
              <strong className="text-ink-primary">Abra a câmera normal</strong> do seu celular (ou leitor de QR Code).
            </li>
            <li className="leading-relaxed">
              <strong className="text-ink-primary">Aponte para o QR Code</strong> ao lado até aparecer o link.
            </li>
            <li className="leading-relaxed">
              <strong className="text-ink-primary">Toque no link</strong>: a câmera abrirá na hora em tela cheia, <span className="text-brand-primary font-semibold">sem pedir login ou senhas</span>.
            </li>
            <li className="leading-relaxed">
              <strong className="text-ink-primary">Passe os frascos na câmera do celular</strong>: o bip soa e o produto aparece imediatamente nesta tela do computador!
            </li>
          </ol>

          {/* Feedback de Bipagem Recebida */}
          {ultimoCodigoBipado && (
            <div className="mt-2 p-3 bg-status-available-bg border border-status-available rounded-md flex items-center justify-between">
              <div>
                <span className="text-meta text-status-available font-semibold uppercase">Último Código Bipado no Celular:</span>
                <p className="text-title-md font-mono font-bold text-ink-primary">{ultimoCodigoBipado}</p>
              </div>
              <span className="text-label-strong text-status-available bg-white px-2 py-1 rounded border border-status-available/30">
                {bipsRecebidosCount} {bipsRecebidosCount === 1 ? 'leitura' : 'leituras'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
