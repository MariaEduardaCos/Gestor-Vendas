/**
 * Emissor sonoro de confirmação suave (bip) via Web Audio API nativa (UX-DR2).
 *
 * Utiliza onda senoidal pura em 880Hz (nota Lá5) com decaimento exponencial de 80ms,
 * proporcionando confirmação auditiva acolhedora, imediata e sem latência de rede.
 */

let audioCtx: AudioContext | null = null;
let listenerRegistrado = false;

function desbloquearAudio(): void {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function registrarDesbloqueioGlobal(): void {
  if (typeof window === 'undefined' || listenerRegistrado) return;
  listenerRegistrado = true;

  const opcoes = { once: true, passive: true };
  window.addEventListener('click', desbloquearAudio, opcoes);
  window.addEventListener('touchstart', desbloquearAudio, opcoes);
  window.addEventListener('keydown', desbloquearAudio, opcoes);
}

function obterAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
        registrarDesbloqueioGlobal();
      }
    }

    // Se estiver suspenso por política de autoplay do navegador, tenta retomar
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    return audioCtx;
  } catch {
    return null;
  }
}

export interface OpcoesBip {
  frequenciaHz?: number;
  duracaoMs?: number;
  volumeMaximo?: number;
}

/**
 * Toca um bip suave de confirmação de leitura válida.
 * Não quebra caso o navegador bloqueie áudio ou não suporte Web Audio API.
 */
export function tocarBipSuave(opcoes?: OpcoesBip): void {
  try {
    const ctx = obterAudioContext();
    if (!ctx) return;

    const agora = ctx.currentTime;
    const frequencia = opcoes?.frequenciaHz ?? 880;
    const duracaoSegundos = (opcoes?.duracaoMs ?? 80) / 1000;
    const volume = opcoes?.volumeMaximo ?? 0.18; // Volume confortável para não incomodar

    const oscilador = ctx.createOscillator();
    const ganho = ctx.createGain();

    oscilador.type = 'sine';
    oscilador.frequency.setValueAtTime(frequencia, agora);

    // Envelope sonoro com ataque instantâneo e decaimento exponencial suave
    ganho.gain.setValueAtTime(volume, agora);
    ganho.gain.exponentialRampToValueAtTime(0.0001, agora + duracaoSegundos);

    oscilador.connect(ganho);
    ganho.connect(ctx.destination);

    oscilador.start(agora);
    oscilador.stop(agora + duracaoSegundos);
  } catch (err) {
    // Falhas de áudio devem degradar silenciosamente sem travar o visor operacional
    console.debug('Aviso Web Audio:', err);
  }
}
