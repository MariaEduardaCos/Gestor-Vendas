import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const CHAVE_TOKEN = 'consultorasync_session_token';

interface SessaoInfo {
  operador_id: string;
  operador_nome: string;
  operacao_id: string;
}

interface SessaoContextValue {
  token: string | null;
  sessao: SessaoInfo | null;
  /** Incrementado sempre que algum formulário altera dados; telas abertas recarregam. */
  versaoDados: number;
  notificarAlteracao: () => void;
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

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(lerToken);
  const [sessao, setSessao] = useState<SessaoInfo | null>(null);
  const [versaoDados, setVersaoDados] = useState(0);

  const guardarToken = (t: string | null) => {
    setToken(t);
    try {
      if (t) localStorage.setItem(CHAVE_TOKEN, t);
      else localStorage.removeItem(CHAVE_TOKEN);
    } catch {
      /* armazenamento indisponível: sessão vale só nesta aba */
    }
  };

  // TODO(login): substituir a sessão de desenvolvimento por login com operador e PIN.
  useEffect(() => {
    let ativo = true;
    const iniciarSessaoDev = async () => {
      const res = await fetch('/api/auth/dev-session', { method: 'POST' });
      const dados = res.ok ? await res.json() : null;
      if (ativo && dados?.token) {
        guardarToken(dados.token);
        setSessao(dados.session);
      }
    };

    if (!token) {
      iniciarSessaoDev().catch(() => undefined);
      return;
    }

    fetch('/api/auth/session', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!ativo) return;
        if (res.ok) setSessao(await res.json());
        else guardarToken(null); // token expirado (ex.: servidor reiniciado)
      })
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [token]);

  const notificarAlteracao = useCallback(() => setVersaoDados((v) => v + 1), []);
  const sair = useCallback(() => {
    guardarToken(null);
    setSessao(null);
  }, []);

  return (
    <SessaoContext.Provider value={{ token, sessao, versaoDados, notificarAlteracao, sair }}>
      {children}
    </SessaoContext.Provider>
  );
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error('useSessao fora do SessaoProvider');
  return ctx;
}
