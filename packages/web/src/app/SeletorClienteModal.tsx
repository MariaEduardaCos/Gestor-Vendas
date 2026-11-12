import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useSessao } from './SessaoContext';
import type { ClienteDTO } from '../types/cliente';

interface Props {
  titulo: string;
  onEscolher: (cliente: ClienteDTO) => void;
  onNovaCliente: () => void;
  onClose: () => void;
}

/** Escolha rápida da cliente antes de anotar uma encomenda. */
export function SeletorClienteModal({ titulo, onEscolher, onNovaCliente, onClose }: Props) {
  const { token } = useSessao();
  const [busca, setBusca] = useState('');
  const [clientes, setClientes] = useState<ClienteDTO[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = busca.trim() ? `?busca=${encodeURIComponent(busca.trim())}` : '';
      apiFetch<ClienteDTO[]>(`/clientes${q}`, token).then(setClientes).catch(() => setClientes([]));
    }, 200);
    return () => clearTimeout(t);
  }, [busca, token]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-primary/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface-raised rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-3 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={titulo}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-title-md font-bold">{titulo}</h2>
          <button type="button" onClick={onClose} className="min-w-touch-target min-h-touch-target text-ink-secondary" aria-label="Fechar">
            ✕
          </button>
        </div>
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente pelo nome ou telefone"
          className="min-h-touch-target px-3 rounded-md border border-border-strong bg-surface-base text-body-md"
        />
        <ul className="overflow-y-auto flex flex-col divide-y divide-border-hairline">
          {clientes.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onEscolher(c)}
                className="w-full text-left min-h-touch-target px-2 py-2 hover:bg-surface-sunken rounded"
              >
                <span className="font-semibold">{c.nome}</span>
                {c.telefone_formatado && <span className="block text-meta text-ink-secondary">{c.telefone_formatado}</span>}
              </button>
            </li>
          ))}
          {clientes.length === 0 && <li className="py-4 text-center text-ink-secondary">Nenhuma cliente encontrada.</li>}
        </ul>
        <button
          type="button"
          onClick={onNovaCliente}
          className="min-h-touch-target rounded-md border border-brand-primary text-brand-primary font-semibold"
        >
          + Cadastrar nova cliente
        </button>
      </div>
    </div>
  );
}
