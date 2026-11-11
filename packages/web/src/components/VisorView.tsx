import { useState, useCallback } from 'react';
import { VisorLeituraHibrido } from './VisorLeituraHibrido';
import { ProdutoModal } from './ProdutoModal';
import type { ProdutoDTO } from '../types/produto';

interface VisorViewProps {
  sessionToken?: string;
  onSelecionarProdutoParaFluxo?: (produto: ProdutoDTO) => void;
}

export function VisorView({ sessionToken, onSelecionarProdutoParaFluxo }: VisorViewProps) {
  const [produtosBipados, setProdutosBipados] = useState<ProdutoDTO[]>([]);
  const [ultimoProdutoLido, setUltimoProdutoLido] = useState<ProdutoDTO | null>(null);
  const [consultandoCodigo, setConsultandoCodigo] = useState(false);
  const [alertaErro, setAlertaErro] = useState<string | null>(null);

  // Estado para código não cadastrado no catálogo (FR-008)
  const [codigoNaoCadastrado, setCodigoNaoCadastrado] = useState<string | null>(null);
  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);

  // Busca rápida de produto por código de barras ou nome
  const handleCodigoLido = useCallback(
    async (termoBusca: string) => {
      const termoLimpo = termoBusca.trim();
      if (!termoLimpo) return;

      setConsultandoCodigo(true);
      setAlertaErro(null);

      try {
        const headers: Record<string, string> = {};
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const ehProvavelCodigoBarras = /^\d+$/.test(termoLimpo);

        // Se for puramente numérico, tenta busca direta por código de barras primeiro
        if (ehProvavelCodigoBarras) {
          const resCodigo = await fetch(`/api/produtos/codigo/${encodeURIComponent(termoLimpo)}`, { headers });
          if (resCodigo.ok) {
            const produto: ProdutoDTO = await resCodigo.json();
            setUltimoProdutoLido(produto);
            setProdutosBipados((prev) => [produto, ...prev]);
            if (onSelecionarProdutoParaFluxo) onSelecionarProdutoParaFluxo(produto);
            return;
          }
        }

        // Se não for numérico ou se a busca por código deu 404, pesquisa no catálogo por nome/termo
        const resBusca = await fetch(`/api/produtos?busca=${encodeURIComponent(termoLimpo)}`, { headers });
        if (resBusca.ok) {
          const lista: ProdutoDTO[] = await resBusca.json();
          if (lista && lista.length > 0) {
            const produtoEncontrado = lista[0];
            setUltimoProdutoLido(produtoEncontrado);
            setProdutosBipados((prev) => [produtoEncontrado, ...prev]);
            if (onSelecionarProdutoParaFluxo) onSelecionarProdutoParaFluxo(produtoEncontrado);
            return;
          }
        }

        // Se não encontrou no catálogo:
        if (ehProvavelCodigoBarras) {
          // Código numérico não encontrado: abre diálogo acolhedor de cadastro imediato (FR-008)
          setCodigoNaoCadastrado(termoLimpo);
        } else {
          // Termo textual não encontrado: exibe aviso acolhedor sem abrir modal de código indevidamente
          setAlertaErro(`Nenhum produto encontrado com o nome ou termo "${termoLimpo}". Tente outro termo ou cadastre um novo produto.`);
        }
      } catch (err: any) {
        console.warn('Erro ao consultar produto no visor:', err);
        setAlertaErro('Erro de conexão ao buscar produto. Seus dados estão seguros.');
      } finally {
        setConsultandoCodigo(false);
      }
    },
    [sessionToken, onSelecionarProdutoParaFluxo]
  );

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
      {/* Cabeçalho da Tela com Instrução Clara */}
      <div className="bg-surface-raised border border-border-hairline rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-title-lg font-bold text-ink-primary">Leitor / Visor de Produtos</h2>
          <p className="text-body-md text-ink-secondary">
            Modo contínuo • Aponte o código para conferir estoque e detalhes
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-brand-subtle flex items-center justify-center text-xl shrink-0">
          🔍
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

      {/* Visor Híbrido com Câmera Auto-Start e Campo Manual (UX-DR2, FR-007, FR-009) */}
      <VisorLeituraHibrido
        onCodigoLido={handleCodigoLido}
        autoStart={true}
        pausado={Boolean(codigoNaoCadastrado || modalCadastroAberto)}
        emiteSom={true}
        placeholderManual="Ex: 7891234567890 ou digite o código/nome..."
      />

      {/* Indicador de Consulta em Andamento */}
      {consultandoCodigo && (
        <div className="flex items-center justify-center gap-2 p-3 bg-surface-sunken rounded-lg text-ink-secondary text-body-md animate-pulse">
          <span className="text-lg animate-spin">⏳</span>
          <span>Consultando catálogo e estoque...</span>
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
            <span>Código: {ultimoProdutoLido.codigo_barras || 'Sem código'}</span>
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
                    {item.codigo_barras ? `EAN: ${item.codigo_barras}` : 'Manual'} • {item.preco_venda_formatado}
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
                O código de barras <span className="font-mono font-bold text-ink-primary">{codigoNaoCadastrado}</span> ainda não consta no seu catálogo.
              </p>
              <p className="text-meta text-ink-muted mt-2">
                Deseja cadastrar esse novo produto agora com o código já preenchido?
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalCadastroAberto(true)}
                className="min-h-touch-target bg-brand-primary hover:bg-brand-hover text-ink-inverse font-bold text-label-strong rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <span>+</span> Cadastrar Produto Agora
              </button>

              <button
                type="button"
                onClick={() => setCodigoNaoCadastrado(null)}
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
