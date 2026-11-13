import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { FiltroAntiDuplicacao } from '@consultorasync/core';
import { tocarBipSuave } from '../utils/audio';

export interface VisorLeituraHibridoProps {
  onCodigoLido: (codigo: string) => void;
  autoStart?: boolean;
  pausado?: boolean;
  emiteSom?: boolean;
  placeholderManual?: string;
  className?: string;
}

export function VisorLeituraHibrido({
  onCodigoLido,
  autoStart = true,
  pausado = false,
  emiteSom = true,
  placeholderManual = 'Digite o código de barras ou nome do produto...',
  className = ''
}: VisorLeituraHibridoProps) {
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [cameraErro, setCameraErro] = useState<string | null>(null);
  const [iniciandoCamera, setIniciandoCamera] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [somHabilitado, setSomHabilitado] = useState(emiteSom);
  const [ultimoCodigoLido, setUltimoCodigoLido] = useState<string | null>(null);
  const [feedbackVisual, setFeedbackVisual] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const filtroRef = useRef<FiltroAntiDuplicacao>(new FiltroAntiDuplicacao());
  const inputManualRef = useRef<HTMLInputElement | null>(null);
  const containerId = useRef(`visor-qr-${Math.random().toString(36).substring(2, 9)}`);
  const isMountedRef = useRef(true);
  const cameraAtivaRef = useRef(false);
  const iniciandoRef = useRef(false);
  const pausadoRef = useRef(pausado);

  useEffect(() => {
    pausadoRef.current = pausado;
  }, [pausado]);

  // Handler de leitura que aplica o debounce de 1,5s do domínio (FR-009, UX-DR2)
  const processarCodigoCapturado = useCallback(
    (codigoBruto: string, _origem: 'CAMERA' | 'MANUAL' = 'CAMERA') => {
      if (pausadoRef.current) return;

      const resultado = filtroRef.current.processar(codigoBruto);

      if (!resultado.aceito) {
        // Se bloqueado pelo debounce (mesmo código em < 1,5s), ignora silenciosamente
        return;
      }

      if (somHabilitado) {
        tocarBipSuave();
      }

      if (isMountedRef.current) {
        setUltimoCodigoLido(resultado.codigo);
        setFeedbackVisual(`✓ Código ${resultado.codigo} capturado com sucesso!`);
        setTimeout(() => {
          if (isMountedRef.current) setFeedbackVisual(null);
        }, 2500);
      }

      onCodigoLido(resultado.codigo);
    },
    [somHabilitado, onCodigoLido]
  );

  // Parar scanner
  const pararScanner = useCallback(async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }
    } catch (err) {
      console.warn('Visor: Erro ao parar câmera:', err);
    } finally {
      cameraAtivaRef.current = false;
      if (isMountedRef.current) {
        setCameraAtiva(false);
      }
    }
  }, []);

  // Iniciar scanner contínuo com fallback para qualquer câmera (laptop ou mobile)
  const iniciarScanner = useCallback(async () => {
    if (cameraAtivaRef.current || iniciandoRef.current || pausadoRef.current) return;

    iniciandoRef.current = true;
    if (isMountedRef.current) {
      setIniciandoCamera(true);
      setCameraErro(null);
    }

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(containerId.current, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE
          ],
          verbose: false
        });
      }

      const qrCode = html5QrCodeRef.current;

      const qrConfig = {
        fps: 12,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const width = Math.floor(minEdge * 0.9);
          const height = Math.floor(width * 0.55);
          return { width: Math.max(width, 240), height: Math.max(height, 140) };
        },
        aspectRatio: 1.333333
      };

      const onScanSuccess = (decodedText: string) => {
        processarCodigoCapturado(decodedText, 'CAMERA');
      };

      const onScanFailure = () => {
        // Frames intermediários sem decodificação são descartados silenciosamente
      };

      // Tenta primeiro câmera traseira/ambiente (mobile), com fallback para frontal/webcam se falhar
      try {
        await qrCode.start({ facingMode: 'environment' }, qrConfig, onScanSuccess, onScanFailure);
      } catch (cameraAmbienteErr) {
        console.info('Visor: Câmera traseira indisponível, tentando qualquer câmera disponível...', cameraAmbienteErr);
        await qrCode.start({ facingMode: 'user' }, qrConfig, onScanSuccess, onScanFailure);
      }

      if (!isMountedRef.current || pausadoRef.current) {
        // Se desmontou durante o start(), para imediatamente
        if (qrCode.isScanning) {
          await qrCode.stop();
        }
        return;
      }

      cameraAtivaRef.current = true;
      setCameraAtiva(true);
    } catch (err: any) {
      console.warn('Visor: Câmera não pôde ser iniciada:', err);
      if (isMountedRef.current) {
        setCameraErro(
          'A câmera está desligada ou não autorizada. Você pode digitar o código ou o nome do produto no campo abaixo sem problemas.'
        );
        setCameraAtiva(false);
        inputManualRef.current?.focus();
      }
    } finally {
      iniciandoRef.current = false;
      if (isMountedRef.current) {
        setIniciandoCamera(false);
      }
    }
  }, [processarCodigoCapturado]);

  // Ciclo de montagem e controle por autoStart e pausado
  useEffect(() => {
    isMountedRef.current = true;

    if (autoStart && !pausado) {
      iniciarScanner();
    } else {
      pararScanner();
    }

    return () => {
      isMountedRef.current = false;
      pararScanner();
    };
  }, [autoStart, pausado, iniciarScanner, pararScanner]);

  // Sem <form>: o leitor fica dentro dos formulários de venda e encomenda, e um formulário
  // dentro de outro fazia o Enter recarregar a página ou enviar a venda.
  const handleSubmitManual = () => {
    const codigoLimpo = codigoManual.trim();
    if (!codigoLimpo) return;

    // Reseta debounce do filtro para submissões manuais explícitas do usuário
    filtroRef.current.resetar();
    processarCodigoCapturado(codigoLimpo, 'MANUAL');
    setCodigoManual('');
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Metade Superior: Visor de Vídeo com Auto-Start */}
      <div className="relative bg-surface-sunken border border-border-hairline rounded-lg overflow-hidden shadow-inner flex flex-col items-center justify-center min-h-[260px]">
        {/* Contêiner de renderização da câmera via html5-qrcode */}
        <div
          id={containerId.current}
          className={`w-full min-h-[260px] ${cameraAtiva ? 'block' : 'opacity-0 pointer-events-none absolute inset-0'}`}
        />

        {/* Retículo de Mira & Dica Visual sobre o visor quando a câmera estiver ativa */}
        {cameraAtiva && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-3">
            <div className="bg-ink-primary/75 text-ink-inverse text-meta px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-status-available animate-ping" />
              <span>Câmera contínua ativa • Aproxime o código</span>
            </div>

            {/* Moldura guia visual para o código de barras */}
            <div className="w-[80%] max-w-[280px] h-28 border-2 border-brand-primary/80 rounded-lg relative flex items-center justify-center shadow-lg">
              <div className="w-full h-0.5 bg-brand-primary/60 animate-pulse" />
            </div>

            <div className="text-meta text-ink-inverse bg-ink-primary/70 px-2 py-0.5 rounded backdrop-blur-sm">
              Passar e bipar (filtro 1,5s ativo)
            </div>
          </div>
        )}

        {/* Estado quando a câmera está carregando/iniciando */}
        {iniciandoCamera && (
          <div className="flex flex-col items-center justify-center p-6 text-center gap-2">
            <span className="text-2xl animate-spin">⏳</span>
            <p className="text-body-md font-semibold text-ink-primary">Iniciando visor da câmera...</p>
            <p className="text-meta text-ink-secondary">Zero cliques • Conectando lente</p>
          </div>
        )}

        {/* Estado acolhedor quando a câmera foi negada ou falhou (UX State Pattern / FR-007) */}
        {!iniciandoCamera && !cameraAtiva && (
          <div className="p-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-brand-subtle flex items-center justify-center text-2xl">
              📷
            </div>
            <p className="text-body-md font-medium text-ink-primary max-w-xs leading-relaxed">
              {cameraErro || 'A câmera está pausada no momento.'}
            </p>
            <button
              type="button"
              onClick={() => iniciarScanner()}
              className="min-h-touch-target px-5 bg-brand-primary hover:bg-brand-hover text-ink-inverse font-semibold text-label-strong rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <span>▶</span> Ligar Câmera Novamente
            </button>
          </div>
        )}

        {/* Feedback visual de código capturado */}
        {feedbackVisual && (
          <div className="absolute top-2 inset-x-2 z-20 bg-status-available text-ink-inverse text-body-md font-bold px-3 py-2 rounded-md shadow-md text-center transition-all animate-fade-in">
            {feedbackVisual}
          </div>
        )}
      </div>

      {/* Controles de Apoio do Visor (Feedback Sonoro e Status) */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => setSomHabilitado((prev) => !prev)}
          className="text-meta font-semibold text-ink-secondary hover:text-ink-primary flex items-center gap-1.5 py-1 px-2 rounded hover:bg-surface-sunken transition-colors min-h-[36px]"
          title="Alternar som do bip"
        >
          <span>{somHabilitado ? '🔔 Som do Bip: Ligado' : '🔕 Som do Bip: Mudo'}</span>
        </button>

        {cameraAtiva ? (
          <button
            type="button"
            onClick={() => pararScanner()}
            className="text-meta font-semibold text-brand-primary hover:underline py-1 px-2 min-h-[36px]"
          >
            Pausar Câmera
          </button>
        ) : (
          <button
            type="button"
            onClick={() => iniciarScanner()}
            className="text-meta font-semibold text-brand-primary hover:underline py-1 px-2 min-h-[36px]"
          >
            Ativar Câmera
          </button>
        )}
      </div>

      {/* Metade Inferior: Campo Manual de Digitação de Fallback Sempre Acessível (FR-007, NFR-004) */}
      <div className="bg-surface-raised border border-border-hairline rounded-lg p-3 shadow-sm flex flex-col gap-2">
        <label htmlFor="input-leitura-manual" className="text-label-strong text-ink-primary block">
          Digitação Manual ou Leitor Externo:
        </label>
        <div className="flex gap-2">
          <input
            id="input-leitura-manual"
            ref={inputManualRef}
            type="text"
            enterKeyHint="search"
            value={codigoManual}
            onChange={(e) => setCodigoManual(e.target.value)}
            onKeyDown={(e) => {
              // Leitor USB "digita" o código e aperta Enter
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmitManual();
              }
            }}
            placeholder={placeholderManual}
            className="flex-1 min-h-touch-target px-3.5 py-2.5 rounded-md border border-border-strong bg-surface-base text-ink-primary text-body-md focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary shadow-inner"
          />
          <button
            type="button"
            onClick={handleSubmitManual}
            disabled={!codigoManual.trim()}
            className="min-h-touch-target px-4 bg-brand-primary hover:bg-brand-hover disabled:opacity-50 text-ink-inverse font-bold text-label-strong rounded-md transition-colors shadow-sm flex items-center justify-center shrink-0"
          >
            Buscar
          </button>
        </div>
        <p className="text-meta text-ink-muted">
          Dica: Você também pode usar um leitor USB ou sem fio pareado.
        </p>
      </div>

      {ultimoCodigoLido && (
        <div className="px-2 text-meta text-ink-secondary">
          Último código capturado: <span className="font-mono font-bold text-ink-primary">{ultimoCodigoLido}</span>
        </div>
      )}
    </div>
  );
}
