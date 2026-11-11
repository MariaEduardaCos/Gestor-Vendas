import React, { useState, useEffect } from 'react';
import type { ClienteFichaDTO } from '../types/cliente';

interface ClienteFichaModalProps {
  clienteId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onClienteAtualizado?: () => void;
  onClienteExcluido?: (id: string) => void;
  onAbrirEncomenda?: (cliente: { id: string; nome: string }) => void;
  apiBaseUrl?: string;
  sessionToken?: string;
  refreshKey?: number;
}

export function ClienteFichaModal({
  clienteId,
  isOpen,
  onClose,
  onClienteAtualizado,
  onClienteExcluido,
  onAbrirEncomenda,
  apiBaseUrl = '/api',
  sessionToken,
  refreshKey
}: ClienteFichaModalProps) {
  const [ficha, setFicha] = useState<ClienteFichaDTO | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Estado de Edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editEndereco, setEditEndereco] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Estado de Exclusão
  const [excluindo, setExcluindo] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  // Estado de Entrega Física (Story 4.3)
  const [entregandoItemId, setEntregandoItemId] = useState<string | null>(null);
  const [entregandoContaId, setEntregandoContaId] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Estado de Cancelamento de Item (Story 4.4)
  const [itemParaCancelar, setItemParaCancelar] = useState<{
    contaId: string;
    itemId: string;
    nome: string;
  } | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [cancelandoItem, setCancelandoItem] = useState(false);

  useEffect(() => {
    if (isOpen && clienteId) {
      carregarFicha();
      setModoEdicao(false);
      setConfirmandoExclusao(false);
      setErro(null);
    } else {
      setFicha(null);
    }
  }, [isOpen, clienteId, refreshKey]);

  const carregarFicha = async () => {
    if (!clienteId) return;
    setCarregando(true);
    setErro(null);

    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${apiBaseUrl}/clientes/${clienteId}`, { headers });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || 'Erro ao carregar a ficha da cliente.');
      }
      const data: ClienteFichaDTO = await res.json();
      setFicha(data);
      setEditNome(data.nome);
      setEditTelefone(data.telefone || '');
      setEditEndereco(data.endereco || '');
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar dados.');
    } finally {
      setCarregando(false);
    }
  };

  const handleSalvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId) return;

    const nomeLimpo = editNome.trim();
    if (!nomeLimpo) {
      setErro('O nome da cliente não pode estar vazio.');
      return;
    }

    setSalvandoEdicao(true);
    setErro(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${apiBaseUrl}/clientes/${clienteId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          nome: nomeLimpo,
          telefone: editTelefone.trim() || null,
          endereco: editEndereco.trim() || null
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || 'Erro ao atualizar dados da cliente.');
      }

      await carregarFicha();
      setModoEdicao(false);
      if (onClienteAtualizado) onClienteAtualizado();
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar alterações.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleExcluirCliente = async () => {
    if (!clienteId) return;
    setExcluindo(true);
    setErro(null);

    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${apiBaseUrl}/clientes/${clienteId}`, {
        method: 'DELETE',
        headers
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.detail || 'Não foi possível excluir a cliente. Verifique se existem vendas ou encomendas pendentes.'
        );
      }

      if (onClienteExcluido) onClienteExcluido(clienteId);
      onClose();
    } catch (err: any) {
      setErro(err.message);
      setConfirmandoExclusao(false);
    } finally {
      setExcluindo(false);
    }
  };

  const handleEntregarItem = async (contaId: string, itemId: string) => {
    setEntregandoItemId(itemId);
    setErro(null);
    setSucesso(null);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${apiBaseUrl}/contas/${contaId}/itens/${itemId}/entregar`, {
        method: 'POST',
        headers
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || 'Não foi possível confirmar a entrega física do item.');
      }

      await carregarFicha();
      setSucesso('Entrega física do item confirmada e estoque baixado!');
      setTimeout(() => setSucesso(null), 4000);
      if (onClienteAtualizado) onClienteAtualizado();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setEntregandoItemId(null);
    }
  };

  const handleEntregarTudo = async (contaId: string) => {
    setEntregandoContaId(contaId);
    setErro(null);
    setSucesso(null);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${apiBaseUrl}/contas/${contaId}/entregar-tudo`, {
        method: 'POST',
        headers
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || 'Não foi possível confirmar a entrega de todos os itens.');
      }

      const data = await res.json();
      await carregarFicha();
      setSucesso(data.mensagem || 'Entrega física confirmada com sucesso!');
      setTimeout(() => setSucesso(null), 4000);
      if (onClienteAtualizado) onClienteAtualizado();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setEntregandoContaId(null);
    }
  };

  const handleConfirmarCancelamentoItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemParaCancelar) return;
    if (!motivoCancelamento.trim()) {
      setErro('Informe a justificativa do cancelamento.');
      return;
    }

    setCancelandoItem(true);
    setErro(null);
    setSucesso(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(
        `${apiBaseUrl}/contas/${itemParaCancelar.contaId}/itens/${itemParaCancelar.itemId}/cancelar`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ motivo: motivoCancelamento.trim() })
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || 'Não foi possível cancelar o item da conta.');
      }

      const data = await res.json();
      await carregarFicha();
      setItemParaCancelar(null);
      setMotivoCancelamento('');
      setSucesso(data.mensagem || 'Item cancelado e reserva física liberada com sucesso!');
      setTimeout(() => setSucesso(null), 4000);
      if (onClienteAtualizado) onClienteAtualizado();
    } catch (err: any) {
      setErro(err.message);
    } finally {
      setCancelandoItem(false);
    }
  };

  if (!isOpen) return null;

  const formatarMoeda = (centavos: number) => {
    return (centavos / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ficha da Cliente"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-primary/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvandoEdicao && !excluindo) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-surface-raised rounded-2xl p-5 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-border-hairline">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-border-hairline pb-3">
          <div>
            <span className="text-meta text-ink-secondary font-medium">Ficha da Cliente</span>
            <h2 className="text-title-lg font-bold text-ink-primary">
              {ficha?.nome || 'Carregando...'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar ficha"
            className="w-10 h-10 flex items-center justify-center rounded-full text-ink-secondary hover:bg-surface-sunken text-title-md transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="my-3 bg-status-alert-bg border border-status-alert text-status-alert px-3.5 py-2.5 rounded-md text-body-md font-medium">
            {erro}
          </div>
        )}

        {/* Mensagem de Sucesso */}
        {sucesso && (
          <div className="my-3 bg-status-available-bg border border-status-available text-status-available px-3.5 py-2.5 rounded-md text-body-md font-medium flex items-center justify-between shadow-sm">
            <span>✨ {sucesso}</span>
            <button
              type="button"
              onClick={() => setSucesso(null)}
              className="text-status-available font-bold text-title-md ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Conteúdo com rolagem */}
        <div className="flex-1 overflow-y-auto py-3 flex flex-col gap-4">
          {carregando && !ficha ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-ink-secondary">
              <span className="w-8 h-8 border-3 border-brand-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-body-md">Abrindo ficha da cliente...</p>
            </div>
          ) : ficha ? (
            <>
              {/* Carteira de Crédito & Diferenciação Visual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Saldo da Carteira de Crédito */}
                <div className="bg-status-available-bg border border-status-available/30 rounded-lg p-3.5 flex flex-col">
                  <span className="text-meta font-semibold text-status-available">
                    Carteira de Crédito
                  </span>
                  <span className="text-display font-bold text-status-available mt-1">
                    {formatarMoeda(ficha.saldo_credito_centavos)}
                  </span>
                  <span className="text-meta text-ink-secondary mt-0.5">
                    {ficha.saldo_credito_centavos > 0
                      ? 'Disponível para abater em compras futuras'
                      : 'Sem crédito acumulado'}
                  </span>
                </div>

                {/* Contato & Localização (Diferenciação visual de homônimos) */}
                <div className="bg-surface-sunken border border-border-hairline rounded-lg p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="text-meta font-semibold text-ink-secondary">
                      Contato & Endereço
                    </span>
                    <p className="text-body-md font-semibold text-ink-primary mt-1">
                      {ficha.telefone_formatado || ficha.telefone || 'Telefone não informado'}
                    </p>
                    <p className="text-body-md text-ink-secondary mt-0.5 truncate">
                      {ficha.endereco || 'Endereço não informado'}
                    </p>
                  </div>
                  <span className="text-meta text-ink-muted mt-2 font-mono text-[11px]">
                    ID: {ficha.id.slice(0, 18)}...
                  </span>
                </div>
              </div>

              {/* Modo de Edição ou Visualização de Dados */}
              {modoEdicao ? (
                <form
                  onSubmit={handleSalvarEdicao}
                  className="bg-surface-sunken p-4 rounded-lg flex flex-col gap-3 border border-border-hairline"
                >
                  <h3 className="text-title-md font-bold text-ink-primary">
                    Editar Informações da Cliente
                  </h3>

                  <div className="flex flex-col gap-1">
                    <label className="text-label-strong text-ink-primary">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={editNome}
                      onChange={(e) => setEditNome(e.target.value)}
                      className="min-h-touch-target px-3 py-2 bg-surface-raised border border-border-strong rounded-md text-body-md"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-label-strong text-ink-primary">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={editTelefone}
                      onChange={(e) => setEditTelefone(e.target.value)}
                      placeholder="(64) 99999-0000"
                      className="min-h-touch-target px-3 py-2 bg-surface-raised border border-border-strong rounded-md text-body-md"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-label-strong text-ink-primary">Endereço de Entrega</label>
                    <input
                      type="text"
                      value={editEndereco}
                      onChange={(e) => setEditEndereco(e.target.value)}
                      placeholder="Ex: Rua das Flores, 123"
                      className="min-h-touch-target px-3 py-2 bg-surface-raised border border-border-strong rounded-md text-body-md"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="submit"
                      disabled={salvandoEdicao}
                      className="flex-1 min-h-touch-target bg-brand-primary text-ink-inverse font-semibold rounded-md flex items-center justify-center"
                    >
                      {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                    <button
                      type="button"
                      disabled={salvandoEdicao}
                      onClick={() => setModoEdicao(false)}
                      className="px-4 min-h-touch-target text-ink-secondary hover:text-ink-primary font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (ficha) {
                        onAbrirEncomenda?.({ id: ficha.id, nome: ficha.nome });
                      }
                    }}
                    className="min-h-touch-target px-4 py-2 bg-brand-primary hover:bg-brand-hover text-ink-inverse rounded-md text-label-strong font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <span>+</span> Anotar Encomenda
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoEdicao(true)}
                    className="min-h-touch-target px-3.5 py-1.5 border border-border-strong hover:bg-surface-sunken text-ink-primary rounded-md text-label-strong font-medium transition-colors"
                  >
                    ✏️ Editar Dados
                  </button>
                </div>
              )}

              {/* Seção 1: Histórico de Contas */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-title-md font-bold text-ink-primary">
                    Contas e Compras
                  </h3>
                  <span className="text-meta text-ink-secondary">
                    {ficha.contas.length} {ficha.contas.length === 1 ? 'registro' : 'registros'}
                  </span>
                </div>

                {ficha.contas.length === 0 ? (
                  <div className="bg-surface-sunken p-4 rounded-lg text-center text-ink-secondary text-body-md">
                    Nenhuma conta ou compra registrada para esta cliente.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {ficha.contas.map((conta) => {
                      const pendente = conta.valor_total - conta.total_pago;
                      const cobravelHoje = conta.saldo_cobravel_hoje ?? 0;
                      const temItensAguardando = conta.itens && conta.itens.some((it: any) => it.status_entrega === 'AGUARDANDO_FABRICA');
                      const aguardandoFabrica = temItensAguardando || (Boolean(conta.encomenda_id) && cobravelHoje === 0 && conta.valor_total > 0 && conta.status !== 'QUITADA');
                      const itensReservados = (conta.itens || []).filter((it: any) => it.status_entrega === 'RESERVADO_PRESENTE');
                      const temItensParaEntregar = itensReservados.length > 0;

                      return (
                        <div
                          key={conta.id}
                          className="bg-surface-sunken border border-border-hairline p-3.5 rounded-lg flex flex-col gap-2.5"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-body-md font-bold text-ink-primary">
                                Total: {formatarMoeda(conta.valor_total)}
                              </span>
                              <span
                                className={`text-meta px-2 py-0.5 rounded-full font-semibold ${
                                  conta.status === 'QUITADA'
                                    ? 'bg-status-available-bg text-status-available'
                                    : 'bg-status-reserved-bg text-status-reserved'
                                }`}
                              >
                                {conta.status === 'QUITADA' ? 'Quitada' : 'Em Aberto'}
                              </span>

                              {/* Badge de Entrega Consolidado (FR-028, FR-031) */}
                              {conta.status_entrega && (
                                <span
                                  className={`text-meta px-2 py-0.5 rounded-full font-semibold ${
                                    conta.status_entrega === 'ENTREGUE'
                                      ? 'bg-status-available-bg text-status-available'
                                      : conta.status_entrega === 'PARCIALMENTE_ENTREGUE'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : conta.status_entrega === 'AGUARDANDO_FABRICA'
                                      ? 'bg-status-waiting-bg text-status-waiting'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {conta.status_entrega === 'ENTREGUE'
                                    ? '✓ Entregue'
                                    : conta.status_entrega === 'PARCIALMENTE_ENTREGUE'
                                    ? '⚡ Parcialmente Entregue'
                                    : conta.status_entrega === 'AGUARDANDO_FABRICA'
                                    ? '⏳ Aguardando Fábrica'
                                    : '📦 Disponível'}
                                </span>
                              )}
                            </div>

                            <span className="text-meta text-ink-muted">
                              {new Date(conta.criado_em).toLocaleDateString('pt-BR')}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-meta flex-wrap gap-1">
                            <span className="text-ink-secondary">
                              Pago: {formatarMoeda(conta.total_pago)}
                              {pendente > 0 && ` • Falta Total: ${formatarMoeda(pendente)}`}
                            </span>
                            <span className={`font-semibold ${aguardandoFabrica ? 'text-status-waiting' : 'text-ink-primary'}`}>
                              Cobrável Hoje: {formatarMoeda(cobravelHoje)}
                            </span>
                          </div>

                          {aguardandoFabrica && (
                            <div className="px-2.5 py-1 bg-status-waiting-bg rounded text-meta text-status-waiting font-medium">
                              ⏳ Itens aguardando fábrica: R$ 0,00 cobrável hoje (AD-4)
                            </div>
                          )}

                          {/* Botão Entregar Todos Disponíveis (FR-027, FR-031) */}
                          {temItensParaEntregar && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => handleEntregarTudo(conta.id)}
                                disabled={entregandoContaId === conta.id}
                                className="w-full min-h-[48px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                              >
                                {entregandoContaId === conta.id ? (
                                  <span>Registrando baixa de entrega...</span>
                                ) : (
                                  <>
                                    <span>📦</span>
                                    <span>Entregar Todos os Disponíveis ({itensReservados.length} item(ns))</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          {/* Detalhamento dos Produtos da Conta */}
                          {conta.itens && conta.itens.length > 0 && (
                            <div className="mt-1 pt-2 border-t border-border-hairline divide-y divide-border-hairline/60">
                              <span className="text-[11px] font-bold text-ink-secondary uppercase tracking-wider block mb-1">
                                Produtos da Conta
                              </span>
                              {conta.itens.map((it: any) => {
                                const isReservado = it.status_entrega === 'RESERVADO_PRESENTE';
                                const isEntregue = it.status_entrega === 'ENTREGUE';
                                const isAguardando = it.status_entrega === 'AGUARDANDO_FABRICA';
                                const isCancelado = it.status_entrega === 'CANCELADO';
                                const subtotal = it.quantidade * it.preco_unitario_centavos;

                                return (
                                  <div
                                    key={it.id}
                                    className={`py-2 flex items-center justify-between gap-2 text-xs ${
                                      isCancelado ? 'opacity-60' : ''
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div
                                        className={`font-semibold truncate ${
                                          isCancelado ? 'line-through text-ink-muted' : 'text-ink-primary'
                                        }`}
                                      >
                                        {it.quantidade}x {it.produto_nome || 'Produto'}
                                      </div>
                                      <div className="text-ink-secondary text-[11px] flex items-center gap-2 mt-0.5">
                                        <span>{formatarMoeda(it.preco_unitario_centavos)} un.</span>
                                        <span>• Total: {formatarMoeda(subtotal)}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <span
                                        className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                                          isEntregue
                                            ? 'bg-status-available-bg text-status-available'
                                            : isReservado
                                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                            : isAguardando
                                            ? 'bg-blue-50 text-blue-700'
                                            : isCancelado
                                            ? 'bg-gray-200 text-gray-600 line-through'
                                            : 'bg-gray-100 text-gray-700'
                                        }`}
                                      >
                                        {isEntregue
                                          ? '✓ Entregue'
                                          : isReservado
                                          ? '📦 Pronto p/ Entrega'
                                          : isAguardando
                                          ? '⏳ Aguardando Fábrica'
                                          : isCancelado
                                          ? '✕ Cancelado'
                                          : it.status_entrega}
                                      </span>

                                      {isReservado && (
                                        <button
                                          type="button"
                                          onClick={() => handleEntregarItem(conta.id, it.id)}
                                          disabled={entregandoItemId === it.id}
                                          className="min-h-[48px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                        >
                                          {entregandoItemId === it.id ? (
                                            <span>Entregando...</span>
                                          ) : (
                                            <>
                                              <span>✓</span>
                                              <span>Entregar</span>
                                            </>
                                          )}
                                        </button>
                                      )}

                                      {!isEntregue && !isCancelado && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setItemParaCancelar({
                                              contaId: conta.id,
                                              itemId: it.id,
                                              nome: it.produto_nome || 'Produto'
                                            });
                                            setMotivoCancelamento('');
                                          }}
                                          title="Cancelar este item da conta e liberar reserva física"
                                          className="min-h-[48px] px-2.5 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 font-semibold text-xs shadow-sm transition-colors flex items-center justify-center gap-1"
                                        >
                                          <span>✕</span>
                                          <span className="sr-only sm:not-sr-only">Cancelar</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Seção 2: Itens Encomendados e Aguardados */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-title-md font-bold text-ink-primary">
                    Encomendas
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-meta text-ink-secondary">
                      {ficha.encomendas.length} {ficha.encomendas.length === 1 ? 'registro' : 'registros'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (ficha) {
                          onAbrirEncomenda?.({ id: ficha.id, nome: ficha.nome });
                        }
                      }}
                      className="text-meta text-brand-primary font-bold hover:underline"
                    >
                      + Anotar
                    </button>
                  </div>
                </div>

                {ficha.encomendas.length === 0 ? (
                  <div className="bg-surface-sunken p-4 rounded-lg text-center text-ink-secondary text-body-md">
                    Nenhuma encomenda em andamento.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {ficha.encomendas.map((enc) => (
                      <div
                        key={enc.id}
                        className="bg-surface-sunken border border-border-hairline p-3.5 rounded-lg flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-body-md font-semibold text-ink-primary">
                              {enc.descricao || 'Encomenda'}
                            </p>
                            <span className="text-meta text-ink-muted">
                              Pedida em {new Date(enc.criado_em).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <span
                            className={`text-meta px-2.5 py-1 rounded-full font-semibold ${
                              enc.status === 'RECEBIDO'
                                ? 'bg-status-available-bg text-status-available'
                                : enc.status === 'PARCIALMENTE_RECEBIDO'
                                ? 'bg-status-reserved-bg text-status-reserved'
                                : enc.status === 'CANCELADO'
                                ? 'bg-status-alert-bg text-status-alert'
                                : 'bg-status-waiting-bg text-status-waiting'
                            }`}
                          >
                            {enc.status === 'RECEBIDO'
                              ? 'Recebido da Fábrica'
                              : enc.status === 'PARCIALMENTE_RECEBIDO'
                              ? 'Parcialmente Recebido'
                              : enc.status === 'CANCELADO'
                              ? 'Cancelado'
                              : 'Aguardando Fábrica'}
                          </span>
                        </div>

                        {enc.itens && enc.itens.length > 0 && (
                          <div className="pt-2 border-t border-border-hairline flex flex-col gap-1">
                            {enc.itens.map((it) => (
                              <div key={it.id} className="flex items-center justify-between text-meta">
                                <span className="text-ink-primary font-medium">
                                  {it.quantidade}x {it.produto_nome || 'Produto'}
                                  {it.variante ? ` (${it.variante})` : ''}
                                </span>
                                <span className="text-ink-secondary">
                                  {formatarMoeda(it.preco_unitario_centavos * it.quantidade)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Zona de Exclusão Segura */}
              <div className="pt-2 border-t border-border-hairline">
                {confirmandoExclusao ? (
                  <div className="bg-status-alert-bg border border-status-alert p-3.5 rounded-lg flex flex-col gap-2">
                    <p className="text-body-md font-semibold text-status-alert">
                      Tem certeza que deseja excluir esta cliente?
                    </p>
                    <p className="text-meta text-ink-secondary">
                      Esta ação não pode ser desfeita. Clientes com vendas ou encomendas vinculadas não podem ser excluídos.
                    </p>
                    <div className="flex gap-2 mt-1">
                      <button
                        type="button"
                        disabled={excluindo}
                        onClick={handleExcluirCliente}
                        className="min-h-touch-target flex-1 bg-status-alert text-ink-inverse font-semibold rounded-md text-label-strong"
                      >
                        {excluindo ? 'Excluindo...' : 'Sim, Excluir Cliente'}
                      </button>
                      <button
                        type="button"
                        disabled={excluindo}
                        onClick={() => setConfirmandoExclusao(false)}
                        className="min-h-touch-target px-4 text-ink-secondary hover:text-ink-primary font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(true)}
                    className="min-h-[44px] text-status-alert hover:underline text-body-md font-medium"
                  >
                    🗑️ Excluir esta cliente do cadastro
                  </button>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Rodapé com botão Fechar */}
        <div className="border-t border-border-hairline pt-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch-target px-6 bg-surface-sunken hover:bg-border-hairline text-ink-primary font-semibold rounded-md transition-colors"
          >
            Fechar Ficha
          </button>
        </div>
      </div>

      {/* Modal Sobreposto para Cancelar Item com Motivo */}
      {itemParaCancelar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar Cancelamento do Item"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-ink-primary/60 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-surface-raised rounded-xl p-5 shadow-2xl border border-status-alert/30 flex flex-col gap-3">
            <h3 className="text-title-md font-bold text-status-alert flex items-center gap-2">
              <span>⚠️</span>
              <span>Cancelar Item da Venda</span>
            </h3>
            <p className="text-body-md text-ink-secondary">
              Você está cancelando: <strong className="text-ink-primary">{itemParaCancelar.nome}</strong>.
            </p>
            <p className="text-meta text-ink-secondary">
              Se este item possuir reserva física, as unidades retornarão imediatamente ao estoque de pronta-entrega.
            </p>

            <form onSubmit={handleConfirmarCancelamentoItem} className="flex flex-col gap-3">
              <div>
                <label htmlFor="motivoCancelamento" className="block text-meta font-bold text-ink-primary mb-1">
                  Motivo do cancelamento (obrigatório):
                </label>
                <textarea
                  id="motivoCancelamento"
                  required
                  rows={3}
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  placeholder="Ex: Cliente desistiu antes do envio, produto avariado..."
                  className="w-full p-2.5 rounded-lg border border-border-hairline bg-surface-sunken text-body-md text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={cancelandoItem}
                  onClick={() => {
                    setItemParaCancelar(null);
                    setMotivoCancelamento('');
                  }}
                  className="min-h-[48px] px-4 rounded-lg text-ink-secondary hover:bg-surface-sunken font-semibold text-body-md"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={cancelandoItem || !motivoCancelamento.trim()}
                  className="min-h-[48px] px-5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-body-md shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelandoItem ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
