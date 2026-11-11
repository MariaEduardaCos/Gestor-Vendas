import React, { useState, useEffect } from 'react';
import type { ClienteFichaDTO } from '../types/cliente';

interface ClienteFichaModalProps {
  clienteId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onClienteAtualizado?: () => void;
  onClienteExcluido?: (id: string) => void;
  apiBaseUrl?: string;
  sessionToken?: string;
}

export function ClienteFichaModal({
  clienteId,
  isOpen,
  onClose,
  onClienteAtualizado,
  onClienteExcluido,
  apiBaseUrl = '/api',
  sessionToken
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

  useEffect(() => {
    if (isOpen && clienteId) {
      carregarFicha();
      setModoEdicao(false);
      setConfirmandoExclusao(false);
      setErro(null);
    } else {
      setFicha(null);
    }
  }, [isOpen, clienteId]);

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
                    onClick={() => setModoEdicao(true)}
                    className="min-h-[40px] px-3.5 py-1.5 border border-border-strong hover:bg-surface-sunken text-ink-primary rounded-md text-label-strong font-medium transition-colors"
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
                      return (
                        <div
                          key={conta.id}
                          className="bg-surface-sunken border border-border-hairline p-3.5 rounded-lg flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-body-md font-bold text-ink-primary">
                                {formatarMoeda(conta.valor_total)}
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
                            </div>
                            <p className="text-meta text-ink-secondary mt-0.5">
                              Pago: {formatarMoeda(conta.total_pago)}
                              {pendente > 0 && ` • Falta: ${formatarMoeda(pendente)}`}
                            </p>
                          </div>
                          <span className="text-meta text-ink-muted">
                            {new Date(conta.criado_em).toLocaleDateString('pt-BR')}
                          </span>
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
                  <span className="text-meta text-ink-secondary">
                    {ficha.encomendas.length} {ficha.encomendas.length === 1 ? 'item' : 'itens'}
                  </span>
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
                        className="bg-surface-sunken border border-border-hairline p-3.5 rounded-lg flex items-center justify-between"
                      >
                        <div>
                          <p className="text-body-md font-semibold text-ink-primary">
                            {enc.descricao || 'Produto encomendado'}
                          </p>
                          <span className="text-meta text-ink-muted">
                            Pedida em {new Date(enc.criado_em).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        <span
                          className={`text-meta px-2.5 py-1 rounded-full font-semibold ${
                            enc.status === 'RESERVADO'
                              ? 'bg-status-reserved-bg text-status-reserved'
                              : enc.status === 'ENTREGUE'
                              ? 'bg-status-available-bg text-status-available'
                              : 'bg-status-waiting-bg text-status-waiting'
                          }`}
                        >
                          {enc.status === 'RESERVADO'
                            ? 'Separado / Reservado'
                            : enc.status === 'ENTREGUE'
                            ? 'Entregue'
                            : 'Aguardando Fábrica'}
                        </span>
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
    </div>
  );
}
