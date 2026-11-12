import { useState, useEffect } from 'react';
import type { ProdutoDTO } from '../types/produto';
import type { EstoqueDTO } from '../types/estoque';

interface EstoqueInicialModalProps {
  isOpen: boolean;
  produto: ProdutoDTO | null;
  estoqueAtual?: EstoqueDTO | null;
  onClose: () => void;
  onEstoqueAtualizado: () => void;
  sessionToken?: string;
}

export function EstoqueInicialModal({
  isOpen,
  produto,
  estoqueAtual,
  onClose,
  onEstoqueAtualizado,
  sessionToken
}: EstoqueInicialModalProps) {
  const [quantidade, setQuantidade] = useState<number>(0);
  const [observacao, setObservacao] = useState<string>('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && produto) {
      // Se já houver estoque cadastrado, inicia com o número de presentes atual
      setQuantidade(estoqueAtual?.presentes ?? 0);
      setObservacao('');
      setErro(null);
    }
  }, [isOpen, produto, estoqueAtual]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !produto) {
    return null;
  }

  const handleIncrementar = () => {
    setQuantidade((prev) => prev + 1);
  };

  const handleDecrementar = () => {
    setQuantidade((prev) => Math.max(0, prev - 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    if (!Number.isInteger(quantidade) || quantidade < 0) {
      setErro('A quantidade física deve ser um número inteiro não negativo.');
      setSalvando(false);
      return;
    }

    const isAjuste = Boolean(estoqueAtual && (estoqueAtual.presentes > 0 || (estoqueAtual.reservados ?? 0) > 0));
    const reservados = estoqueAtual?.reservados ?? 0;

    if (isAjuste && quantidade < reservados) {
      setErro(
        `Trava de Segurança: Não é permitido reduzir a contagem física para ${quantidade} unidade(s) pois existem ${reservados} unidade(s) reservadas para clientes.`
      );
      setSalvando(false);
      return;
    }

    if (isAjuste && !observacao.trim()) {
      setErro('A justificativa do ajuste de inventário é obrigatória.');
      setSalvando(false);
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      let res: Response;
      if (isAjuste) {
        // Rota de Ajuste Justificado de Inventário (FR-030, AD-3)
        res = await fetch(`/api/estoque/${produto.id}/ajuste`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            nova_contagem_presentes: quantidade,
            justificativa: observacao.trim()
          })
        });
      } else {
        // Lançamento de Estoque Inicial (Story 1.4)
        res = await fetch('/api/estoque/inicial', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            produto_id: produto.id,
            quantidade,
            observacao: observacao.trim() || undefined
          })
        });
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || 'Erro ao atualizar contagem de estoque do produto.');
      }

      onEstoqueAtualizado();
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Falha ao salvar estoque.');
    } finally {
      setSalvando(false);
    }
  };

  const isAjuste = Boolean(estoqueAtual && (estoqueAtual.presentes > 0 || (estoqueAtual.reservados ?? 0) > 0));
  const reservados = estoqueAtual?.reservados ?? 0;
  const prontaEntregaCalculada = Math.max(0, quantidade - reservados);
  const violaTravaReservas = isAjuste && quantidade < reservados;
  const nomeExibicao = `${produto.nome}${produto.variante ? ` — ${produto.variante}` : ''}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-primary/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-estoque-titulo"
    >
      <div className="bg-surface-raised border border-border-hairline rounded-lg w-full max-w-lg shadow-xl p-5 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-border-hairline pb-3">
          <div>
            <span className="text-meta font-bold uppercase tracking-wider text-brand-primary block">
              {isAjuste ? 'Corrigir contagem' : 'Contagem Física da Estante'}
            </span>
            <h2 id="modal-estoque-titulo" className="text-title-lg font-bold text-ink-primary">
              {isAjuste ? 'Ajustar Inventário Físico' : 'Estoque Inicial do Produto'}
            </h2>
            <p className="text-body-md text-ink-secondary mt-0.5">
              {nomeExibicao}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-sunken"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {/* Mensagem Acolhedora explicativa (Anti-Jargão) */}
        <div className="bg-surface-accent border border-brand-subtle rounded-md p-3.5 text-body-md text-ink-primary flex gap-3 items-start">
          <span className="text-2xl select-none" aria-hidden="true">🗄️</span>
          <div className="text-sm space-y-1">
            <p className="font-semibold text-brand-primary">
              {isAjuste ? 'Recontagem ou Acerto Físico de Armário' : 'Produtos que você já tem em casa'}
            </p>
            <p className="text-ink-secondary text-[14px] leading-relaxed">
              {isAjuste
                ? 'Atualize a contagem real dos frascos presentes. O sistema protege reservas de clientes e registra a justificativa nominal na auditoria.'
                : 'Conte quantas unidades você já possui fisicamente no armário ou estante. Elas serão registradas como Pronta-Entrega para venda imediata, sem gerar cobranças falsas junto à fábrica.'}
            </p>
          </div>
        </div>

        {/* Alerta de Trava de Segurança de Reservas Ativas (FR-030) */}
        {violaTravaReservas && (
          <div className="p-3 bg-red-50 border border-red-300 text-red-800 rounded-md text-sm font-semibold flex items-start gap-2">
            <span>🛡️</span>
            <div>
              <span>Trava de Segurança Ativa:</span>
              <p className="font-normal text-xs mt-0.5">
                Não é permitido reduzir a contagem física para menos que as {reservados} unidades já reservadas para clientes. Cancele ou desvincule as reservas afetadas antes de ajustar.
              </p>
            </div>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="p-3 bg-status-alert-bg border border-status-alert text-status-alert rounded-md text-body-md" role="alert">
            ⚠️ {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Seletor Ergonômico de Quantidade (+/- 48px touch targets) */}
          <div className="flex flex-col items-center gap-2 py-2">
            <label htmlFor="input-qtd-estoque" className="text-label-strong text-ink-primary text-center">
              Unidades físicas presentes hoje:
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDecrementar}
                disabled={quantidade <= 0}
                className="w-12 h-12 min-h-touch-target min-w-[48px] rounded-md bg-surface-base border-2 border-border-strong hover:bg-surface-sunken disabled:opacity-40 disabled:cursor-not-allowed text-2xl font-bold text-ink-primary flex items-center justify-center transition-colors shadow-xs"
                title="Diminuir uma unidade"
                aria-label="Diminuir uma unidade"
              >
                −
              </button>

              <div className="relative">
                <input
                  id="input-qtd-estoque"
                  type="number"
                  min="0"
                  step="1"
                  value={quantidade}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setQuantidade(0);
                    } else {
                      const val = Number(raw);
                      setQuantidade(isNaN(val) ? 0 : val);
                    }
                  }}
                  className="w-28 h-12 text-center text-display font-bold text-ink-primary border-2 border-brand-primary rounded-md bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <button
                type="button"
                onClick={handleIncrementar}
                className="w-12 h-12 min-h-touch-target min-w-[48px] rounded-md bg-surface-base border-2 border-border-strong hover:bg-surface-sunken text-2xl font-bold text-ink-primary flex items-center justify-center transition-colors shadow-xs"
                title="Aumentar uma unidade"
                aria-label="Aumentar uma unidade"
              >
                +
              </button>
            </div>
            <span className="text-meta text-ink-muted">Toque em + / − ou digite o número exato</span>
          </div>

          {/* Demonstrativo da Invariante de Estoque (AD-3) */}
          <div className="bg-surface-base border border-border-hairline rounded-md p-3">
            <span className="text-meta font-bold text-ink-secondary uppercase tracking-wider block mb-2">
              Distribuição no Estoque (Regra de Conservação):
            </span>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-status-available-bg text-status-available rounded-md p-2">
                <span className="text-meta block">Presentes</span>
                <span className="text-title-md font-bold">{quantidade}</span>
              </div>
              <div className="bg-status-available-bg/60 text-status-available rounded-md p-2">
                <span className="text-meta block">Pronta-Entrega</span>
                <span className="text-title-md font-bold">{prontaEntregaCalculada}</span>
              </div>
              <div className="bg-status-reserved-bg text-status-reserved rounded-md p-2">
                <span className="text-meta block">Reservados</span>
                <span className="text-title-md font-bold">{reservados}</span>
              </div>
            </div>
            <p className="text-[12px] text-ink-muted text-center mt-2">
              Presentes ({quantidade}) = Reservados ({reservados}) + Pronta-Entrega ({prontaEntregaCalculada})
            </p>
          </div>

          {/* Campo de Justificativa / Observação */}
          <div className="flex flex-col gap-1">
            <label htmlFor="obs-estoque" className="text-label-strong text-ink-secondary text-sm">
              {isAjuste ? 'Justificativa do Ajuste de Inventário (obrigatória) *' : 'Observação ou local físico (opcional):'}
            </label>
            <input
              id="obs-estoque"
              type="text"
              required={isAjuste}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder={isAjuste ? 'Ex: 1 frasco danificado/quebrado descartado; acerto de contagem...' : 'Ex: Estante da sala, gaveta de amostras...'}
              className="min-h-touch-target px-3 border border-border-strong rounded-md bg-surface-base text-ink-primary text-body-md focus:outline-brand-primary"
            />
          </div>

          {/* Rodapé de Ações com Botão Sticky / 48px */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-border-hairline">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="w-full sm:w-auto min-h-touch-target px-5 py-2.5 rounded-md border border-border-strong text-ink-secondary font-semibold hover:bg-surface-sunken transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={salvando || violaTravaReservas || (isAjuste && !observacao.trim())}
              className="w-full sm:w-auto min-h-touch-target px-6 py-2.5 rounded-md bg-brand-primary hover:bg-brand-hover text-ink-inverse font-bold text-label-strong shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {salvando ? (
                <>
                  <span className="animate-spin text-lg">⏳</span>
                  <span>Confirmando...</span>
                </>
              ) : (
                <>
                  <span>✓</span>
                  <span>{isAjuste ? 'Confirmar Ajuste de Inventário' : 'Confirmar Estoque Inicial'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
