import { useState, useEffect, useMemo } from 'react';
import type { ClienteDTO } from '../types/cliente';

interface ClientesViewProps {
  onAbrirGaveta: () => void;
  onSelecionarCliente?: (cliente: ClienteDTO) => void;
  clienteRecemCriado?: ClienteDTO | null;
  apiBaseUrl?: string;
  sessionToken?: string;
  onVerFicha: (clienteId: string) => void;
  refreshTrigger?: number;
}

export function ClientesView({
  onAbrirGaveta,
  onSelecionarCliente,
  clienteRecemCriado,
  apiBaseUrl = '/api',
  sessionToken,
  onVerFicha,
  refreshTrigger
}: ClientesViewProps) {
  const [clientes, setClientes] = useState<ClienteDTO[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega ao montar, quando termoBusca mudar (com debounce e cancelamento por AbortController)
  // ou quando refreshTrigger for acionado após edições/exclusões
  useEffect(() => {
    const controller = new AbortController();

    const handler = setTimeout(async () => {
      setCarregando(true);
      setErro(null);

      try {
        const headers: Record<string, string> = {};
        if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

        const queryParam = termoBusca && termoBusca.trim().length > 0
          ? `?busca=${encodeURIComponent(termoBusca.trim())}`
          : '';

        const res = await fetch(`${apiBaseUrl}/clientes${queryParam}`, {
          headers,
          signal: controller.signal
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.detail || 'Erro ao carregar clientes.');
        }

        const data: ClienteDTO[] = await res.json();
        setClientes(data);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setErro(err.message || 'Falha ao buscar clientes.');
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    }, 200);

    return () => {
      clearTimeout(handler);
      controller.abort();
    };
  }, [termoBusca, sessionToken, apiBaseUrl, refreshTrigger]);

  // Se um cliente recém-criado foi passado (ex: via gaveta rápida)
  useEffect(() => {
    if (clienteRecemCriado) {
      setClientes((prev) => {
        const existe = prev.some((c) => c.id === clienteRecemCriado.id);
        if (existe) return prev;
        return [clienteRecemCriado, ...prev];
      });
    }
  }, [clienteRecemCriado]);

  // Clientes filtrados (garante resposta instantânea na interface)
  const clientesFiltrados = useMemo(() => {
    if (!termoBusca.trim()) return clientes;
    const t = termoBusca.trim().toLowerCase();
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(t) ||
        (c.telefone && c.telefone.includes(t)) ||
        (c.telefone_formatado && c.telefone_formatado.toLowerCase().includes(t))
    );
  }, [clientes, termoBusca]);

  const formatarMoeda = (centavos: number) => {
    return (centavos / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Cabeçalho da Lista (S2) */}
      <div className="bg-surface-raised border border-border-hairline rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-title-lg font-bold text-ink-primary">Minhas Clientes</h2>
          <span className="text-meta font-semibold text-brand-primary">
            {clientes.length} {clientes.length === 1 ? 'cadastrada' : 'cadastradas'}
          </span>
        </div>

        <button
          type="button"
          onClick={onAbrirGaveta}
          className="min-h-touch-target px-4 py-2 bg-brand-primary hover:bg-brand-hover text-ink-inverse rounded-md text-label-strong font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <span>+</span> Nova Cliente
        </button>
      </div>

      {/* Campo de Busca Rápida */}
      <div className="relative">
        <input
          type="text"
          value={termoBusca}
          onChange={(e) => setTermoBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full min-h-touch-target px-4 py-2.5 bg-surface-raised border border-border-strong rounded-lg text-body-lg text-ink-primary focus:border-brand-primary focus:outline-none transition-colors shadow-sm placeholder:text-ink-muted"
        />
        {termoBusca && (
          <button
            type="button"
            onClick={() => setTermoBusca('')}
            aria-label="Limpar busca"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-ink-secondary hover:text-ink-primary rounded-full"
          >
            ✕
          </button>
        )}
      </div>

      {/* Mensagem de Erro */}
      {erro && (
        <div className="bg-status-alert-bg border border-status-alert text-status-alert px-3.5 py-2.5 rounded-md text-body-md font-medium">
          {erro}
        </div>
      )}

      {/* Lista de Clientes */}
      <div className="flex flex-col gap-3">
        {carregando && clientes.length === 0 ? (
          <div className="bg-surface-raised border border-border-hairline rounded-lg p-8 text-center text-ink-secondary text-body-md">
            Buscando clientes...
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="bg-surface-raised border border-border-hairline rounded-lg p-8 text-center flex flex-col items-center gap-3">
            <p className="text-body-lg text-ink-secondary font-medium">
              {termoBusca
                ? `Nenhuma cliente encontrada com o termo "${termoBusca}".`
                : 'Você ainda não cadastrou nenhuma cliente.'}
            </p>
            <button
              type="button"
              onClick={onAbrirGaveta}
              className="min-h-touch-target px-5 py-2.5 bg-brand-primary hover:bg-brand-hover text-ink-inverse rounded-md text-label-strong font-semibold transition-colors"
            >
              + Cadastrar Nova Cliente
            </button>
          </div>
        ) : (
          clientesFiltrados.map((cliente) => (
            <div
              key={cliente.id}
              className="bg-surface-raised border border-border-hairline hover:border-brand-primary/40 rounded-lg p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => {
                  if (onSelecionarCliente) {
                    onSelecionarCliente(cliente);
                  } else {
                    onVerFicha(cliente.id);
                  }
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-title-md font-bold text-ink-primary">
                    {cliente.nome}
                  </h3>
                  {cliente.saldo_credito_centavos > 0 && (
                    <span className="text-meta font-semibold px-2 py-0.5 rounded-full bg-status-available-bg text-status-available">
                      Crédito: {formatarMoeda(cliente.saldo_credito_centavos)}
                    </span>
                  )}
                </div>

                {/* Diferenciação de homônimos com telefone e endereço explícitos */}
                <div className="flex items-center gap-3 text-body-md text-ink-secondary mt-1 flex-wrap">
                  {cliente.telefone_formatado || cliente.telefone ? (
                    <span>📞 {cliente.telefone_formatado || cliente.telefone}</span>
                  ) : (
                    <span className="text-ink-muted">Sem telefone</span>
                  )}

                  {cliente.endereco && (
                    <span className="truncate max-w-[200px]">📍 {cliente.endereco}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => onVerFicha(cliente.id)}
                  className="min-h-touch-target px-4 py-2 text-brand-primary hover:bg-brand-subtle font-bold text-label-strong rounded-md transition-colors flex items-center gap-1"
                >
                  Ver Ficha →
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
