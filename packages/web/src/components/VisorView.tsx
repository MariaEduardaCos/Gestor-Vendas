import { useState, useCallback } from 'react';
import { classificarCodigo, normalizarTexto } from '@consultorasync/core';
import { VisorLeituraHibrido } from './VisorLeituraHibrido';
import { PainelPareamentoDesktop } from './PainelPareamentoDesktop';
import { ProdutoModal } from './ProdutoModal';
import type { ProdutoDTO } from '../types/produto';

interface SugestaoCompartilhada {
  marca_nome: string;
  nome: string;
  variante: string | null;
  codigo_barras: string | null;
  codigo_revista: string | null;
  preco_sugerido_centavos: number;
  ciclo: string;
}

const MAX_ESCOLHAS = 10;
const reais = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface VisorViewProps {
  sessionToken?: string;
  onSelecionarProdutoParaFluxo?: (produto: ProdutoDTO) => void;
}

export function VisorView({ sessionToken, onSelecionarProdutoParaFluxo }: VisorViewProps) {
  const [modoLeitura, setModoLeitura] = useState<'LOCAL' | 'REMOTO'>('LOCAL');
  const [produtosBipados, setProdutosBipados] = useState<ProdutoDTO[]>([]);
  const [ultimoProdutoLido, setUltimoProdutoLido] = useState<ProdutoDTO | null>(null);
  const [consultandoCodigo, setConsultandoCodigo] = useState(false);
  const [alertaErro, setAlertaErro] = useState<string | null>(null);

  // Estado para código não cadastrado no catálogo (FR-008)
  const [codigoNaoCadastrado, setCodigoNaoCadastrado] = useState<string | null>(null);
  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);

  // Mais de um produto para o que foi lido/digitado: a revendedora escolhe (nada é escolhido sozinho)
  const [escolhas, setEscolhas] = useState<{ titulo: string; produtos: ProdutoDTO[] } | null>(null);
  const [sugestao, setSugestao] = useState<SugestaoCompartilhada | null>(null);

  const selecionar = useCallback(
    (produto: ProdutoDTO) => {
      setEscolhas(null);
      setUltimoProdutoLido(produto);
      setProdutosBipados((prev) => [produto, ...prev]);
      if (onSelecionarProdutoParaFluxo) onSelecionarProdutoParaFluxo(produto);
    },
    [onSelecionarProdutoParaFluxo]
  );

  // Busca por código de barras, código da revista ou nome
  const handleCodigoLido = useCallback(
    async (termoBusca: string) => {
      const c = classificarCodigo(termoBusca);
      if (!c.valor) return;

      setConsultandoCodigo(true);
      setAlertaErro(null);
      setEscolhas(null);
      setSugestao(null);

      try {
        const headers: Record<string, string> = {};
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        if (c.tipo !== 'TEXTO') {
          const res = await fetch(`/api/produtos/por-codigo/${encodeURIComponent(c.valor)}`, { headers });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const lista: ProdutoDTO[] = await res.json();
          if (lista.length === 1) return selecionar(lista[0]);
          if (lista.length > 1) {
            setEscolhas({ titulo: `O código ${c.valor} está em ${lista.length} produtos. Qual deles?`, produtos: lista });
            return;
          }
          // Não cadastrado: procura no catálogo compartilhado e oferece o cadastro (FR-008)
          const resRef = await fetch(`/api/catalogo-compartilhado/codigo/${encodeURIComponent(c.valor)}`, { headers });
          if (resRef.ok) {
            const refs: SugestaoCompartilhada[] = await resRef.json();
            setSugestao(refs[0] ?? null);
          }
          setCodigoNaoCadastrado(c.valor);
          return;
        }

        if (normalizarTexto(c.valor).length < 2) {
          setAlertaErro('Digite o código ou pelo menos 2 letras do nome.');
          return;
        }
        const resBusca = await fetch(`/api/produtos?busca=${encodeURIComponent(c.valor)}`, { headers });
        if (!resBusca.ok) throw new Error(`HTTP ${resBusca.status}`);
        const lista: ProdutoDTO[] = await resBusca.json();
        if (lista.length === 1) return selecionar(lista[0]);
        if (lista.length > 1) {
          setEscolhas({
            titulo:
              lista.length > MAX_ESCOLHAS
                ? `${lista.length} produtos com "${c.valor}". Mostrando ${MAX_ESCOLHAS}; digite mais do nome para filtrar.`
                : `${lista.length} produtos com "${c.valor}". Qual deles?`,
            produtos: lista.slice(0, MAX_ESCOLHAS)
          });
          return;
        }
        setAlertaErro(`Nenhum produto encontrado com "${c.valor}". Tente outro termo ou cadastre um novo produto.`);
      } catch (err: any) {
        console.warn('Erro ao consultar produto no visor:', err);
        setAlertaErro('Erro de conexão ao buscar produto. Seus dados estão seguros.');
      } finally {
        setConsultandoCodigo(false);
      }
    },
    [sessionToken, selecionar]
  );

  const usarSugestao = async (s: SugestaoCompartilhada) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;
      const marcas: Array<{ id: string; nome: string }> = await fetch('/api/marcas', { headers }).then((r) => (r.ok ? r.json() : []));
      const marca = marcas.find((m) => normalizarTexto(m.nome) === normalizarTexto(s.marca_nome));
      const res = await fetch('/api/produtos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          marca_id: marca?.id ?? null,
          nome: s.nome,
          variante: s.variante,
          codigo_barras: s.codigo_barras,
          codigo_revista: s.codigo_revista,
          preco_venda_centavos: s.preco_sugerido_centavos
        })
      });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo?.detail || 'Não foi possível cadastrar o produto.');
      setSugestao(null);
      handleProdutoCadastradoComSucesso({ ...corpo, estoque: { presentes: 0, reservados: 0, pronta_entrega: 0 } });
    } catch (e) {
      setAlertaErro((e as Error).message);
    }
  };

  const handleProdutoCadastradoComSucesso = (novoProduto: ProdutoDTO) => {
    setModalCadastroAberto(false);
    setCodigoNaoCadastrado(null);
    setUltimoProdutoLido(novoProduto);
    setProdutosBipados((prev) => [novoProduto, ...prev]);
    if (onSelecionarProdutoParaFluxo) {
      onSelecionarProdutoParaFluxo(novoProduto);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Cabeçalho da Tela com Alternador entre Leitor Local e Celular Remoto */}
      <div className="bg-surface-raised border border-border-hairline rounded-lg p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-title-lg font-bold text-ink-primary">Leitor / Visor de Produtos</h2>
          <p className="text-body-md text-ink-secondary">
            {modoLeitura === 'LOCAL'
              ? 'Modo contínuo • Aponte o código para conferir estoque e detalhes'
              : 'Pareamento efêmero ativo • Celular transmitindo bips para o computador'}
          </p>
        </div>

        {/* Alternador de Modo de Leitura (Local vs Pareado) */}
        <div className="flex items-center gap-1 bg-surface-sunken p-1 rounded-lg border border-border-hairline shrink-0">
          <button
            type="button"
            onClick={() => setModoLeitura('LOCAL')}
            className={`min-h-[44px] px-3 py-1.5 rounded-md font-semibold text-label-strong text-sm transition-colors flex items-center gap-1.5 ${
              modoLeitura === 'LOCAL'
                ? 'bg-surface-raised text-ink-primary shadow-xs'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <span>📷</span> Câmera Local
          </button>
          <button
            type="button"
            onClick={() => setModoLeitura('REMOTO')}
            className={`min-h-[44px] px-3 py-1.5 rounded-md font-semibold text-label-strong text-sm transition-colors flex items-center gap-1.5 ${
              modoLeitura === 'REMOTO'
                ? 'bg-brand-primary text-ink-inverse shadow-xs'
                : 'text-ink-secondary hover:text-ink-primary'
            }`}
          >
            <span>📱</span> Parear Celular
          </button>
        </div>
      </div>

      {/* Alerta de Erro de Conexão ou Servidor */}
      {alertaErro && (
        <div className="bg-status-alert-bg border border-status-alert text-status-alert p-3 rounded-lg text-body-md flex items-center justify-between shadow-sm">
          <span>⚠️ {alertaErro}</span>
          <button
            type="button"
            onClick={() => setAlertaErro(null)}
            className="text-status-alert font-bold ml-2 text-title-md"
          >
            ✕
          </button>
        </div>
      )}

      {/* Exibição do Visor Local ou Painel de Pareamento Desktop */}
      {modoLeitura === 'LOCAL' ? (
        <VisorLeituraHibrido
          onCodigoLido={handleCodigoLido}
          autoStart={true}
          pausado={Boolean(codigoNaoCadastrado || modalCadastroAberto)}
          emiteSom={true}
          placeholderManual="Código de barras, da revista ou nome"
        />
      ) : (
        <PainelPareamentoDesktop
          sessionToken={sessionToken}
          onCodigoLido={handleCodigoLido}
        />
      )}

      {/* Indicador de Consulta em Andamento */}
      {consultandoCodigo && (
        <div className="flex items-center justify-center gap-2 p-3 bg-surface-sunken rounded-lg text-ink-secondary text-body-md animate-pulse">
          <span className="text-lg animate-spin">⏳</span>
          <span>Consultando catálogo e estoque...</span>
        </div>
      )}

      {/* Mais de um produto encontrado: escolher */}
      {escolhas && (
        <div className="bg-surface-raised border-2 border-status-reserved rounded-lg p-4 shadow-sm flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-body-md font-semibold text-ink-primary">{escolhas.titulo}</p>
            <button type="button" onClick={() => setEscolhas(null)} className="text-meta font-semibold text-ink-secondary min-h-[36px] px-2">
              Fechar
            </button>
          </div>
          <ul className="flex flex-col gap-1" aria-label="Produtos encontrados">
            {escolhas.produtos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => selecionar(p)}
                  className="w-full text-left min-h-[48px] px-3 py-2 rounded-md bg-surface-sunken hover:bg-brand-subtle flex items-center gap-3"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">
                      {p.nome}
                      {p.variante ? ` (${p.variante})` : ''}
                    </span>
                    <span className="block text-meta text-ink-muted truncate">
                      {[p.marca_nome, p.codigo_revista && `revista ${p.codigo_revista}`, p.fora_do_ciclo && 'fora do ciclo atual', `${p.estoque?.pronta_entrega ?? 0} livres`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="text-label-strong tabular-nums">{p.preco_venda_formatado}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Destaque do Último Produto Identificado */}
      {ultimoProdutoLido && (
        <div className="bg-surface-raised border-2 border-brand-primary rounded-lg p-4 shadow-md flex flex-col gap-3 animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <span className="bg-status-available-bg text-status-available text-meta font-bold px-2.5 py-1 rounded-full">
                ✓ Produto Identificado
              </span>
              <h3 className="text-title-md font-bold text-ink-primary mt-1.5">
                {ultimoProdutoLido.nome}
                {ultimoProdutoLido.variante ? ` (${ultimoProdutoLido.variante})` : ''}
              </h3>
              {ultimoProdutoLido.marca_nome && (
                <p className="text-meta text-ink-secondary font-medium">
                  Marca: {ultimoProdutoLido.marca_nome}
                  {ultimoProdutoLido.ciclo_catalogo ? ` · ${ultimoProdutoLido.ciclo_catalogo}` : ''}
                </p>
              )}
              {ultimoProdutoLido.fora_do_ciclo && (
                <p className="mt-1 inline-block text-meta font-semibold px-2 py-0.5 rounded bg-status-reserved-bg text-status-reserved">
                  Fora do ciclo atual: confira o preço na revista nova
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="text-meta text-ink-muted">Preço de Venda</span>
              <p className="text-title-md font-bold text-ink-primary">
                {ultimoProdutoLido.preco_venda_formatado}
              </p>
            </div>
          </div>

          {/* Pílulas de Quantidade e Conservação de Estoque (AD-3, S4) */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-hairline">
            <div className="bg-surface-sunken rounded-md p-2 text-center">
              <span className="text-meta text-ink-muted block">Presentes</span>
              <span className="text-title-md font-bold text-ink-primary">
                {ultimoProdutoLido.estoque?.presentes ?? 0}
              </span>
            </div>
            <div className="bg-status-reserved-bg rounded-md p-2 text-center">
              <span className="text-meta text-status-reserved font-semibold block">Reservados</span>
              <span className="text-title-md font-bold text-status-reserved">
                {ultimoProdutoLido.estoque?.reservados ?? 0}
              </span>
            </div>
            <div className="bg-status-available-bg rounded-md p-2 text-center">
              <span className="text-meta text-status-available font-semibold block">Pronta-Entrega</span>
              <span className="text-title-md font-bold text-status-available">
                {ultimoProdutoLido.estoque?.pronta_entrega ?? 0}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-meta text-ink-muted pt-1">
            <span>
              Código: {ultimoProdutoLido.codigo_barras || 'sem código de barras'}
              {ultimoProdutoLido.codigo_revista ? ` · revista ${ultimoProdutoLido.codigo_revista}` : ''}
            </span>
            <span>Custo: {ultimoProdutoLido.custo_formatado}</span>
          </div>
        </div>
      )}

      {/* Histórico da Sessão de Leitura Contínua */}
      {produtosBipados.length > 0 && (
        <div className="bg-surface-raised border border-border-hairline rounded-lg p-4 shadow-sm flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-title-md font-bold text-ink-primary">
              Produtos Lidos ({produtosBipados.length})
            </h3>
            <button
              type="button"
              onClick={() => {
                setProdutosBipados([]);
                setUltimoProdutoLido(null);
              }}
              className="text-meta font-semibold text-brand-primary hover:underline min-h-[36px] px-2"
            >
              Limpar Lista
            </button>
          </div>

          <div className="flex flex-col divide-y divide-border-hairline max-h-80 overflow-y-auto">
            {produtosBipados.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-body-md font-semibold text-ink-primary truncate">
                    {item.nome}
                    {item.variante ? ` (${item.variante})` : ''}
                  </p>
                  <p className="text-meta text-ink-muted">
                    {item.codigo_barras ? `EAN: ${item.codigo_barras}` : item.codigo_revista ? `Revista: ${item.codigo_revista}` : 'Manual'} • {item.preco_venda_formatado}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-meta font-bold px-2 py-0.5 rounded-full bg-status-available-bg text-status-available">
                    {item.estoque?.pronta_entrega ?? 0} livres
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diálogo Acolhedor de Produto Não Cadastrado (FR-008) */}
      {codigoNaoCadastrado && !modalCadastroAberto && (
        <div className="fixed inset-0 z-50 bg-ink-primary/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-raised border border-border-hairline rounded-lg max-w-sm w-full p-5 shadow-2xl flex flex-col gap-4 animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-status-reserved-bg text-status-reserved flex items-center justify-center text-2xl mx-auto">
              🏷️
            </div>

            <div className="text-center">
              <h3 className="text-title-md font-bold text-ink-primary">
                Produto Não Cadastrado
              </h3>
              <p className="text-body-md text-ink-secondary mt-1 leading-relaxed">
                O {classificarCodigo(codigoNaoCadastrado).tipo === 'REVISTA' ? 'código da revista' : 'código de barras'}{' '}
                <span className="font-mono font-bold text-ink-primary">{codigoNaoCadastrado}</span> ainda não consta no seu catálogo.
              </p>
              {!sugestao && (
                <p className="text-meta text-ink-muted mt-2">
                  Deseja cadastrar esse novo produto agora com o código já preenchido?
                </p>
              )}
            </div>

            {sugestao && (
              <div className="p-3 rounded-md border border-status-available bg-status-available-bg text-body-md">
                <p className="text-meta text-status-available font-semibold">Encontrado no catálogo compartilhado</p>
                <p className="font-semibold text-ink-primary">
                  {sugestao.nome}
                  {sugestao.variante ? ` — ${sugestao.variante}` : ''}
                </p>
                <p className="text-meta text-ink-secondary">
                  {sugestao.marca_nome} · {reais(sugestao.preco_sugerido_centavos)} · {sugestao.ciclo}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              {sugestao && (
                <button
                  type="button"
                  onClick={() => usarSugestao(sugestao)}
                  className="min-h-touch-target bg-status-available text-ink-inverse font-bold text-label-strong rounded-md"
                >
                  Usar este produto
                </button>
              )}
              <button
                type="button"
                onClick={() => setModalCadastroAberto(true)}
                className={`min-h-touch-target font-bold text-label-strong rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors ${
                  sugestao ? 'border border-border-strong text-ink-primary hover:bg-surface-sunken' : 'bg-brand-primary hover:bg-brand-hover text-ink-inverse'
                }`}
              >
                <span>+</span> {sugestao ? 'Cadastrar outro produto' : 'Cadastrar Produto Agora'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCodigoNaoCadastrado(null);
                  setSugestao(null);
                }}
                className="min-h-touch-target bg-surface-sunken hover:bg-border-hairline text-ink-secondary font-semibold text-label-strong rounded-md transition-colors"
              >
                Continuar sem Cadastrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro de Produto com Código Pré-Preenchido */}
      {modalCadastroAberto && (
        <ProdutoModal
          isOpen={modalCadastroAberto}
          codigoPrePreenchido={codigoNaoCadastrado || undefined}
          onClose={() => {
            setModalCadastroAberto(false);
            setCodigoNaoCadastrado(null);
          }}
          onProdutoSalvo={handleProdutoCadastradoComSucesso}
          sessionToken={sessionToken}
        />
      )}
    </div>
  );
}
