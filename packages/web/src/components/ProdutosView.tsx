import { useState, useEffect } from 'react';
import type { ProdutoDTO } from '../types/produto';
import type { EstoqueDTO } from '../types/estoque';
import { ProdutoModal } from './ProdutoModal';
import { MarcasModal } from './MarcasModal';
import { EstoqueInicialModal } from './EstoqueInicialModal';

interface ProdutosViewProps {
  sessionToken?: string;
  refreshTrigger?: number;
}

export function ProdutosView({ sessionToken, refreshTrigger }: ProdutosViewProps) {
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [estoqueMap, setEstoqueMap] = useState<Record<string, EstoqueDTO>>({});
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Modais
  const [produtoModalAberto, setProdutoModalAberto] = useState(false);
  const [produtoParaEditar, setProdutoParaEditar] = useState<ProdutoDTO | null>(null);
  const [marcasModalAberto, setMarcasModalAberto] = useState(false);
  const [estoqueModalAberto, setEstoqueModalAberto] = useState(false);
  const [produtoParaEstoque, setProdutoParaEstoque] = useState<ProdutoDTO | null>(null);

  // Carrega produtos do catálogo
  const carregarProdutos = async (termo = '') => {
    setCarregando(true);
    setErro(null);

    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const query = termo.trim() ? `?busca=${encodeURIComponent(termo.trim())}` : '';
      const res = await fetch(`/api/produtos${query}`, { headers });

      if (!res.ok) {
        throw new Error('Falha ao consultar catálogo de produtos.');
      }

      const data = await res.json();
      setProdutos(data);
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar produtos.');
    } finally {
      setCarregando(false);
    }
  };

  // Carrega mapa de estoque separadamente (no carregamento inicial ou após alteração de estoque)
  const carregarEstoque = async () => {
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch('/api/estoque', { headers });
      if (res.ok) {
        const dataEstoque: EstoqueDTO[] = await res.json();
        const map: Record<string, EstoqueDTO> = {};
        for (const item of dataEstoque) {
          map[item.produto_id] = item;
        }
        setEstoqueMap(map);
      }
    } catch {
      // Falha silenciosa no mapa de estoque
    }
  };

  useEffect(() => {
    carregarProdutos(busca);
  }, [sessionToken, refreshTrigger]);

  useEffect(() => {
    carregarEstoque();
  }, [sessionToken, refreshTrigger]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    carregarProdutos(busca);
  };

  const handleExcluirProduto = async (produto: ProdutoDTO) => {
    const nomeExibicao = `${produto.nome}${produto.variante ? ` (${produto.variante})` : ''}`;
    if (!window.confirm(`Deseja realmente remover o produto "${nomeExibicao}" do seu catálogo?`)) {
      return;
    }

    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const res = await fetch(`/api/produtos/${produto.id}`, {
        method: 'DELETE',
        headers
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || 'Erro ao excluir produto.');
      }

      carregarProdutos(busca);
    } catch (err: any) {
      alert(err.message || 'Não foi possível excluir o produto.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Barra Superior de Ações do Catálogo */}
      <div className="bg-surface-raised border border-border-hairline rounded-lg p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-title-lg font-bold text-ink-primary">Catálogo de Produtos</h2>
            <p className="text-meta text-ink-secondary">
              Gerencie seus produtos, variantes e precificação com proveniência de custo.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setMarcasModalAberto(true)}
              className="flex-1 sm:flex-none min-h-touch-target px-4 bg-surface-base hover:bg-surface-sunken border border-border-strong text-ink-primary font-semibold text-label-strong rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <span>🏷️</span> Marcas & Percentuais
            </button>

            <button
              type="button"
              onClick={() => {
                setProdutoParaEditar(null);
                setProdutoModalAberto(true);
              }}
              className="flex-1 sm:flex-none min-h-touch-target px-4 bg-brand-primary hover:bg-brand-hover text-ink-inverse font-bold text-label-strong rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <span>+</span> Novo Produto
            </button>
          </div>
        </div>

        {/* Campo de Busca Rápida */}
        <form onSubmit={handleBuscar} className="flex gap-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              if (e.target.value === '') {
                carregarProdutos('');
              }
            }}
            placeholder="Buscar por nome, variante ou código de barras..."
            className="flex-1 min-h-touch-target px-3 border border-border-strong rounded-md bg-surface-base text-ink-primary text-body-md focus:outline-brand-primary"
          />
          <button
            type="submit"
            className="min-h-touch-target px-4 bg-surface-raised border border-border-strong text-ink-primary font-semibold rounded-md hover:bg-surface-sunken"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Erro */}
      {erro && (
        <div className="p-3 bg-status-alert-bg border border-status-alert text-status-alert rounded-md text-body-md">
          ⚠️ {erro}
        </div>
      )}

      {/* Resumo */}
      <div className="flex items-center justify-between px-1">
        <span className="text-label-strong text-ink-secondary">
          {carregando ? 'Buscando produtos...' : `${produtos.length} produtos no catálogo`}
        </span>
      </div>

      {/* Lista de Produtos */}
      {produtos.length === 0 && !carregando ? (
        <div className="bg-surface-raised border border-dashed border-border-hairline rounded-lg p-8 text-center flex flex-col items-center gap-3">
          <span className="text-3xl">📦</span>
          <h3 className="text-title-md font-bold text-ink-primary">Nenhum produto encontrado</h3>
          <p className="text-body-md text-ink-secondary max-w-sm">
            {busca.trim()
              ? `Não encontramos nenhum item com o termo "${busca}".`
              : 'Você ainda não cadastrou produtos. Cadastre seus hidratantes, perfumes e cosméticos com suas variantes para começar!'}
          </p>
          <button
            type="button"
            onClick={() => {
              setProdutoParaEditar(null);
              setProdutoModalAberto(true);
            }}
            className="min-h-touch-target px-6 bg-brand-primary text-ink-inverse font-bold text-label-strong rounded-md mt-2 shadow-sm"
          >
            + Cadastrar Primeiro Produto
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {produtos.map((p) => {
            return (
              <div
                key={p.id}
                className="bg-surface-raised border border-border-hairline rounded-lg p-4 shadow-sm flex flex-col gap-2 hover:border-brand-primary/40 transition-colors"
              >
                {/* Topo do Card: Marca e Nome */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {p.marca_nome && (
                      <span className="text-meta font-bold uppercase tracking-wider text-brand-primary block">
                        {p.marca_nome}
                      </span>
                    )}
                    <h3 className="text-title-md font-bold text-ink-primary leading-snug">
                      {p.nome}
                      {p.variante && (
                        <span className="text-ink-secondary font-normal ml-1">
                          — {p.variante}
                        </span>
                      )}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProdutoParaEditar(p);
                        setProdutoModalAberto(true);
                      }}
                      className="p-2 text-ink-secondary hover:text-brand-primary text-meta font-semibold rounded-md hover:bg-surface-sunken"
                      title="Editar Produto"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExcluirProduto(p)}
                      className="p-2 text-status-alert hover:text-red-700 text-meta font-semibold rounded-md hover:bg-status-alert-bg"
                      title="Excluir Produto"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Códigos e situação no catálogo do ciclo */}
                {(p.codigo_barras || p.codigo_revista || p.fora_do_ciclo) && (
                  <div className="text-meta text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1">
                    {p.codigo_revista && (
                      <span>
                        Revista: <span className="font-mono">{p.codigo_revista}</span>
                      </span>
                    )}
                    {p.codigo_barras && (
                      <span>
                        EAN: <span className="font-mono">{p.codigo_barras}</span>
                      </span>
                    )}
                    {p.fora_do_ciclo && (
                      <span
                        className="px-2 py-0.5 rounded bg-status-reserved-bg text-status-reserved font-semibold"
                        title={`Último catálogo em que apareceu: ${p.ciclo_catalogo}`}
                      >
                        Fora do ciclo atual
                      </span>
                    )}
                  </div>
                )}

                {/* Miolo do Card: Pílulas de Quantidade de Estoque e Gatilho (AD-3, UX-DR3) */}
                {(() => {
                  const est = estoqueMap[p.id];
                  return (
                    <div className="py-2 px-3 bg-surface-base/80 border border-border-hairline rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 my-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-meta font-semibold text-ink-secondary mr-1">Estoque:</span>
                        <span
                          className="inline-flex items-center gap-1 bg-status-available-bg text-status-available border border-status-available/20 text-xs font-bold px-2.5 py-0.5 rounded-full"
                          title="Unidades físicas presentes na estante (Presentes = Reservados + ProntaEntrega)"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-status-available" />
                          {est?.presentes ?? 0} Presentes
                        </span>
                        <span
                          className="inline-flex items-center gap-1 bg-status-reserved-bg text-status-reserved border border-status-reserved/30 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                          title="Unidades reservadas para encomendas de clientes"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-status-reserved" />
                          {est?.reservados ?? 0} Reservados
                        </span>
                        <span
                          className="inline-flex items-center gap-1 bg-status-available-bg/60 text-status-available border border-status-available/20 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                          title="Unidades prontas para entrega ou venda imediata"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-status-available" />
                          {est?.pronta_entrega ?? 0} Pronta-Entrega
                        </span>
                        <span
                          className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                          title="Unidades pedidas à marca ou encomendadas aguardando entrega da fábrica"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {est?.aguardando_fabrica ?? 0} Aguardando Fábrica
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setProdutoParaEstoque(p);
                          setEstoqueModalAberto(true);
                        }}
                        className="w-full sm:w-auto min-h-touch-target px-3.5 py-1.5 bg-surface-raised hover:bg-surface-sunken border border-border-strong text-ink-primary font-semibold text-meta rounded-md flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                        title="Lançar ou atualizar contagem de estoque inicial"
                      >
                        <span>📦</span>
                        <span>{est ? 'Contagem Física' : 'Lançar Estoque Inicial'}</span>
                      </button>
                    </div>
                  );
                })()}

                {/* Linha de Preço e Custo */}
                <div className="pt-2 border-t border-border-hairline flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-meta text-ink-secondary block">Preço de Venda</span>
                    <span className="text-title-lg font-bold text-ink-primary">
                      {p.preco_venda_formatado}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-meta text-ink-secondary block">Custo Estimado</span>
                    <div className="flex items-center gap-2">
                      <span className="text-body-lg font-semibold text-ink-primary">
                        {p.custo_formatado}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          p.proveniencia_custo === 'ESTIMADO_PERCENTUAL'
                            ? 'bg-status-waiting-bg text-status-waiting'
                            : p.proveniencia_custo === 'INFORMADO_MANUAL'
                            ? 'bg-status-available-bg text-status-available'
                            : 'bg-surface-sunken text-ink-secondary'
                        }`}
                      >
                        {p.proveniencia_custo === 'ESTIMADO_PERCENTUAL' && 'Marca'}
                        {p.proveniencia_custo === 'INFORMADO_MANUAL' && 'Manual'}
                        {p.proveniencia_custo === 'DESCONHECIDO' && 'Desconhecido'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Produto */}
      <ProdutoModal
        isOpen={produtoModalAberto}
        produtoParaEditar={produtoParaEditar}
        onClose={() => {
          setProdutoModalAberto(false);
          setProdutoParaEditar(null);
        }}
        sessionToken={sessionToken}
        onProdutoSalvo={() => {
          carregarProdutos(busca);
        }}
        onAbrirGerenciadorMarcas={() => {
          setProdutoModalAberto(false);
          setMarcasModalAberto(true);
        }}
      />

      {/* Modal de Marcas */}
      <MarcasModal
        isOpen={marcasModalAberto}
        onClose={() => setMarcasModalAberto(false)}
        sessionToken={sessionToken}
        onMarcasAtualizadas={() => {
          carregarProdutos(busca);
        }}
      />

      {/* Modal de Estoque Inicial */}
      <EstoqueInicialModal
        isOpen={estoqueModalAberto}
        produto={produtoParaEstoque}
        estoqueAtual={produtoParaEstoque ? estoqueMap[produtoParaEstoque.id] : null}
        onClose={() => {
          setEstoqueModalAberto(false);
          setProdutoParaEstoque(null);
        }}
        onEstoqueAtualizado={() => {
          carregarEstoque();
          carregarProdutos(busca);
        }}
        sessionToken={sessionToken}
      />
    </div>
  );
}
