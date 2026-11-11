import { useState, useEffect, useRef, useCallback } from 'react';
import {
  type StatusPareamento,
  type PareamentoMensagem,
  deserializarMensagem,
  serializarMensagem,
  FiltroAntiDuplicacao
} from '@consultorasync/core';
import { VisorLeituraHibrido } from './VisorLeituraHibrido';
import { tocarBipSuave } from '../utils/audio';

export interface LeitorRemotoMobileViewProps {
  token: string;
  onSair?: () => void;
}

export function LeitorRemotoMobileView({ token, onSair }: LeitorRemotoMobileViewProps) {
  const [statusConexao, setStatusConexao] = useState<StatusPareamento | 'RECONECTANDO'>('RECONECTANDO');
  const [ultimoCodigoEnviado, setUltimoCodigoEnviado] = useState<string | null>(null);
  const [contadorEnvios, setContadorEnvios] = useState<number>(0);
  const [feedbackEnvio, setFeedbackEnvio] = useState<string | null>(null);
  const [sessaoExpirada, setSessaoExpirada] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const reconectarTimerRef = useRef<NodeJS.Timeout | null>(null);
  const filtroRef = useRef<FiltroAntiDuplicacao>(new FiltroAntiDuplicacao());

  // Conectar ao WebSocket do pareamento efêmero
  const conectar = useCallback(() => {
    if (sessaoExpirada) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocoloWs = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const urlWs = `${protocoloWs}//${host}/ws/pareamento/${encodeURIComponent(token)}?ponta=mobile`;

    if (isMountedRef.current) {
      setStatusConexao('RECONECTANDO');
    }

    const ws = new WebSocket(urlWs);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isMountedRef.current) {
        setStatusConexao('CONECTADO');
      }
    };

    ws.onmessage = (event) => {
      const msg: PareamentoMensagem | null = deserializarMensagem(event.data.toString());
      if (!msg) return;

      if (msg.tipo === 'STATUS') {
        if (msg.status === 'EXPIRADO') {
          if (isMountedRef.current) {
            setSessaoExpirada(true);
            setStatusConexao('EXPIRADO');
          }
          ws.close();
        } else if (isMountedRef.current) {
          setStatusConexao(msg.status);
        }
      } else if (msg.tipo === 'ERRO' && msg.codigo === 'EXPIRADO') {
        if (isMountedRef.current) {
          setSessaoExpirada(true);
          setStatusConexao('EXPIRADO');
        }
        ws.close();
      }
    };

    ws.onclose = () => {
      if (isMountedRef.current && !sessaoExpirada) {
        setStatusConexao('RECONECTANDO');
        // Tenta reconectar suavemente após 2 segundos
        if (reconectarTimerRef.current) clearTimeout(reconectarTimerRef.current);
        reconectarTimerRef.current = setTimeout(() => {
          if (isMountedRef.current && !sessaoExpirada) {
            conectar();
          }
        }, 2000);
      }
    };

    ws.onerror = (err) => {
      console.warn('Erro no WebSocket do celular:', err);
    };
  }, [token, sessaoExpirada]);

  useEffect(() => {
    isMountedRef.current = true;
    conectar();

    return () => {
      isMountedRef.current = false;
      if (reconectarTimerRef.current) clearTimeout(reconectarTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [conectar]);

  // Handler acionado quando a câmera lê um código de barras
  const handleCodigoLido = useCallback(
    (codigoBruto: string) => {
      if (sessaoExpirada) return;

      const resultado = filtroRef.current.processar(codigoBruto);
      if (!resultado.aceito) {
        // Bloqueado pelo filtro de 1,5s do domínio (FR-009)
        return;
      }

      tocarBipSuave();

      const mensagem: PareamentoMensagem = {
        tipo: 'SCAN',
        codigo: resultado.codigo,
        timestamp: new Date().toISOString()
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(serializarMensagem(mensagem));
        if (isMountedRef.current) {
          setUltimoCodigoEnviado(resultado.codigo);
          setContadorEnvios((c) => c + 1);
          setFeedbackEnvio(`✓ Enviado ao computador: ${resultado.codigo}`);
          setTimeout(() => {
            if (isMountedRef.current) setFeedbackEnvio(null);
          }, 3000);
        }
      } else {
        if (isMountedRef.current) {
          setFeedbackEnvio(`⚠️ Computador desconectado. Reconectando...`);
        }
      }
    },
    [sessaoExpirada]
  );

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary flex flex-col justify-between">
      {/* Barra de Status Superior Minimalista e Acolhedora */}
      <header className="bg-surface-raised border-b border-border-hairline p-3 shadow-sm sticky top-0 z-20">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📱</span>
            <div>
              <h1 className="text-label-strong font-bold text-ink-primary leading-tight">
                Leitor Sem Fio
              </h1>
              <p className="text-meta text-ink-secondary">Transmissor do Computador</p>
            </div>
          </div>

          {/* Indicador de Status Visual Transparente (UX-DR9) */}
          <div>
            {sessaoExpirada || statusConexao === 'EXPIRADO' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-meta font-bold bg-status-alert-bg text-status-alert border border-status-alert">
                <span className="w-2 h-2 rounded-full bg-status-alert" />
                Sessão Expirada
              </span>
            ) : statusConexao === 'CONECTADO' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-meta font-bold bg-status-available-bg text-status-available border border-status-available animate-pulse">
                <span className="w-2 h-2 rounded-full bg-status-available" />
                Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-meta font-bold bg-status-reserved-bg text-status-reserved border border-status-reserved">
                <span className="w-2 h-2 rounded-full bg-status-reserved animate-ping" />
                Reconectando...
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo Principal do Leitor Remoto */}
      <main className="max-w-md mx-auto w-full p-4 flex-1 flex flex-col gap-4">
        {sessaoExpirada ? (
          <div className="bg-surface-raised border border-status-alert/30 rounded-xl p-6 text-center shadow-sm flex flex-col items-center gap-4 my-auto">
            <span className="text-5xl text-status-alert">⏰</span>
            <h2 className="text-title-lg font-bold text-ink-primary">
              Sessão Expirada no Computador
            </h2>
            <p className="text-body-md text-ink-secondary leading-relaxed">
              O tempo de pareamento de 10 minutos encerrou por segurança.
            </p>
            <div className="p-4 bg-surface-sunken rounded-lg text-body-md text-ink-primary border border-border-hairline">
              👉 Toque em <strong>"Renovar Sessão em 1 Toque"</strong> na tela do seu computador para continuar usando o leitor.
            </div>

            <div className="flex flex-col gap-2 w-full mt-2">
              <button
                type="button"
                onClick={() => {
                  setSessaoExpirada(false);
                  setStatusConexao('RECONECTANDO');
                  conectar();
                }}
                className="min-h-touch-target px-6 bg-brand-primary hover:bg-brand-hover text-ink-inverse font-bold text-label-strong rounded-md transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                🔄 Tentar Reconectar Agora
              </button>

              {onSair && (
                <button
                  type="button"
                  onClick={onSair}
                  className="min-h-touch-target px-6 bg-surface-raised border border-border-strong text-ink-primary font-semibold text-label-strong rounded-md hover:bg-surface-sunken"
                >
                  Voltar ao Início
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Banner de Feedback em Tempo Real de Envio */}
            {feedbackEnvio && (
              <div className="bg-status-available-bg border border-status-available text-status-available p-3 rounded-lg text-body-md font-semibold text-center shadow-sm animate-fade-in">
                {feedbackEnvio}
              </div>
            )}

            {/* Visor de Leitura Híbrido com Câmera Auto-iniciada (Zero Cliques) */}
            <div className="flex-1 flex flex-col">
              <VisorLeituraHibrido
                onCodigoLido={handleCodigoLido}
                autoStart={true}
                placeholderManual="Ou digite o código de barras manualmente..."
              />
            </div>

            {/* Contador de Transmissões Bem-sucedidas */}
            <div className="bg-surface-raised border border-border-hairline rounded-lg p-3 flex items-center justify-between text-body-md shadow-sm">
              <span className="text-ink-secondary">Códigos transmitidos:</span>
              <span className="font-bold text-brand-primary text-title-md">
                {contadorEnvios} {contadorEnvios === 1 ? 'item' : 'itens'}
              </span>
            </div>

            {ultimoCodigoEnviado && (
              <div className="p-3 bg-brand-subtle border border-brand-primary/20 rounded-lg text-center">
                <span className="text-meta text-brand-primary font-semibold uppercase">Último código enviado:</span>
                <p className="text-title-md font-mono font-bold text-ink-primary">{ultimoCodigoEnviado}</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Rodapé de Segurança e Rastreabilidade */}
      <footer className="bg-surface-raised border-t border-border-hairline p-3 text-center text-meta text-ink-muted">
        <span>🔒 Leitor efêmero isolado • Sem acesso a clientes ou contas financeiras</span>
      </footer>
    </div>
  );
}
