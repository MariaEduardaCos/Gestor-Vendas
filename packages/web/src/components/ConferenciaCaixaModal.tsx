import { useState, useEffect } from 'react';
import { VisorLeituraHibrido } from './VisorLeituraHibrido';

export interface ConferenciaCaixaModalProps {
  isOpen: boolean;
  compraId?: string | null;
  sessionToken?: string;
  apiBaseUrl?: string;
  onClose: () => void;
  onConferenciaAtualizada?: (compra: any) => void;
}

export interface ItemConferenciaDTO {
  item_compra_id: string;
  produto_id: string;
  produto_nome: string;
  variante: string | null;
  codigo_barras: string | null;
  destinacao: 'CLIENTE' | 'PRONTA_ENTREGA';
  cliente_id: string | null;
  cliente_nome: string | null;
  encomenda_id: string | null;
  item_conta_id: string | null;
  quantidade_pedida: number;
  quantidade_recebida: number;
  quantidade_cancelada_falta?: number;
  quantidade_pendente: number;
}

export interface CompraConferenciaDTO {
  compra_id: string;
  marca_id: string;
  marca_nome: string;
  numero_pedido: string | null;
  status: string;
  data_pedido: string;
  total_itens_pedidos: number;
  total_itens_recebidos: number;
  total_itens_cancelados_falta?: number;
  itens: ItemConferenciaDTO[];
}

