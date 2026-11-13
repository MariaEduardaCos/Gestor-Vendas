import { useCallback, useEffect, useState } from 'react';
import { useSessao } from '../app/SessaoContext';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Chamada à API com token da sessão e mensagem de erro amigável (Problem Details). */
export async function apiFetch<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const res = await fetch(path.startsWith('/api') ? path : `/api${path}`, { ...init, headers });
  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    throw new ApiError(corpo?.detail || corpo?.title || 'Não foi possível concluir a operação.', res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/**
 * Carrega dados de um endpoint GET e recarrega automaticamente quando
 * qualquer formulário do sistema registra uma alteração (versaoDados).
 */
export function useApiGet<T>(path: string | null) {
  const { token, versaoDados } = useSessao();
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!path || !token) return;
    let ativo = true;
    setCarregando(true);
    apiFetch<T>(path, token)
      .then((d) => {
        if (!ativo) return;
        setDados(d);
        setErro(null);
      })
      .catch((e: Error) => ativo && setErro(e.message))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [path, token, versaoDados, recarga]);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);
  return { dados, carregando, erro, recarregar };
}

export function formatarReais(centavos: number | null | undefined): string {
  return ((centavos ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Baixa um arquivo da API (com o token da sessão) e entrega ao navegador para salvar. */
export async function baixarArquivo(path: string, token: string | null): Promise<string> {
  const res = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    const corpo = await res.json().catch(() => null);
    throw new ApiError(corpo?.detail || corpo?.title || 'Não foi possível baixar o arquivo.', res.status);
  }
  const nome = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'exportacao';
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return nome;
}
