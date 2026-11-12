import { useState, useEffect } from 'react';
import type { ProdutoDTO } from '../types/produto';
import type { EstoqueDTO } from '../types/estoque';

interface VendaModalProps {
  isOpen: boolean;
  clientePreSelecionado?: { id: string; nome: string } | null;
  sessionToken?: string;
  apiBaseUrl?: string;
  onClose: () => void;
  onVendaConcluida: (venda: any) => void;
  onAbrirGavetaCliente?: () => void;
  /** Cliente cadastrada pela gaveta durante esta venda: entra na lista já escolhida, sem perder os itens. */
  clienteNovo?: ClienteOption | null;
}

interface ItemSelecionado {
  produto: ProdutoDTO;
  estoque: EstoqueDTO;
  quantidade: number;
}

interface ClienteOption {
  id: string;
  nome: string;
  telefone?: string | null;
}

export function VendaModal({
  isOpen,
  clientePreSelecionado,
  sessionToken,
  apiBaseUrl = '/api',
  onClose,
  onVendaConcluida,
  onAbrirGavetaCliente,
  clienteNovo
}: VendaModalProps) {
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>('');
  const [produtosCatalogo, setProdutosCatalogo] = useState<ProdutoDTO[]>([]);
  const [estoqueMap, setEstoqueMap] = useState<Record<string, EstoqueDTO>>({});
  const [carregandoDados, setCarregandoDados] = useState(false);
  const [termoBuscaProduto, setTermoBuscaProduto] = useState('');
  const [itens, setItens] = useState<ItemSelecionado[]>([]);
  const [entregaImediata, setEntregaImediata] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !salvando) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, salvando, onClose]);

  useEffect(() => {
    if (!isOpen || !clienteNovo) return;
    setClientes((atuais) =>
      atuais.some((c) => c.id === clienteNovo.id)
        ? atuais
        : [...atuais, clienteNovo].sort((a, b) => a.nome.localeCompare(b.nome))
    );
    setClienteSelecionadoId(clienteNovo.id);
  }, [isOpen, clienteNovo]);

  useEffect(() => {
    if (isOpen) {
      setItens([]);
      setErro(null);
      setTermoBuscaProduto('');
      setObservacoes('');
      setEntregaImediata(false);
      setClienteSelecionadoId(clientePreSelecionado ? clientePreSelecionado.id : '');
      carregarDadosIniciais();
    }
  }, [isOpen, clientePreSelecionado]);

  const carregarDadosIniciais = async () => {
    setCarregandoDados(true);
    setErro(null);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['authorization'] = `Bearer ${sessionToken}`;
      }

      const [resClientes, resProdutos, resEstoque] = await Promise.all([
        fetch(`${apiBaseUrl}/clientes`, { headers }),
        fetch(`${apiBaseUrl}/produtos`, { headers }),
        fetch(`${apiBaseUrl}/estoque`, { headers })
      ]);

      if (resClientes.ok) {
        const dataClientes = await resClientes.json();
        // Não escolhe uma cliente sozinho: a revendedora precisa indicar para quem é a venda.
        setClientes(dataClientes);
      }

      let produtos: ProdutoDTO[] = [];
      if (resProdutos.ok) {
        produtos = await resProdutos.json();
        setProdutosCatalogo(produtos);
      }

      if (resEstoque.ok) {
        const dataEstoque: EstoqueDTO[] = await resEstoque.json();
        const map: Record<string, EstoqueDTO> = {};
        for (const est of dataEstoque) {
          map[est.produto_id] = est;
        }
        setEstoqueMap(map);
      }
    } catch (e) {
      console.error('Erro ao carregar dados para venda:', e);
      setErro('Erro de conexão ao carregar estoque e clientes.');
    } finally {
      setCarregandoDados(false);
    }
  };

  if (!isOpen) return null;

  // Filtra produtos que tenham estoque na pronta-entrega > 0
  const produtosProntaEntrega = produtosCatalogo.filter((p) => {
    const est = estoqueMap[p.id];
    const prontaEntrega = est ? est.pronta_entrega : 0;
    if (prontaEntrega <= 0) return false;

    if (!termoBuscaProduto.trim()) return true;
    const t = termoBuscaProduto.toLowerCase();
    const nomeOk = p.nome.toLowerCase().includes(t);
    const marcaOk = p.marca_nome ? p.marca_nome.toLowerCase().includes(t) : false;
    const varianteOk = p.variante ? p.variante.toLowerCase().includes(t) : false;
    const codigoOk = p.codigo_barras ? p.codigo_barras.toLowerCase().includes(t) : false;
    return nomeOk || marcaOk || varianteOk || codigoOk;
  });

  const handleAdicionarProduto = (prod: ProdutoDTO) => {
    setErro(null);
    const est = estoqueMap[prod.id] || {
      id: '',
      produto_id: prod.id,
      presentes: 0,
      reservados: 0,
      pronta_entrega: 0,
      aguardando_fabrica: 0
    };

    setItens((atuais) => {
      const idx = atuais.findIndex((i) => i.produto.id === prod.id);
      if (idx >= 0) {
        const itemAtual = atuais[idx];
        if (itemAtual.quantidade + 1 > est.pronta_entrega) {
          setErro(`Você tem apenas ${est.pronta_entrega} unidade(s) de "${prod.nome}" na pronta-entrega.`);
          return atuais;
        }
        const novos = [...atuais];
        novos[idx].quantidade += 1;
        return novos;
      }

      if (est.pronta_entrega <= 0) {
        setErro(`Produto "${prod.nome}" não possui unidades em pronta-entrega.`);
        return atuais;
      }

      return [...atuais, { produto: prod, estoque: est, quantidade: 1 }];
    });
  };

  const handleAlterarQuantidade = (produtoId: string, novaQtd: number) => {
    setErro(null);
    const est = estoqueMap[produtoId];
    const maxDisponivel = est ? est.pronta_entrega : 1;

    if (novaQtd > maxDisponivel) {
      setErro(`Quantidade máxima disponível na pronta-entrega: ${maxDisponivel} unidade(s).`);
      return;
    }

    if (novaQtd <= 0) {
      handleRemoverItem(produtoId);
      return;
    }

    setItens((atuais) =>
      atuais.map((it) => (it.produto.id === produtoId ? { ...it, quantidade: novaQtd } : it))
    );
  };

  const handleRemoverItem = (produtoId: string) => {
    setItens((atuais) => atuais.filter((it) => it.produto.id !== produtoId));
  };

  const totalCentavos = itens.reduce((acc, it) => acc + it.quantidade * it.produto.preco_venda_centavos, 0);
  const totalItens = itens.reduce((acc, it) => acc + it.quantidade, 0);

  const formatarMoeda = (centavos: number) => {
    return (centavos / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const handleConfirmarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!clienteSelecionadoId) {
      setErro('Selecione uma cliente para a venda.');
      return;
    }

    if (itens.length === 0) {
      setErro('Selecione ao menos um produto da pronta-entrega.');
      return;
    }

    setSalvando(true);
    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json'
      };
      if (sessionToken) {
        headers['authorization'] = `Bearer ${sessionToken}`;
      }

      const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `idem-${Date.now()}-${Math.random()}`;

      const payload = {
        cliente_id: clienteSelecionadoId,
        idempotency_key: idempotencyKey,
        observacoes: observacoes.trim() || null,
        itens: itens.map((it) => ({
          produto_id: it.produto.id,
          quantidade: it.quantidade,
          entrega_imediata: entregaImediata,
          preco_unitario_centavos: it.produto.preco_venda_centavos
        }))
      };

      const res = await fetch(`${apiBaseUrl}/vendas`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        onVendaConcluida(data);
        onClose();
      } else {
        const erroJson = await res.json().catch(() => null);
        if (erroJson && erroJson.detail) {
          setErro(erroJson.detail);
        } else {
          setErro('Erro ao registrar a venda. Verifique a disponibilidade do estoque.');
        }
        // Recarrega estoque para atualizar contadores locais em caso de concorrência
        carregarDadosIniciais();
      }
    } catch (e) {
      console.error('Falha ao confirmar venda:', e);
      setErro('Erro de conexão ao salvar a venda.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="venda-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-border">
        {/* Cabeçalho */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-subtle">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </span>
              <h2 id="venda-modal-title" className="text-xl font-bold text-text-primary">
                Nova venda
              </h2>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Venda produtos disponíveis em estoque com reserva nominal ou entrega imediata.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            disabled={salvando}
            className="w-10 h-10 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mensagem de Erro / Alerta Concorrente */}
        {erro && (
          <div className="mx-4 mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800 text-sm">
            <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <span className="font-semibold block">Atenção no Estoque:</span>
              <span>{erro}</span>
            </div>
            <button
              type="button"
              onClick={() => setErro(null)}
              className="text-red-600 hover:text-red-800 text-xs font-semibold underline shrink-0"
            >
              Dispensar
            </button>
          </div>
        )}

        <form onSubmit={handleConfirmarVenda} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* 1. Seleção de Cliente */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="cliente-select" className="text-sm font-semibold text-text-primary">
                Cliente *
              </label>
              {onAbrirGavetaCliente && (
                <button
                  type="button"
                  onClick={onAbrirGavetaCliente}
                  className="text-xs text-primary hover:text-primary-dark font-medium flex items-center gap-1 min-h-[36px]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  + Nova Cliente
                </button>
              )}
            </div>
            <select
              id="cliente-select"
              value={clienteSelecionadoId}
              onChange={(e) => setClienteSelecionadoId(e.target.value)}
              disabled={salvando}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[48px]"
            >
              <option value="">Selecione a cliente...</option>
              {clientes.map((cli) => (
                <option key={cli.id} value={cli.id}>
                  {cli.nome} {cli.telefone ? `(${cli.telefone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Seleção do Modo de Entrega (Retirada Posterior vs Imediata) */}
          <div className="p-3.5 bg-surface-subtle border border-border rounded-xl">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="entrega-imediata"
                checked={entregaImediata}
                onChange={(e) => setEntregaImediata(e.target.checked)}
                disabled={salvando}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary mt-0.5 cursor-pointer"
              />
              <div className="flex-1 text-sm">
                <label htmlFor="entrega-imediata" className="font-semibold text-text-primary cursor-pointer block">
                  Entrega Imediata (Cliente já está levando os produtos agora)
                </label>
                <p className="text-xs text-text-secondary mt-0.5">
                  {entregaImediata
                    ? '✓ O estoque físico na estante será baixado imediatamente no ato da confirmação.'
                    : '✓ Retirada posterior: os produtos ficam imediatamente reservados nominalmente para esta cliente e protegidos contra venda a terceiros.'}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Seleção de Produtos da Pronta-Entrega */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-text-primary">
                Produtos Disponíveis na Pronta-Entrega
              </label>
              <span className="text-xs text-text-muted">
                {produtosProntaEntrega.length} produto(s) com estoque livre
              </span>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Buscar por nome, marca ou código de barras..."
                value={termoBuscaProduto}
                onChange={(e) => setTermoBuscaProduto(e.target.value)}
                disabled={salvando || carregandoDados}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[44px]"
              />
              <svg className="w-5 h-5 text-text-muted absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Lista de Produtos Pronta-Entrega */}
            <div className="max-h-48 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-surface">
              {carregandoDados ? (
                <div className="p-4 text-center text-xs text-text-muted">Carregando estoque disponível...</div>
              ) : produtosProntaEntrega.length === 0 ? (
                <div className="p-4 text-center text-xs text-text-muted">
                  Nenhum produto disponível na pronta-entrega encontrado.
                </div>
              ) : (
                produtosProntaEntrega.map((prod) => {
                  const est = estoqueMap[prod.id];
                  const pronta = est ? est.pronta_entrega : 0;
                  const jaAdicionado = itens.some((i) => i.produto.id === prod.id);

                  return (
                    <div
                      key={prod.id}
                      className="p-3 flex items-center justify-between hover:bg-surface-hover transition-colors text-sm"
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="font-medium text-text-primary truncate">{prod.nome}</div>
                        <div className="text-xs text-text-muted flex items-center gap-2 mt-0.5">
                          {prod.marca_nome && <span>{prod.marca_nome}</span>}
                          {prod.variante && <span>• {prod.variante}</span>}
                          <span className="font-semibold text-text-primary">
                            {formatarMoeda(prod.preco_venda_centavos)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-status-available-bg text-status-available border border-emerald-200">
                          {pronta} livre(s)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdicionarProduto(prod)}
                          disabled={salvando}
                          className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors text-xs font-semibold min-h-[36px]"
                        >
                          {jaAdicionado ? '+ Adicionar' : 'Selecionar'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Carrinho / Itens Selecionados */}
          {itens.length > 0 && (
            <div className="border border-primary/20 bg-primary/5 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Itens Selecionados ({totalItens})
                </span>
                <span className="text-sm font-bold text-primary">
                  {formatarMoeda(totalCentavos)}
                </span>
              </div>

              <div className="divide-y divide-primary/10">
                {itens.map((it) => {
                  const subtotal = it.quantidade * it.produto.preco_venda_centavos;
                  const maxDisponivel = it.estoque.pronta_entrega;

                  return (
                    <div key={it.produto.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text-primary truncate">{it.produto.nome}</div>
                        <div className="text-xs text-text-secondary">
                          {formatarMoeda(it.produto.preco_venda_centavos)} un. • max {maxDisponivel} na pronta-entrega
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center border border-border bg-surface rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => handleAlterarQuantidade(it.produto.id, it.quantidade - 1)}
                            disabled={salvando}
                            className="w-8 h-8 flex items-center justify-center text-text-secondary hover:bg-surface-hover font-bold"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-xs font-semibold text-text-primary">
                            {it.quantidade}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAlterarQuantidade(it.produto.id, it.quantidade + 1)}
                            disabled={salvando || it.quantidade >= maxDisponivel}
                            className="w-8 h-8 flex items-center justify-center text-text-secondary hover:bg-surface-hover font-bold disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>

                        <span className="text-xs font-semibold text-text-primary w-20 text-right">
                          {formatarMoeda(subtotal)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoverItem(it.produto.id)}
                          disabled={salvando}
                          className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remover produto"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Observações Opcionais */}
          <div>
            <label htmlFor="venda-obs" className="text-xs font-medium text-text-secondary block mb-1">
              Observações (opcional)
            </label>
            <input
              id="venda-obs"
              type="text"
              placeholder="Ex: Pagamento na retirada; deixar separado na sacola..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={salvando}
              className="w-full px-3.5 py-2 rounded-xl border border-border bg-surface text-text-primary text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[40px]"
            />
          </div>
        </form>

        {/* Rodapé / Ações com Alvo de Toque >= 48px */}
        <div className="p-4 sm:p-5 border-t border-border bg-surface-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-auto text-left">
            <span className="text-xs text-text-secondary block">Total da Venda:</span>
            <span className="text-lg font-bold text-text-primary">{formatarMoeda(totalCentavos)}</span>
          </div>

          <div className="w-full sm:w-auto flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-border text-text-secondary hover:text-text-primary hover:bg-surface-hover text-sm font-semibold transition-colors min-h-[48px]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarVenda}
              disabled={salvando || itens.length === 0 || !clienteSelecionadoId}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-dark disabled:opacity-50 text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm min-h-[48px]"
            >
              {salvando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Confirmando...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{entregaImediata ? 'Confirmar Entrega Imediata' : 'Confirmar Venda e Reservar'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