export function ConferenciaCaixaModal({
  isOpen,
  compraId,
  sessionToken,
  apiBaseUrl = '/api',
  onClose,
  onConferenciaAtualizada
}: ConferenciaCaixaModalProps) {
  const [comprasAbertas, setComprasAbertas] = useState<Array<{ id: string; marca_nome: string; numero_pedido: string | null; status: string; data_pedido: string }>>([]);
  const [compraSelecionadaId, setCompraSelecionadaId] = useState<string | null>(compraId || null);
  const [dadosConferencia, setDadosConferencia] = useState<CompraConferenciaDTO | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedbackSucesso, setFeedbackSucesso] = useState<string | null>(null);

  // Modo de leitura com câmera / scanner híbrido (S5)
  const [modoLeituraAtivo, setModoLeituraAtivo] = useState(false);

  // Modal S6: Destinação Mandatória ao bipar item de cliente (FR-022, UX-DR2)
  const [modalDestinacaoItem, setModalDestinacaoItem] = useState<{
    item: ItemConferenciaDTO;
    quantidadeAConferir: number;
    destinacaoEscolhida: 'CLIENTE' | 'PRONTA_ENTREGA';
  } | null>(null);

  // Modal S9: Declarar Falta da Fábrica com Ajuste Contábil (FR-024, Story 3.3)
  const [modalFaltaItem, setModalFaltaItem] = useState<ItemConferenciaDTO | null>(null);
  const [motivoFalta, setMotivoFalta] = useState('Produto esgotado no ciclo da fábrica');

  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !salvando && !modalDestinacaoItem) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, salvando, modalDestinacaoItem, onClose]);

  // Carregar lista de compras pendentes de conferência se nenhum compraId fornecido
  useEffect(() => {
    if (isOpen) {
      setErro(null);
      setFeedbackSucesso(null);
      if (compraId) {
        setCompraSelecionadaId(compraId);
        carregarDadosConferencia(compraId);
      } else {
        carregarComprasAbertas();
      }
    } else {
      setDadosConferencia(null);
      setModoLeituraAtivo(false);
      setModalDestinacaoItem(null);
    }
  }, [isOpen, compraId]);

  const carregarComprasAbertas = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${apiBaseUrl}/compras-marca`, { headers });
      if (res.ok) {
        const data = await res.json();
        // Filtrar compras pendentes de conferência ou em andamento
        const abertas = data.filter((c: any) => c.status === 'PEDIDO_REGISTRADO' || c.status === 'CONFERENCIA_EM_ANDAMENTO');
        setComprasAbertas(abertas);
        if (abertas.length > 0 && !compraSelecionadaId) {
          setCompraSelecionadaId(abertas[0].id);
          carregarDadosConferencia(abertas[0].id);
        }
      } else {
        const errJson = await res.json().catch(() => null);
        setErro(errJson?.detail || 'Erro ao carregar lista de pedidos da marca.');
      }
    } catch (e: any) {
      setErro('Falha de conexão ao carregar pedidos.');
    } finally {
      setCarregando(false);
    }
  };

  const carregarDadosConferencia = async (id: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${apiBaseUrl}/compras-marca/${id}/conferencia`, { headers });
      if (res.ok) {
        const data: CompraConferenciaDTO = await res.json();
        setDadosConferencia(data);
      } else {
        const errJson = await res.json().catch(() => null);
        setErro(errJson?.detail || 'Erro ao carregar detalhes da conferência do pedido.');
      }
    } catch (e: any) {
      setErro('Falha de conexão ao carregar conferência de caixa.');
    } finally {
      setCarregando(false);
    }
  };

  // Processa código de barras lido pelo leitor ou digitado (FR-020, FR-022)
  const handleCodigoLido = (codigo: string) => {
    if (!dadosConferencia) return;

    const codigoNormalizado = codigo.trim().toUpperCase();

    // Localizar item correspondente que possua pendência
    const itemEncontrado = dadosConferencia.itens.find((it) => {
      if (it.quantidade_pendente <= 0) return false;
      const matchCodigo = it.codigo_barras && it.codigo_barras.toUpperCase() === codigoNormalizado;
      const matchNome = it.produto_nome.toUpperCase().includes(codigoNormalizado);
      return matchCodigo || matchNome;
    });

    if (!itemEncontrado) {
      setErro(`Produto com código ou nome "${codigo}" não possui unidades pendentes nesta caixa.`);
      setTimeout(() => setErro(null), 4000);
      return;
    }

    iniciarConferenciaDeItem(itemEncontrado);
  };

  // Inicia o fluxo de conferência de 1 unidade do item
  const iniciarConferenciaDeItem = (item: ItemConferenciaDTO) => {
    if (item.quantidade_pendente <= 0) {
      setErro(`Todas as unidades de "${item.produto_nome}" já foram conferidas.`);
      setTimeout(() => setErro(null), 3000);
      return;
    }

    // Se o item for destinado a uma CLIENTE, exibe o Modal S6 de Destinação Mandatória (FR-022)
    if (item.destinacao === 'CLIENTE' && item.cliente_nome) {
      setModalDestinacaoItem({
        item,
        quantidadeAConferir: 1,
        destinacaoEscolhida: 'CLIENTE'
      });
    } else {
      // Se for pronta-entrega, confirma e envia diretamente com idempotência
      confirmarConferenciaItens([
        {
          item_compra_id: item.item_compra_id,
          quantidade: 1,
          destinacao: 'PRONTA_ENTREGA'
        }
      ], `1x ${item.produto_nome} conferido para Pronta-Entrega.`);
    }
  };

  // Envio ao backend com Idempotência (AD-7, NFR-001)
  const confirmarConferenciaItens = async (
    itensParaConferir: Array<{
      item_compra_id: string;
      quantidade: number;
      destinacao?: 'CLIENTE' | 'PRONTA_ENTREGA';
      cliente_id?: string | null;
      item_conta_id?: string | null;
    }>,
    mensagemSucessoTexto?: string
  ) => {
    if (!dadosConferencia) return;

    setSalvando(true);
    setErro(null);

    // Geração de chave de idempotência exclusiva para o lote (AD-7)
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idemp-conf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey
      };
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${apiBaseUrl}/compras-marca/${dadosConferencia.compra_id}/conferencia`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          itens_conferidos: itensParaConferir
        })
      });

      if (res.ok) {
        const resultado = await res.json();
        setFeedbackSucesso(mensagemSucessoTexto || 'Item conferido com sucesso no estoque!');
        setTimeout(() => setFeedbackSucesso(null), 3500);

        // Recarrega os dados atualizados da conferência
        await carregarDadosConferencia(dadosConferencia.compra_id);

        if (onConferenciaAtualizada) {
          onConferenciaAtualizada(resultado);
        }
      } else {
        const errJson = await res.json().catch(() => null);
        setErro(errJson?.detail || 'Erro ao registrar conferência do item.');
      }
    } catch (e: any) {
      setErro('Falha de conexão ao salvar conferência.');
    } finally {
      setSalvando(false);
      setModalDestinacaoItem(null);
    }
  };

  // Registrar falta comunicada pela fábrica com ajuste de conta e emissão de obrigação contábil (FR-024, AD-5, AD-7)
  const confirmarFaltaItem = async (item: ItemConferenciaDTO, motivo: string) => {
    if (!dadosConferencia) return;
    setSalvando(true);
    setErro(null);

    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idemp-falta-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey
      };
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${apiBaseUrl}/compras-marca/${dadosConferencia.compra_id}/falta-fabrica`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          item_compra_id: item.item_compra_id,
          quantidade_em_falta: item.quantidade_pendente,
          motivo
        })
      });

      if (res.ok) {
        const data = await res.json();
        let msg = `Falta registrada para "${item.produto_nome}". O saldo pendente foi cancelado sem baixa em estoque físico.`;
        if (data.obrigacao_contabil) {
          msg += ` Obrigação contábil emitida: ${data.obrigacao_contabil.excedente_formatado} a favor da cliente.`;
        }
        setFeedbackSucesso(msg);
        setTimeout(() => setFeedbackSucesso(null), 6000);

        await carregarDadosConferencia(dadosConferencia.compra_id);
        if (onConferenciaAtualizada) {
          onConferenciaAtualizada(data);
        }
      } else {
        const errJson = await res.json().catch(() => null);
        setErro(errJson?.detail || 'Erro ao registrar falta de fábrica.');
      }
    } catch (e: any) {
      setErro('Falha de conexão ao registrar falta.');
    } finally {
      setSalvando(false);
      setModalFaltaItem(null);
    }
  };

  if (!isOpen) return null;

  const totalPedidos = dadosConferencia?.total_itens_pedidos || 0;
  const totalRecebidos = dadosConferencia?.total_itens_recebidos || 0;
  const porcentagem = totalPedidos > 0 ? Math.round((totalRecebidos / totalPedidos) * 100) : 0;
  const caixaConcluida = dadosConferencia?.status === 'CONFERIDA' || (totalPedidos > 0 && totalRecebidos >= totalPedidos);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="bg-surface-raised border border-border-hairline rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Cabeçalho do Modal */}
        <div className="p-4 border-b border-border-hairline bg-surface-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-title-lg">📦</span>
            <div>
              <h2 className="text-title-md font-bold text-ink-primary">
                Conferência de Caixa da Fábrica (S5)
              </h2>
              <p className="text-meta text-ink-secondary">
                Entrada física e destinação mandatória com chave de idempotência (AD-3, AD-7, FR-020)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="w-10 h-10 rounded-full flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface-sunken transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Seletor de Compra / Resumo da Caixa */}
        <div className="p-4 bg-surface-base border-b border-border-hairline flex flex-col gap-3">
          {comprasAbertas.length > 1 && !compraId && (
            <div>
              <label className="text-meta font-semibold text-ink-secondary block mb-1">
                Selecione o Pedido de Fábrica para Conferir:
              </label>
              <select
                value={compraSelecionadaId || ''}
                onChange={(e) => {
                  const newId = e.target.value;
                  setCompraSelecionadaId(newId);
                  carregarDadosConferencia(newId);
                }}
                className="w-full min-h-touch-target p-2.5 bg-surface-raised border border-border-hairline rounded-lg text-body-md text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {comprasAbertas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.marca_nome} {c.numero_pedido ? `(Ped: ${c.numero_pedido})` : ''} - Status: {c.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {dadosConferencia && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-label-strong text-ink-primary font-bold text-title-md">
                    {dadosConferencia.marca_nome}
                  </span>
                  {dadosConferencia.numero_pedido && (
                    <span className="ml-2 text-meta bg-surface-sunken px-2 py-0.5 rounded text-ink-secondary">
                      Ped: #{dadosConferencia.numero_pedido}
                    </span>
                  )}
                </div>
                <span className={`text-meta font-bold px-2.5 py-1 rounded-full ${
                  caixaConcluida
                    ? 'bg-status-available-bg text-status-available'
                    : 'bg-brand-subtle text-brand-primary'
                }`}>
                  {caixaConcluida ? '✓ TOTALMENTE CONFERIDA' : 'EM CONFERÊNCIA'}
                </span>
              </div>

              {/* Barra de Progresso Físico */}
              <div className="w-full bg-surface-sunken rounded-full h-3 overflow-hidden border border-border-hairline">
                <div
                  className={`h-full transition-all duration-300 ${
                    caixaConcluida ? 'bg-status-available' : 'bg-brand-primary'
                  }`}
                  style={{ width: `${porcentagem}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-meta text-ink-secondary">
                <span>Progresso da Caixa: <strong>{totalRecebidos}</strong> de <strong>{totalPedidos}</strong> itens ({porcentagem}%)</span>
                <span>Faltam conferir: <strong>{Math.max(0, totalPedidos - totalRecebidos)}</strong> itens</span>
              </div>
            </div>
          )}
        </div>

        {/* Mensagens de Erro ou Feedback */}
        {erro && (
          <div className="mx-4 mt-3 p-3 bg-status-reserved-bg border border-status-reserved text-status-reserved rounded-lg text-body-md flex items-center justify-between animate-fade-in">
            <span>⚠️ {erro}</span>
            <button type="button" onClick={() => setErro(null)} className="ml-2 font-bold text-title-md">✕</button>
          </div>
        )}

        {feedbackSucesso && (
          <div className="mx-4 mt-3 p-3 bg-status-available-bg border border-status-available text-status-available rounded-lg text-body-md flex items-center justify-between animate-fade-in">
            <span>✨ {feedbackSucesso}</span>
            <button type="button" onClick={() => setFeedbackSucesso(null)} className="ml-2 font-bold text-title-md">✕</button>
          </div>
        )}

        {/* Corpo Principal: Alternância entre Scanner Híbrido e Lista de Itens */}
        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4">
          
          {/* Botão de Alternar Modo Câmera / Leitor Híbrido Contínuo */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModoLeituraAtivo(!modoLeituraAtivo)}
              className={`min-h-touch-target flex-1 py-2 px-3 rounded-lg font-bold text-label-strong flex items-center justify-center gap-2 transition-colors ${
                modoLeituraAtivo
                  ? 'bg-surface-sunken text-ink-primary border border-border-hairline'
                  : 'bg-brand-primary hover:bg-brand-hover text-ink-inverse shadow-sm'
              }`}
            >
              <span>{modoLeituraAtivo ? '📋 Ocultar Câmera / Ver Apenas Lista' : '📷 Abrir Câmera para Bipar Caixa (S5)'}</span>
            </button>
          </div>

          {/* Visor Híbrido com Câmera Contínua e Filtro Anti-Duplicação 1,5s (FR-009, Story 1.5, S5) */}
          {modoLeituraAtivo && (
            <div className="border border-border-hairline rounded-lg p-3 bg-surface-subtle">
              <h3 className="text-title-sm font-bold text-ink-primary mb-2 flex items-center gap-2">
                <span>⚡ Bipagem Contínua da Caixa</span>
                <span className="text-meta font-normal text-ink-secondary">(Aponte a câmera para os frascos ou digite o código)</span>
              </h3>
              <VisorLeituraHibrido
                autoStart={true}
                placeholderManual="Digite código de barras ou parte do nome..."
                onCodigoLido={handleCodigoLido}
              />
            </div>
          )}

          {/* Lista de Itens Esperados na Caixa */}
          <div>
            <h3 className="text-title-sm font-bold text-ink-primary mb-2 flex items-center justify-between">
              <span>Itens Esperados no Pedido</span>
              <span className="text-meta text-ink-secondary">
                Toque em "+1 Conferir" para apontar entrada manual
              </span>
            </h3>

            {carregando ? (
              <div className="py-8 text-center text-ink-secondary">
                Carregando itens da conferência...
              </div>
            ) : !dadosConferencia || dadosConferencia.itens.length === 0 ? (
              <div className="py-8 text-center text-ink-secondary">
                Nenhum item pendente nesta compra.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {dadosConferencia.itens.map((it) => {
                  const jaCompleto = it.quantidade_pendente === 0;

                  return (
                    <div
                      key={it.item_compra_id}
                      className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        jaCompleto
                          ? 'bg-surface-sunken border-border-hairline opacity-75'
                          : 'bg-surface-raised border-border-hairline shadow-sm hover:border-brand-primary/40'
                      }`}
                    >
                      {/* Detalhes do Produto e Destinação Mandatória */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-body-lg font-bold text-ink-primary">
                            {it.produto_nome}
                          </span>
                          {it.variante && (
                            <span className="text-meta bg-surface-sunken px-2 py-0.5 rounded text-ink-secondary">
                              {it.variante}
                            </span>
                          )}
                          {it.codigo_barras && (
                            <span className="text-meta text-ink-muted">
                              EAN: {it.codigo_barras}
                            </span>
                          )}
                        </div>

                        {/* Tag de Destinação Mandatória (FR-022) */}
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {it.destinacao === 'CLIENTE' && it.cliente_nome ? (
                            <span className="inline-flex items-center gap-1 text-meta font-bold bg-status-reserved-bg text-status-reserved px-2 py-0.5 rounded border border-status-reserved/30">
                              <span>👤</span> Encomenda: {it.cliente_nome} (Reserva Física)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-meta font-semibold bg-brand-subtle text-brand-primary px-2 py-0.5 rounded">
                              <span>🏷️</span> Pronta-Entrega (Estoque Livre)
                            </span>
                          )}

                          <span className="text-meta text-ink-secondary">
                            Recebido: <strong>{it.quantidade_recebida}</strong> / {it.quantidade_pedida} un
                          </span>
                        </div>
                      </div>

                      {/* Ações e Botão de Conferência */}
                      <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                        {Boolean(it.quantidade_cancelada_falta && it.quantidade_cancelada_falta > 0) && (
                          <span className="text-meta font-bold text-ink-muted bg-surface-sunken px-2 py-1 rounded">
                            {it.quantidade_cancelada_falta} un em falta
                          </span>
                        )}

                        {jaCompleto ? (
                          <span className="text-meta font-bold text-status-available flex items-center gap-1 py-2 px-3 bg-status-available-bg rounded-lg">
                            ✓ Concluído
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={salvando}
                              onClick={() => {
                                setModalFaltaItem(it);
                                setMotivoFalta('Produto esgotado no ciclo da fábrica');
                              }}
                              className="min-h-touch-target px-3 py-1.5 text-meta font-semibold text-ink-secondary hover:text-status-reserved hover:bg-surface-sunken rounded-lg transition-colors border border-transparent hover:border-border-hairline"
                              title="Declarar que a fábrica confirmou falta definitiva deste item"
                            >
                              ✕ Falta de Fábrica
                            </button>

                            <button
                              type="button"
                              disabled={salvando}
                              onClick={() => iniciarConferenciaDeItem(it)}
                              className="min-h-touch-target px-4 py-2 bg-brand-primary hover:bg-brand-hover text-ink-inverse font-bold text-label-strong rounded-lg flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                            >
                              <span>+1</span> Conferir
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé com Informações de Invariante Física */}
        <div className="p-4 border-t border-border-hairline bg-surface-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-meta text-ink-secondary flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-status-available" />
            <span>Invariante Garantida: Presentes = Reservados + ProntaEntrega (AD-3)</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-touch-target px-5 py-2.5 rounded-lg border border-border-hairline bg-surface-raised hover:bg-surface-sunken text-ink-primary font-semibold text-body-md transition-colors w-full sm:w-auto"
          >
            Fechar Conferência
          </button>
        </div>
      </div>

      {/* Modal S6: Destinação Mandatória ao Conferir Item de Cliente (FR-022, Story 3.2, UX-DR2) */}
      {modalDestinacaoItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-raised border border-status-reserved rounded-xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4 animate-scale-up">
            
            <div className="flex items-center justify-between border-b border-border-hairline pb-3">
              <div className="flex items-center gap-2">
                <span className="text-title-lg">👤📦</span>
                <div>
                  <h3 className="text-title-md font-bold text-ink-primary">
                    Destinação Mandatória (S6)
                  </h3>
                  <span className="text-meta text-status-reserved font-bold">
                    Reserva Física Nominal (FR-022)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalDestinacaoItem(null)}
                disabled={salvando}
                className="text-ink-secondary hover:text-ink-primary text-title-md"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-status-reserved-bg border border-status-reserved/40 rounded-lg flex flex-col gap-2">
              <span className="text-meta font-bold uppercase tracking-wider text-status-reserved">
                Este frasco pertence à cliente:
              </span>
              <p className="text-title-lg font-black text-ink-primary">
                {modalDestinacaoItem.item.cliente_nome}
              </p>
              <div className="text-body-md text-ink-secondary">
                Produto: <strong>{modalDestinacaoItem.item.produto_nome}</strong>
                {modalDestinacaoItem.item.variante && ` (${modalDestinacaoItem.item.variante})`}
              </div>
              <p className="text-meta text-ink-secondary mt-1">
                Ao confirmar, o frasco entra no estoque físico como <strong>Reservado Presente</strong> e fica vinculado exclusivamente a esta cliente para entrega.
              </p>
            </div>

            {/* Alternativas de Destinação */}
            <div className="flex flex-col gap-2">
              <label className="text-meta font-semibold text-ink-primary">
                Confirmar Destinação Deste Frasco:
              </label>
              
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border-hairline bg-surface-subtle cursor-pointer hover:bg-surface-sunken">
                <input
                  type="radio"
                  name="destinacao"
                  value="CLIENTE"
                  checked={modalDestinacaoItem.destinacaoEscolhida === 'CLIENTE'}
                  onChange={() => setModalDestinacaoItem({
                    ...modalDestinacaoItem,
                    destinacaoEscolhida: 'CLIENTE'
                  })}
                  className="w-5 h-5 text-brand-primary"
                />
                <div>
                  <span className="text-label-strong font-bold text-ink-primary block">
                    ✓ Reservar para {modalDestinacaoItem.item.cliente_nome} (Recomendado)
                  </span>
                  <span className="text-meta text-ink-secondary">
                    Frasco guardado fisicamente com o nome da cliente para entrega.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-border-hairline bg-surface-subtle cursor-pointer hover:bg-surface-sunken">
                <input
                  type="radio"
                  name="destinacao"
                  value="PRONTA_ENTREGA"
                  checked={modalDestinacaoItem.destinacaoEscolhida === 'PRONTA_ENTREGA'}
                  onChange={() => setModalDestinacaoItem({
                    ...modalDestinacaoItem,
                    destinacaoEscolhida: 'PRONTA_ENTREGA'
                  })}
                  className="w-5 h-5 text-brand-primary"
                />
                <div>
                  <span className="text-label-strong font-bold text-ink-primary block">
                    Disponibilizar para Pronta-Entrega Livre
                  </span>
                  <span className="text-meta text-ink-secondary">
                    O frasco vai para venda imediata na estante.
                  </span>
                </div>
              </label>
            </div>

            {/* Ações do Modal S6 */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={salvando}
                onClick={() => {
                  const it = modalDestinacaoItem.item;
                  const destinacao = modalDestinacaoItem.destinacaoEscolhida;
                  const clienteId = destinacao === 'CLIENTE' ? it.cliente_id : null;
                  const itemContaId = destinacao === 'CLIENTE' ? it.item_conta_id : null;

                  confirmarConferenciaItens([
                    {
                      item_compra_id: it.item_compra_id,
                      quantidade: 1,
                      destinacao,
                      cliente_id: clienteId,
                      item_conta_id: itemContaId
                    }
                  ], destinacao === 'CLIENTE'
                    ? `1x ${it.produto_nome} reservado com sucesso para ${it.cliente_nome}!`
                    : `1x ${it.produto_nome} conferido para Pronta-Entrega.`
                  );
                }}
                className="min-h-touch-target bg-status-reserved hover:opacity-90 text-white font-bold text-label-strong rounded-lg flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
              >
                {salvando ? 'Salvando...' : `Confirmar Destinação (1 un)`}
              </button>

              <button
                type="button"
                disabled={salvando}
                onClick={() => setModalDestinacaoItem(null)}
                className="min-h-touch-target bg-surface-sunken hover:bg-surface-base text-ink-secondary font-semibold text-body-md rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal S9: Declarar Falta da Fábrica com Ajuste Contábil (FR-024, Refinamento Elicitação, Story 3.3) */}
      {modalFaltaItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-raised border border-status-reserved rounded-xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4 animate-scale-up">
            
            <div className="flex items-center justify-between border-b border-border-hairline pb-3">
              <div className="flex items-center gap-2">
                <span className="text-title-lg">⚠️🏭</span>
                <div>
                  <h3 className="text-title-md font-bold text-ink-primary">
                    Confirmar Falta da Fábrica (S9)
                  </h3>
                  <span className="text-meta text-status-reserved font-bold">
                    Cancelamento de Saldo Pendente (FR-024)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalFaltaItem(null)}
                disabled={salvando}
                className="text-ink-secondary hover:text-ink-primary text-title-md"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-surface-sunken border border-border-hairline rounded-lg flex flex-col gap-2">
              <div className="text-body-md text-ink-primary">
                Produto: <strong>{modalFaltaItem.produto_nome}</strong>
                {modalFaltaItem.variante && ` (${modalFaltaItem.variante})`}
              </div>
              <div className="text-meta text-ink-secondary">
                Quantidade em falta a ser cancelada: <strong>{modalFaltaItem.quantidade_pendente} un</strong>
              </div>

              {modalFaltaItem.destinacao === 'CLIENTE' && modalFaltaItem.cliente_nome ? (
                <div className="mt-2 p-2.5 bg-status-reserved-bg border border-status-reserved/40 rounded text-meta text-status-reserved font-medium">
                  <span className="font-bold block">👤 Impacto na Conta da Cliente:</span>
                  Este item foi encomendado por <strong>{modalFaltaItem.cliente_nome}</strong>. O valor será abatido da conta dela. Se a conta já tiver sido paga total ou parcialmente, um crédito ou estorno será registrado automaticamente (AD-5, FR-024).
                </div>
              ) : (
                <div className="mt-2 p-2 bg-brand-subtle text-brand-primary rounded text-meta">
                  Item de pronta-entrega. O saldo pendente será cancelado sem dar baixa em estoque físico.
                </div>
              )}
            </div>

            {/* Motivo da Falta */}
            <div className="flex flex-col gap-1.5">
              <label className="text-meta font-semibold text-ink-primary">
                Motivo Informado pela Marca:
              </label>
              <input
                type="text"
                value={motivoFalta}
                onChange={(e) => setMotivoFalta(e.target.value)}
                placeholder="Ex: Produto esgotado no ciclo da fábrica"
                className="w-full min-h-touch-target p-2.5 bg-surface-raised border border-border-hairline rounded-lg text-body-md text-ink-primary focus:outline-none focus:ring-2 focus:ring-status-reserved"
              />
            </div>

            {/* Ações do Modal S9 */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={salvando}
                onClick={() => confirmarFaltaItem(modalFaltaItem, motivoFalta)}
                className="min-h-touch-target bg-status-reserved hover:opacity-90 text-white font-bold text-label-strong rounded-lg flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
              >
                {salvando ? 'Processando cancelamento...' : `Confirmar Falta (${modalFaltaItem.quantidade_pendente} un)`}
              </button>

              <button
                type="button"
                disabled={salvando}
                onClick={() => setModalFaltaItem(null)}
                className="min-h-touch-target bg-surface-sunken hover:bg-surface-base text-ink-secondary font-semibold text-body-md rounded-lg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
