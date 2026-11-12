import { useState, useEffect } from 'react';
import type { ProdutoDTO } from '../types/produto';

interface EncomendaModalProps {
  cliente: { id: string; nome: string } | null;
  isOpen: boolean;
  sessionToken?: string;
  apiBaseUrl?: string;
  onClose: () => void;
  onEncomendaCriada: (encomenda: any) => void;
}

interface ItemSelecionado {
  produto: ProdutoDTO;
  quantidade: number;
}

export function EncomendaModal({
  cliente,
  isOpen,
  sessionToken,
  apiBaseUrl = '/api',
  onClose,
  onEncomendaCriada
}: EncomendaModalProps) {
  const [produtosCatalogo, setProdutosCatalogo] = useState<ProdutoDTO[]>([]);
  const [marcaFiltro, setMarcaFiltro] = useState<string | null>(null);
  const [carregandoProdutos, setCarregandoProdutos] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  const [descricao, setDescricao] = useState('');
  const [itens, setItens] = useState<ItemSelecionado[]>([]);
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
    if (isOpen) {
      setDescricao('');
      setItens([]);
      setErro(null);
      setTermoBusca('');
      carregarProdutos();
    }
  }, [isOpen]);

  const carregarProdutos = async () => {
    setCarregandoProdutos(true);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['authorization'] = `Bearer ${sessionToken}`;
      }
      const res = await fetch(`${apiBaseUrl}/produtos`, { headers });
      if (res.ok) {
        const data = await res.json();
        setProdutosCatalogo(data);
      } else {
        setErro('Não foi possível carregar o catálogo de produtos.');
      }
    } catch (e) {
      console.error('Erro ao carregar catálogo de produtos:', e);
      setErro('Erro de conexão ao carregar produtos do catálogo.');
    } finally {
      setCarregandoProdutos(false);
    }
  };

  if (!isOpen || !cliente) return null;

  const marcasDoCatalogo = [...new Set(produtosCatalogo.map((p) => p.marca_nome).filter((m): m is string => !!m))].sort();

  const produtosFiltrados = produtosCatalogo.filter((p) => {
    if (marcaFiltro && p.marca_nome !== marcaFiltro) return false;
    if (!termoBusca.trim()) return true;
    const t = termoBusca.toLowerCase();
    const nomeOk = p.nome.toLowerCase().includes(t);
    const marcaOk = p.marca_nome ? p.marca_nome.toLowerCase().includes(t) : false;
    const varianteOk = p.variante ? p.variante.toLowerCase().includes(t) : false;
    const codigoOk = p.codigo_barras ? p.codigo_barras.toLowerCase().includes(t) : false;
    return nomeOk || marcaOk || varianteOk || codigoOk;
  });

  const handleAdicionarProduto = (prod: ProdutoDTO) => {
    setErro(null);
    setItens((atuais) => {
      const idx = atuais.findIndex((i) => i.produto.id === prod.id);
      if (idx >= 0) {
        const novos = [...atuais];
        novos[idx].quantidade += 1;
        return novos;
      }
      return [...atuais, { produto: prod, quantidade: 1 }];
    });
  };

  const handleAlterarQuantidade = (produtoId: string, delta: number) => {
    setErro(null);
    setItens((atuais) => {
      return atuais
        .map((item) => {
          if (item.produto.id === produtoId) {
            const novaQtd = item.quantidade + delta;
            return novaQtd > 0 ? { ...item, quantidade: novaQtd } : null;
          }
          return item;
        })
        .filter((item): item is ItemSelecionado => item !== null);
    });
  };

  const handleRemoverItem = (produtoId: string) => {
    setItens((atuais) => atuais.filter((i) => i.produto.id !== produtoId));
  };

  const totalCentavos = itens.reduce(
    (acc, cur) => acc + cur.quantidade * cur.produto.preco_venda_centavos,
    0
  );

  const totalQuantidadeItens = itens.reduce((acc, cur) => acc + cur.quantidade, 0);

  const formatarMoeda = (centavos: number) => {
    return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleSalvarEncomenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    if (itens.length === 0) {
      setErro('Selecione pelo menos um produto do catálogo para registrar a encomenda.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json'
      };
      if (sessionToken) {
        headers['authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch(`${apiBaseUrl}/encomendas`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          cliente_id: cliente.id,
          descricao: descricao.trim() || null,
          itens: itens.map((i) => ({
            produto_id: i.produto.id,
            quantidade: i.quantidade,
            preco_unitario_centavos: i.produto.preco_venda_centavos
          }))
        })
      });

      if (!res.ok) {
        const erroJson = await res.json().catch(() => null);
        throw new Error(
          erroJson?.detail || erroJson?.title || 'Não foi possível registrar a encomenda.'
        );
      }

      const novaEncomenda = await res.json();
      onEncomendaCriada(novaEncomenda);
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro inesperado ao salvar encomenda.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !salvando) onClose();
      }}
      className="fixed inset-0 z-50 bg-ink-primary/50 backdrop-blur-xs flex items-center justify-center p-3"
    >
      <div className="bg-surface-raised w-full max-w-lg rounded-xl shadow-xl flex flex-col max-h-[92vh] border border-border-hairline">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-border-hairline flex items-center justify-between">
          <div>
            <span className="text-meta font-semibold text-brand-primary uppercase tracking-wide">
              Anotar encomenda
            </span>
            <h2 className="text-title-md font-bold text-ink-primary">
              Para: {cliente.nome}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-ink-secondary hover:text-ink-primary text-title-md font-bold rounded-lg hover:bg-surface-sunken"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Informação conceitual acolhedora (AD-3, AD-4) */}
        <div className="px-4 py-2.5 bg-status-waiting-bg border-b border-border-hairline text-status-waiting flex items-start gap-2.5">
          <span className="text-title-md leading-none mt-0.5">📦</span>
          <p className="text-meta leading-snug">
            Esta anotação gera a conta da cliente aguardando a fábrica. Seu estoque na estante{' '}
            <strong>não é alterado agora</strong> — a entrada só acontece quando você abrir a caixa recebida.
          </p>
        </div>

        {/* Corpo com rolagem */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {erro && (
            <div className="bg-status-alert-bg border border-status-alert text-status-alert p-3 rounded-lg text-body-md font-medium">
              ⚠️ {erro}
            </div>
          )}

          {/* Campo de descrição/observação opcional */}
          <div>
            <label htmlFor="descricao-encomenda" className="block text-label-strong font-semibold text-ink-primary mb-1">
              Observação / Ocasião (Opcional)
            </label>
            <input
              id="descricao-encomenda"
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Presente de Aniversário, Dia das Mães..."
              className="w-full min-h-[44px] px-3 border border-border-strong rounded-md text-body-md bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          {/* Lista de itens selecionados */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-label-strong font-bold text-ink-primary">
                Itens da Encomenda ({totalQuantidadeItens})
              </label>
              {itens.length > 0 && (
                <span className="text-meta font-semibold text-ink-secondary">
                  Total Previsto: {formatarMoeda(totalCentavos)}
                </span>
              )}
            </div>

            {itens.length === 0 ? (
              <div className="bg-surface-sunken border border-dashed border-border-strong p-4 rounded-lg text-center text-ink-secondary text-body-md">
                Nenhum produto adicionado ainda. Escolha os itens no catálogo abaixo.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {itens.map(({ produto, quantidade }) => (
                  <div
                    key={produto.id}
                    className="p-3 bg-surface-sunken border border-border-hairline rounded-lg flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md font-bold text-ink-primary truncate">
                        {produto.nome}
                      </p>
                      <p className="text-meta text-ink-secondary">
                        {formatarMoeda(produto.preco_venda_centavos)} cada
                        {produto.marca_nome && ` • ${produto.marca_nome}`}
                        {produto.variante && ` (${produto.variante})`}
                      </p>
                      <p className="text-meta font-semibold text-brand-primary">
                        Subtotal: {formatarMoeda(quantidade * produto.preco_venda_centavos)}
                      </p>
                    </div>

                    {/* Controles de Quantidade confortáveis (>= 48px touch target) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAlterarQuantidade(produto.id, -1)}
                        className="w-12 h-12 flex items-center justify-center rounded-lg bg-surface-raised border border-border-strong text-ink-primary text-title-md font-bold hover:bg-border-hairline active:scale-95 transition-all"
                        aria-label={`Diminuir quantidade de ${produto.nome}`}
                      >
                        -
                      </button>

                      <span className="w-8 text-center text-title-md font-bold text-ink-primary">
                        {quantidade}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleAlterarQuantidade(produto.id, 1)}
                        className="w-12 h-12 flex items-center justify-center rounded-lg bg-surface-raised border border-border-strong text-ink-primary text-title-md font-bold hover:bg-border-hairline active:scale-95 transition-all"
                        aria-label={`Aumentar quantidade de ${produto.nome}`}
                      >
                        +
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoverItem(produto.id)}
                        className="w-10 h-10 ml-1 flex items-center justify-center text-status-alert hover:bg-status-alert-bg rounded-lg"
                        title="Remover produto"
                        aria-label={`Remover ${produto.nome}`}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seleção do Catálogo de Produtos */}
          <div className="pt-2 border-t border-border-hairline">
            <label htmlFor="busca-produto-encomenda" className="block text-label-strong font-bold text-ink-primary mb-1.5">
              Escolher Produtos do Catálogo
            </label>
            {marcasDoCatalogo.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-2" role="group" aria-label="Filtrar por marca">
                {[null, ...marcasDoCatalogo].map((m) => (
                  <button
                    key={m ?? 'todas'}
                    type="button"
                    onClick={() => setMarcaFiltro(m)}
                    aria-pressed={marcaFiltro === m}
                    className={`whitespace-nowrap min-h-[36px] px-3 rounded-full text-meta font-semibold border ${
                      marcaFiltro === m ? 'bg-ink-primary text-ink-inverse border-ink-primary' : 'border-border-strong text-ink-secondary'
                    }`}
                  >
                    {m ?? 'Todas as marcas'}
                  </button>
                ))}
              </div>
            )}
            <input
              id="busca-produto-encomenda"
              type="text"
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              placeholder="🔍 Buscar produto por nome ou marca..."
              className="w-full min-h-[44px] px-3 mb-2.5 border border-border-strong rounded-md text-body-md bg-surface-raised focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />

            {carregandoProdutos ? (
              <div className="p-4 text-center text-ink-secondary text-body-md">
                Carregando catálogo de produtos...
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="p-3 bg-surface-sunken rounded-lg text-center text-ink-secondary text-meta">
                Nenhum produto encontrado na busca.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {produtosFiltrados.map((prod) => {
                  const jaSelecionado = itens.some((i) => i.produto.id === prod.id);
                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleAdicionarProduto(prod)}
                      className="w-full text-left p-2.5 rounded-lg border border-border-hairline hover:border-brand-primary hover:bg-surface-accent flex items-center justify-between gap-2 transition-colors min-h-touch-target"
                    >
                      <div className="min-w-0">
                        <p className="text-body-md font-semibold text-ink-primary truncate">
                          {prod.nome}
                        </p>
                        <p className="text-meta text-ink-secondary">
                          {prod.marca_nome ? `${prod.marca_nome} • ` : ''}
                          {prod.preco_venda_formatado}
                        </p>
                      </div>
                      <span className="shrink-0 text-meta px-2.5 py-1 rounded-md font-bold bg-brand-subtle text-brand-primary">
                        {jaSelecionado ? '+ 1 un' : '+ Adicionar'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé e Ações */}
        <div className="p-4 border-t border-border-hairline bg-surface-sunken rounded-b-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-meta text-ink-secondary">Total da Encomenda:</span>
              <p className="text-title-lg font-bold text-ink-primary">
                {formatarMoeda(totalCentavos)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-meta text-status-waiting font-semibold">
                Saldo Cobrável Hoje:
              </span>
              <p className="text-body-lg font-bold text-status-waiting">R$ 0,00</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={onClose}
              className="flex-1 min-h-touch-target border border-border-strong text-ink-secondary hover:text-ink-primary font-semibold rounded-md transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={salvando || itens.length === 0}
              onClick={handleSalvarEncomenda}
              className="flex-2 min-h-touch-target bg-brand-primary hover:bg-brand-hover text-ink-inverse font-bold text-label-strong rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {salvando ? 'Salvando Encomenda...' : 'Confirmar Encomenda'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
