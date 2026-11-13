import { useEffect, useState } from 'react';

/**
 * App instalável (PWA): registra o service worker na versão de produção e
 * expõe o pedido de instalação do navegador para um botão "Instalar".
 * Em `npm run dev` o service worker fica desligado para não guardar código velho.
 */
export function registrarServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

/** Apaga as leituras da API guardadas no aparelho (ao sair ou trocar de conta). */
export function limparDadosOffline() {
  navigator.serviceWorker?.controller?.postMessage('limpar-dados');
}

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// O navegador avisa uma vez só, logo no começo; guardamos para usar quando a tela pedir.
let pedidoGuardado: EventoInstalacao | null = null;
const ouvintes = new Set<() => void>();
const avisarOuvintes = () => ouvintes.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedidoGuardado = e as EventoInstalacao;
    avisarOuvintes();
  });
  window.addEventListener('appinstalled', () => {
    pedidoGuardado = null;
    avisarOuvintes();
  });
}

export type SituacaoInstalacao = 'instalado' | 'disponivel' | 'ios' | 'indisponivel';

function situacaoAtual(): SituacaoInstalacao {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return 'instalado';
  if (pedidoGuardado) return 'disponivel';
  // Safari do iPhone/iPad não tem o pedido automático: a instalação é pelo menu Compartilhar.
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios ? 'ios' : 'indisponivel';
}

export function useInstalacaoApp() {
  const [situacao, setSituacao] = useState<SituacaoInstalacao>(situacaoAtual);

  useEffect(() => {
    const atualizar = () => setSituacao(situacaoAtual());
    ouvintes.add(atualizar);
    return () => {
      ouvintes.delete(atualizar);
    };
  }, []);

  const instalar = async () => {
    if (!pedidoGuardado) return false;
    const pedido = pedidoGuardado;
    await pedido.prompt();
    const { outcome } = await pedido.userChoice;
    pedidoGuardado = null;
    setSituacao(situacaoAtual());
    return outcome === 'accepted';
  };

  return { situacao, instalar };
}
