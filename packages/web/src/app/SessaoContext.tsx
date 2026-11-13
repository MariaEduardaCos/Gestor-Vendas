import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const CHAVE_TOKEN = 'consultorasync_session_token';

export interface SessaoInfo {
  operador_id: string;
  operador_nome: string;
  operacao_id: string;
  usuario?: string | null;
  possui_pin?: boolean;
}

/** verificando: conferindo o token guardado; anonima: precisa entrar; conectada: sessão válida. */
export type EstadoSessao = 'verificando' | 'anonima' | 'conectada';

interface SessaoContextValue {
  token: string | null;
  sessao: SessaoInfo | null;
  estado: EstadoSessao;
  /** Incrementado sempre que algum formulário altera dados; telas abertas recarregam. */
  versaoDados: number;
  notificarAlteracao: () => void;
  /** Guarda a sessão devolvida pelo login ou cadastro. */
  entrar: (token: string, sessao: SessaoInfo) => void;
  /** Recarrega os dados da sessão (ex.: depois de trocar usuário ou PIN). */
  atualizarSessao: () => void;
  sair: () => void;
}

const SessaoContext = createContext<SessaoContextValue | null>(null);

function lerToken(): string | null {
  try {
    return localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

function gravarToken(t: string | null) {
  try {
    if (t) localStorage.setItem(CHAVE_TOKEN, t);
    else localStorage.removeItem(CHAVE_TOKEN);
  } catch {
    /* armazenamento indisponível: sessão vale só nesta aba */
  }
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(lerToken);
  const [sessao, setSessao] = useState<SessaoInfo | null>(null);
  const [estado, setEstado] = useState<EstadoSessao>(() => (lerToken() ? 'verificando' : 'anonima'));
  const [versaoDados, setVersaoDados] = useState(0);
  const [recarga, setRecarga] = useState(0);

  // Confere o token guardado no aparelho; se o servidor recusar, volta para a tela de entrada.
  useEffect(() => {
    if (!token) {
      setEstado('anonima');
      return;
    }
    let ativo = true;
    fetch('/api/auth/session', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!ativo) return;
        if (res.ok) {
          setSessao(await res.json());
          setEstado('conectada');
        } else if (res.status === 401) {
          gravarToken(null);
          setToken(null);
          setSessao(null);
          setEstado('anonima');
        }
      })
      .catch(() => {
        // Servidor fora do ar: mantém o token e tenta de novo na próxima carga.
        if (ativo) setEstado((e) => (e === 'verificando' ? 'anonima' : e));
      });
    return () => {
      ativo = false;
    };
  }, [token, recarga]);

  const entrar = useCallback((novoToken: string, info: SessaoInfo) => {
    gravarToken(novoToken);
    setSessao(info);
    setEstado('conectada');
    setToken(novoToken);
  }, []);

  const sair = useCallback(() => {
    const atual = lerToken();
    if (atual) {
      fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${atual}` } }).catch(() => undefined);
    }
    gravarToken(null);
    setToken(null);
    setSessao(null);
    setEstado('anonima');
  }, []);

  const notificarAlteracao = useCallback(() => setVersaoDados((v) => v + 1), []);
  const atualizarSessao = useCallback(() => setRecarga((r) => r + 1), []);

  return (
    <SessaoContext.Provider value={{ token, sessao, estado, versaoDados, notificarAlteracao, entrar, atualizarSessao, sair }}>
      {children}
    </SessaoContext.Provider>
  );
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error('useSessao fora do SessaoProvider');
  return ctx;
}
