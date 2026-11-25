import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useSessao, type SessaoInfo } from '../app/SessaoContext';
import { apiFetch } from '../lib/api';

const CHAVE_ULTIMO_USUARIO = 'consultorasync_ultimo_usuario';
const MARCAS_PRINCIPAIS = ['Natura', 'O Boticário', 'Eudora'];

interface RespostaSessao {
  token: string;
  session: SessaoInfo;
}

function lerUltimoUsuario(): string {
  try {
    return localStorage.getItem(CHAVE_ULTIMO_USUARIO) ?? '';
  } catch {
    return '';
  }
}

function lembrarUsuario(usuario: string) {
  try {
    localStorage.setItem(CHAVE_ULTIMO_USUARIO, usuario);
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

const classeCampo =
  'w-full min-h-touch-target px-3 rounded-md border border-border-strong bg-surface-base text-body-md focus:outline-none focus:ring-2 focus:ring-brand-primary';

function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-label-strong">{rotulo}</span>
      {children}
      {dica && <span className="text-meta text-ink-muted">{dica}</span>}
    </label>
  );
}

/** Tela de entrada: usuário + PIN no dia a dia, e cadastro do negócio no primeiro acesso. */
export function EntrarPage() {
  const { entrar } = useSessao();
  const [modo, setModo] = useState<'entrar' | 'cadastro'>('entrar');
  const [modoDev, setModoDev] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [usuario, setUsuario] = useState(lerUltimoUsuario);
  const [pin, setPin] = useState('');

  const [nomeNegocio, setNomeNegocio] = useState('');
  const [nome, setNome] = useState('');
  const [novoUsuario, setNovoUsuario] = useState('');
  const [novoPin, setNovoPin] = useState('');
  const [confirmaPin, setConfirmaPin] = useState('');
  const [marcasDisponiveis, setMarcasDisponiveis] = useState<Array<{ marca: string; produtos: number }>>([]);
  const [marcasEscolhidas, setMarcasEscolhidas] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        setModoDev(!!c?.modo_desenvolvimento);
        const marcas: Array<{ marca: string; produtos: number }> = Array.isArray(c?.marcas_iniciais) ? c.marcas_iniciais : [];
        setMarcasDisponiveis(marcas);
        // Já vêm marcadas as marcas principais das revendedoras; as outras ficam à escolha.
        setMarcasEscolhidas(marcas.map((m) => m.marca).filter((m) => MARCAS_PRINCIPAIS.includes(m)));
      })
      .catch(() => undefined);
  }, []);

  const concluir = (r: RespostaSessao, usuarioUsado?: string) => {
    if (usuarioUsado) lembrarUsuario(usuarioUsado);
    entrar(r.token, r.session);
  };

  const executar = async (acao: () => Promise<void>) => {
    setErro(null);
    setEnviando(true);
    try {
      await acao();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const enviarEntrada = (e: FormEvent) => {
    e.preventDefault();
    const u = usuario.trim().toLowerCase();
    executar(async () => {
      const r = await apiFetch<RespostaSessao>('/auth/entrar', null, { method: 'POST', body: JSON.stringify({ usuario: u, pin }) });
      concluir(r, u);
    }).finally(() => setPin(''));
  };

  const enviarCadastro = (e: FormEvent) => {
    e.preventDefault();
    if (novoPin !== confirmaPin) {
      setErro('Os dois PINs não são iguais.');
      return;
    }
    const u = novoUsuario.trim().toLowerCase();
    executar(async () => {
      const r = await apiFetch<RespostaSessao>('/auth/cadastro', null, {
        method: 'POST',
        body: JSON.stringify({ nome_negocio: nomeNegocio, nome, usuario: u, pin: novoPin, marcas_iniciais: marcasEscolhidas })
      });
      concluir(r, u);
    });
  };

  const entrarDemonstracao = () =>
    executar(async () => {
      const r = await apiFetch<RespostaSessao>('/auth/dev-session', null, { method: 'POST' });
      concluir(r);
    });

  const somenteNumeros = (v: string) => v.replace(/\D/g, '').slice(0, 8);

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div className="text-center">
          <p className="text-title-lg font-bold text-brand-primary">ConsultoraSync</p>
          <p className="text-body-md text-ink-secondary">Gestão de revenda</p>
        </div>

        <div className="bg-surface-raised border border-border-hairline rounded-lg p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-surface-sunken" role="tablist">
            {(['entrar', 'cadastro'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={modo === m}
                onClick={() => {
                  setModo(m);
                  setErro(null);
                }}
                className={`min-h-[40px] rounded text-label-strong ${modo === m ? 'bg-surface-raised text-brand-primary shadow-sm' : 'text-ink-secondary'}`}
              >
                {m === 'entrar' ? 'Entrar' : 'Primeiro acesso'}
              </button>
            ))}
          </div>

          {modo === 'entrar' ? (
            <form onSubmit={enviarEntrada} className="flex flex-col gap-3">
              <Campo rotulo="Usuário">
                <input
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus={!usuario}
                  required
                  className={classeCampo}
                />
              </Campo>
              <Campo rotulo="PIN">
                <input
                  value={pin}
                  onChange={(e) => setPin(somenteNumeros(e.target.value))}
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  autoFocus={!!usuario}
                  required
                  minLength={4}
                  className={`${classeCampo} tracking-[0.4em]`}
                />
              </Campo>
              <button
                type="submit"
                disabled={enviando}
                className="min-h-touch-target rounded-md bg-brand-primary hover:bg-brand-hover text-ink-inverse font-semibold disabled:opacity-60"
              >
                {enviando ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
          ) : (
            <form onSubmit={enviarCadastro} className="flex flex-col gap-3">
              <Campo rotulo="Nome do negócio" dica="Como sua revenda aparece no sistema.">
                <input value={nomeNegocio} onChange={(e) => setNomeNegocio(e.target.value)} required className={classeCampo} />
              </Campo>
              <Campo rotulo="Seu nome">
                <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required className={classeCampo} />
              </Campo>
              <Campo rotulo="Usuário" dica="Letras minúsculas, números, ponto ou hífen. Ex.: sonia.revenda">
                <input
                  value={novoUsuario}
                  onChange={(e) => setNovoUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  autoComplete="username"
                  autoCapitalize="none"
                  required
                  minLength={3}
                  className={classeCampo}
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo rotulo="PIN" dica="4 a 8 números">
                  <input
                    value={novoPin}
                    onChange={(e) => setNovoPin(somenteNumeros(e.target.value))}
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    required
                    minLength={4}
                    className={`${classeCampo} tracking-[0.4em]`}
                  />
                </Campo>
                <Campo rotulo="Repita o PIN">
                  <input
                    value={confirmaPin}
                    onChange={(e) => setConfirmaPin(somenteNumeros(e.target.value))}
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    required
                    minLength={4}
                    className={`${classeCampo} tracking-[0.4em]`}
                  />
                </Campo>
              </div>
              {marcasDisponiveis.length > 0 && (
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="text-label-strong">Já começar com os produtos mais vendidos de:</legend>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {marcasDisponiveis.map(({ marca, produtos }) => {
                      const marcada = marcasEscolhidas.includes(marca);
                      return (
                        <label
                          key={marca}
                          className={`flex items-center gap-2 min-h-touch-target px-3 rounded-md border cursor-pointer text-body-md ${
                            marcada ? 'border-brand-primary bg-brand-primary/10' : 'border-border-strong'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={marcada}
                            onChange={() =>
                              setMarcasEscolhidas((atual) => (marcada ? atual.filter((m) => m !== marca) : [...atual, marca]))
                            }
                            className="w-4 h-4 accent-brand-primary"
                          />
                          {marca} <span className="text-meta text-ink-muted">({produtos})</span>
                        </label>
                      );
                    })}
                  </div>
                  <span className="text-meta text-ink-muted">
                    Com foto, código e preço da campanha atual. Dá para apagar ou carregar o catálogo inteiro depois.
                  </span>
                </fieldset>
              )}
              <button
                type="submit"
                disabled={enviando}
                className="min-h-touch-target rounded-md bg-brand-primary hover:bg-brand-hover text-ink-inverse font-semibold disabled:opacity-60"
              >
                {enviando ? (marcasEscolhidas.length > 0 ? 'Criando e carregando produtos…' : 'Criando…') : 'Criar conta e entrar'}
              </button>
            </form>
          )}

          {erro && (
            <p role="alert" className="p-2 rounded-md bg-status-danger-bg text-status-danger text-meta">
              {erro}
            </p>
          )}
        </div>

        {modoDev && (
          <div className="text-center flex flex-col gap-1">
            <button
              type="button"
              onClick={entrarDemonstracao}
              disabled={enviando}
              className="min-h-touch-target rounded-md border border-dashed border-border-strong text-label-strong text-ink-secondary hover:bg-surface-sunken"
            >
              Entrar com a conta de demonstração
            </button>
            <p className="text-meta text-ink-muted">Disponível só no modo desenvolvimento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
