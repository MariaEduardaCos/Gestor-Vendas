import React, { useState, useEffect, useRef } from 'react';
import type { ClienteDTO } from '../types/cliente';

interface ClienteDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onClienteCriado?: (cliente: ClienteDTO) => void;
  apiBaseUrl?: string;
  sessionToken?: string;
}

export function ClienteDrawer({
  isOpen,
  onClose,
  onClienteCriado,
  apiBaseUrl = '/api',
  sessionToken
}: ClienteDrawerProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputNomeRef = useRef<HTMLInputElement>(null);

  // Autofocus imediato no campo Nome ao abrir a gaveta (UX-DR4)
  useEffect(() => {
    if (isOpen) {
      setNome('');
      setTelefone('');
      setErro(null);
      setSalvando(false);
      // Timeout para garantir que o elemento esteja montado e visível
      const timer = setTimeout(() => {
        inputNomeRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Tecla Escape fecha a gaveta
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Máscara progressiva para telefone brasileiro: (XX) XXXX-XXXX (10 dígitos) ou (XX) XXXXX-XXXX (11 dígitos)
  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatado = raw;

    if (raw.length > 2 && raw.length <= 6) {
      formatado = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    } else if (raw.length > 6 && raw.length <= 10) {
      formatado = `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;
    } else if (raw.length === 11) {
      formatado = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7)}`;
    }

    setTelefone(formatado);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = nome.trim();

    if (!nomeLimpo) {
      setErro('Por favor, informe o nome completo da cliente.');
      inputNomeRef.current?.focus();
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`${apiBaseUrl}/clientes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          nome: nomeLimpo,
          telefone: telefone.trim() || null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Erro ao salvar cliente.');
      }

      const clienteCriado: ClienteDTO = await response.json();

      // Notifica o componente hospedeiro sem reiniciar o fluxo
      if (onClienteCriado) {
        onClienteCriado(clienteCriado);
      }

      onClose();
    } catch (err: any) {
      setErro(err.message || 'Não foi possível salvar o cliente. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cadastrar Nova Cliente"
      className="fixed inset-0 z-60 flex flex-col justify-end sm:justify-center sm:p-4 bg-ink-primary/50 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onClose();
      }}
    >
      <div className="w-full max-w-md mx-auto bg-surface-raised rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4 animate-slide-up border-t sm:border border-border-hairline">
        {/* Puxador decorativo (só no celular, onde a tela sobe de baixo) */}
        <div className="w-11 h-1.5 bg-border-strong rounded-full mx-auto sm:hidden" />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <h2 className="text-title-md font-bold text-ink-primary">
            + Cadastrar Nova Cliente
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            aria-label="Fechar gaveta"
            className="w-10 h-10 flex items-center justify-center rounded-full text-ink-secondary hover:bg-surface-sunken text-title-md transition-colors"
          >
            ✕
          </button>
        </div>

        <p className="text-body-md text-ink-secondary leading-relaxed">
          Rápido e simples: você só precisa do nome para já poder registrar encomendas e vendas.
        </p>

        {/* Mensagem de Erro amigável */}
        {erro && (
          <div className="bg-status-alert-bg border border-status-alert text-status-alert px-3 py-2.5 rounded-md text-body-md font-medium">
            {erro}
          </div>
        )}

        {/* Formulário Rápido com 2 Campos */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="drawer-cliente-nome"
              className="text-label-strong text-ink-primary"
            >
              Nome Completo da Cliente <span className="text-brand-primary">*</span>
            </label>
            <input
              id="drawer-cliente-nome"
              ref={inputNomeRef}
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Carla Vizinha"
              disabled={salvando}
              className="min-h-touch-target px-3.5 py-2.5 bg-surface-sunken border border-border-strong rounded-md text-body-lg text-ink-primary focus:bg-surface-raised focus:border-brand-primary focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="drawer-cliente-telefone"
              className="text-label-strong text-ink-primary"
            >
              WhatsApp ou Telefone <span className="text-ink-muted text-meta font-normal">(opcional)</span>
            </label>
            <input
              id="drawer-cliente-telefone"
              type="tel"
              value={telefone}
              onChange={handleTelefoneChange}
              placeholder="(64) 99999-0000"
              disabled={salvando}
              className="min-h-touch-target px-3.5 py-2.5 bg-surface-sunken border border-border-strong rounded-md text-body-lg text-ink-primary focus:bg-surface-raised focus:border-brand-primary focus:outline-none transition-colors"
            />
            <span className="text-meta text-ink-secondary">
              Útil para enviar avisos de quando a encomenda chegar.
            </span>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={salvando}
              className="min-h-touch-target w-full bg-brand-primary hover:bg-brand-hover text-ink-inverse font-semibold text-label-strong rounded-md flex items-center justify-center transition-colors shadow-sm disabled:opacity-60"
            >
              {salvando ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando Cliente...
                </span>
              ) : (
                'Salvar Cliente e Continuar'
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="min-h-touch-target w-full text-ink-secondary hover:text-ink-primary font-semibold text-body-md py-2 text-center transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
