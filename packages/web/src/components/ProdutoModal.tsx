import { useState, useEffect } from 'react';
import { classificarCodigo, normalizarTexto } from '@consultorasync/core';
import type { ProdutoDTO, MarcaDTO } from '../types/produto';

interface ProdutoModalProps {
  isOpen: boolean;
  produtoParaEditar?: ProdutoDTO | null;
  codigoPrePreenchido?: string;
  /** Dados trazidos do catálogo ou da pesquisa online para um produto novo (a revendedora confere). */
  dadosIniciais?: { nome?: string; marcaNome?: string | null; precoCentavos?: number | null; imagemUrl?: string | null } | null;
  onClose: () => void;
  onProdutoSalvo: (produto: ProdutoDTO) => void;
  sessionToken?: string;
  onAbrirGerenciadorMarcas?: () => void;
}

export function ProdutoModal({
  isOpen,
  produtoParaEditar,
  codigoPrePreenchido,
  dadosIniciais,
  onClose,
  onProdutoSalvo,
  sessionToken,
  onAbrirGerenciadorMarcas
}: ProdutoModalProps) {
  const [marcas, setMarcas] = useState<MarcaDTO[]>([]);
  const [marcaId, setMarcaId] = useState('');
  const [nome, setNome] = useState('');
  const [variante, setVariante] = useState('');
  const [codigoBarras, setCodigoBarras] = useState('');
  const [codigoRevista, setCodigoRevista] = useState('');
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [precoVendaReais, setPrecoVendaReais] = useState('');
  const [informarCustoManual, setInformarCustoManual] = useState(false);
  const [custoManualReais, setCustoManualReais] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega marcas disponíveis
  const carregarMarcas = async () => {
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      const res = await fetch('/api/marcas', { headers });
      if (res.ok) {
        const data = await res.json();
        setMarcas(data);
      }
    } catch (e) {
      console.warn('Erro ao carregar marcas:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarMarcas();
      setErro(null);

      if (produtoParaEditar) {
        setMarcaId(produtoParaEditar.marca_id || '');
        setNome(produtoParaEditar.nome);
        setVariante(produtoParaEditar.variante || '');
        setCodigoBarras(produtoParaEditar.codigo_barras || '');
        setCodigoRevista(produtoParaEditar.codigo_revista || '');
        setImagemUrl(produtoParaEditar.imagem_url ?? null);
        setPrecoVendaReais((produtoParaEditar.preco_venda_centavos / 100).toFixed(2).replace('.', ','));

        if (produtoParaEditar.proveniencia_custo === 'INFORMADO_MANUAL' && produtoParaEditar.custo_centavos !== null) {
          setInformarCustoManual(true);
          setCustoManualReais((produtoParaEditar.custo_centavos / 100).toFixed(2).replace('.', ','));
        } else {
          setInformarCustoManual(false);
          setCustoManualReais('');
        }
      } else {
        setMarcaId('');
        setNome(dadosIniciais?.nome ?? '');
        setImagemUrl(dadosIniciais?.imagemUrl ?? null);
        setVariante('');
        // Código curto lido/digitado é o da revista; longo é o de barras.
        const pre = classificarCodigo(codigoPrePreenchido);
        setCodigoBarras(pre.tipo === 'BARRAS' ? pre.valor : '');
        setCodigoRevista(pre.tipo === 'REVISTA' ? pre.valor : '');
        setPrecoVendaReais(dadosIniciais?.precoCentavos ? (dadosIniciais.precoCentavos / 100).toFixed(2).replace('.', ',') : '');
        setInformarCustoManual(false);
        setCustoManualReais('');
      }
    }
  }, [isOpen, produtoParaEditar, codigoPrePreenchido, dadosIniciais]);

  // Marca sugerida pela pesquisa: seleciona se a revendedora já vende essa marca.
  useEffect(() => {
    if (!isOpen || produtoParaEditar || marcaId || !dadosIniciais?.marcaNome) return;
    const alvo = normalizarTexto(dadosIniciais.marcaNome);
    const marca = marcas.find((m) => normalizarTexto(m.nome) === alvo);
    if (marca) setMarcaId(marca.id);
  }, [isOpen, produtoParaEditar, marcas, dadosIniciais, marcaId]);

  if (!isOpen) return null;

  // Encontra a marca selecionada para pré-visualização de custo
  const marcaSelecionada = marcas.find((m) => m.id === marcaId);

  // Converte reais para centavos tratando vírgula (100,50) e ponto (100.50)
  const parseReaisParaCentavos = (valorStr: string): number | null => {
    const limpo = valorStr.trim();
    if (!limpo) return null;
    let normalizado = limpo;
    if (normalizado.includes(',')) {
      normalizado = normalizado.replace(/\./g, '').replace(',', '.');
    } else {
      const partes = normalizado.split('.');
      if (partes.length > 2) {
        normalizado = partes.slice(0, -1).join('') + '.' + partes[partes.length - 1];
      }
    }
    const num = parseFloat(normalizado);
    if (isNaN(num)) return null;
    return Math.round(num * 100);
  };

  const precoVendaCentavos = parseReaisParaCentavos(precoVendaReais);
  const custoManualCentavos = informarCustoManual ? parseReaisParaCentavos(custoManualReais) : null;

  // Cálculo de custo em tempo real para feedback visual
  let custoPreviewFormatado = 'Desconhecido';
  let badgeProveniencia = 'DESCONHECIDO';
  let explicacaoCusto = 'Sem custo nem percentual associado. O custo será mantido como Desconhecido.';

  if (informarCustoManual && custoManualCentavos !== null && custoManualCentavos >= 0) {
    custoPreviewFormatado = (custoManualCentavos / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    badgeProveniencia = 'INFORMADO_MANUAL';
    explicacaoCusto = 'Custo fixado manualmente por você.';
  } else if (!informarCustoManual && precoVendaCentavos && precoVendaCentavos > 0 && marcaSelecionada?.percentual_padrao !== null && marcaSelecionada?.percentual_padrao !== undefined) {
    const custoCalc = Math.round(precoVendaCentavos * (1 - marcaSelecionada.percentual_padrao / 100));
    custoPreviewFormatado = (custoCalc / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    badgeProveniencia = 'ESTIMADO_PERCENTUAL';
    explicacaoCusto = `Calculado com base no desconto de ${marcaSelecionada.percentual_padrao}% da marca ${marcaSelecionada.nome}.`;
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    // O cadastro pode abrir por cima da venda/encomenda: o envio não deve chegar ao formulário de trás.
    e.stopPropagation();
    if (!nome.trim()) {
      setErro('O nome do produto é obrigatório.');
      return;
    }

    if (!precoVendaCentavos || precoVendaCentavos <= 0) {
      setErro('Informe um preço de venda válido maior que zero (R$ 0,00).');
      return;
    }

    if (informarCustoManual && (custoManualCentavos === null || custoManualCentavos < 0)) {
      setErro('O custo manual informado não pode ser negativo.');
      return;
    }

    setSalvando(true);
    setErro(null);

    const payload: any = {
      marca_id: marcaId.trim() ? marcaId.trim() : null,
      nome: nome.trim(),
      variante: variante.trim() ? variante.trim() : null,
      codigo_barras: codigoBarras.trim() ? codigoBarras.trim() : null,
      codigo_revista: codigoRevista.trim() ? codigoRevista.trim() : null,
      imagem_url: imagemUrl,
      preco_venda_centavos: precoVendaCentavos
    };

    if (informarCustoManual && custoManualCentavos !== null) {
      payload.custo_manual_centavos = custoManualCentavos;
    } else if (produtoParaEditar) {
      payload.recalcular_custo_por_marca = true;
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const url = produtoParaEditar ? `/api/produtos/${produtoParaEditar.id}` : '/api/produtos';
      const method = produtoParaEditar ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || 'Erro ao salvar produto.');
      }

      const produtoSalvo: ProdutoDTO = await res.json();
      onProdutoSalvo(produtoSalvo);
      onClose();
    } catch (err: any) {
      setErro(err.message || 'Erro ao processar requisição.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-raised border border-border-hairline rounded-lg w-full max-w-lg shadow-xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-border-hairline flex items-center justify-between bg-surface-sunken">
          <div>
            <h2 className="text-title-lg font-bold text-ink-primary">
              {produtoParaEditar ? 'Editar Produto / Variante' : 'Novo Produto ou Variante'}
            </h2>
            <p className="text-meta text-ink-secondary">
              Mantenha seu catálogo e preços de venda sempre organizados.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-border-hairline text-ink-secondary font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Feedback de Erro */}
        {erro && (
          <div className="p-3 mx-4 mt-3 bg-status-alert-bg border border-status-alert text-status-alert rounded-md text-body-md">
            ⚠️ {erro}
          </div>
        )}

        {/* Formulário com Rolagem */}
        <form onSubmit={handleSalvar} className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {!produtoParaEditar && dadosIniciais && (
            <p className="p-2 rounded-md bg-brand-subtle text-meta text-ink-primary">
              Dados trazidos da pesquisa. Confira o nome, a marca e o preço de venda antes de salvar
              {dadosIniciais.precoCentavos ? ' (o preço sugerido é o preço médio encontrado)' : ''}.
            </p>
          )}
          {imagemUrl && (
            <div className="flex items-center gap-3">
              <img src={imagemUrl} alt="Foto do produto" referrerPolicy="no-referrer" className="w-20 h-20 rounded-md object-contain bg-white border border-border-hairline" />
              <button type="button" onClick={() => setImagemUrl(null)} className="text-meta font-semibold text-ink-secondary underline min-h-[36px]">
                Remover foto
              </button>
            </div>
          )}
          {/* Marca com atalho para gerenciar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-meta text-ink-secondary font-semibold">Marca do Produto</label>
              {onAbrirGerenciadorMarcas && (
                <button
                  type="button"
                  onClick={onAbrirGerenciadorMarcas}
                  className="text-meta text-brand-primary font-bold hover:underline"
                >
                  ⚙️ Gerenciar Marcas
                </button>
              )}
            </div>
            <select
              value={marcaId}
              onChange={(e) => setMarcaId(e.target.value)}
              className="w-full min-h-touch-target px-3 border border-border-strong rounded-md bg-surface-raised text-ink-primary text-body-md focus:outline-brand-primary"
            >
              <option value="">Sem Marca / Marca Não Cadastrada</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome} {m.percentual_padrao !== null ? `(${m.percentual_padrao}% desconto)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Nome do Produto */}
          <div>
            <label className="block text-meta text-ink-secondary font-semibold mb-1">
              Nome do Produto <span className="text-brand-primary">*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Hidratante Corporal Tododia"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full min-h-touch-target px-3 border border-border-strong rounded-md bg-surface-raised text-ink-primary text-body-md focus:outline-brand-primary"
              required
            />
          </div>

          {/* Variante e Código de Barras lado a lado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-meta text-ink-secondary font-semibold mb-1">
                Variante / Tamanho / Fragrância
              </label>
              <input
                type="text"
                placeholder="Ex: Algodão 400ml, Refil, Macadâmia"
                value={variante}
                onChange={(e) => setVariante(e.target.value)}
                className="w-full min-h-touch-target px-3 border border-border-strong rounded-md bg-surface-raised text-ink-primary text-body-md focus:outline-brand-primary"
              />
              <span className="text-[12px] text-ink-muted">Variantes não são agrupadas no estoque</span>
            </div>

            <div>
              <label className="block text-meta text-ink-secondary font-semibold mb-1">
                Código de Barras (EAN / Opcional)
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ex: 7891234567890"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                className="w-full min-h-touch-target px-3 border border-border-strong rounded-md bg-surface-raised text-ink-primary text-body-md focus:outline-brand-primary"
              />
              <span className="text-[12px] text-ink-muted">O da embalagem, lido pela câmera</span>
            </div>

            <div>
              <label htmlFor="codigo-revista" className="block text-meta text-ink-secondary font-semibold mb-1">
                Código da Revista (Opcional)
              </label>
              <input
                id="codigo-revista"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 71612"
                value={codigoRevista}
                onChange={(e) => setCodigoRevista(e.target.value)}
                className="w-full min-h-touch-target px-3 border border-border-strong rounded-md bg-surface-raised text-ink-primary text-body-md focus:outline-brand-primary"
              />
              <span className="text-[12px] text-ink-muted">O número do catálogo do ciclo, usado no pedido à marca</span>
            </div>
          </div>

          {/* Preço de Venda */}
          <div>
            <label className="block text-meta text-ink-secondary font-semibold mb-1">
              Preço de Venda (R$) <span className="text-brand-primary">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-body-md font-bold text-ink-muted">R$</span>
              <input
                type="text"
                placeholder="0,00"
                value={precoVendaReais}
                onChange={(e) => setPrecoVendaReais(e.target.value)}
                className="w-full min-h-touch-target pl-10 pr-3 border border-border-strong rounded-md bg-surface-raised text-ink-primary text-title-md font-bold focus:outline-brand-primary"
                required
              />
            </div>
          </div>

          {/* Seção Inteligente de Custo & Proveniência */}
          <div className="p-4 bg-surface-base border border-border-hairline rounded-lg flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-label-strong text-ink-primary font-bold">Custo Unitário Estimado</span>
              <span
                className={`text-meta font-bold px-2.5 py-1 rounded-full ${
                  badgeProveniencia === 'ESTIMADO_PERCENTUAL'
                    ? 'bg-status-waiting-bg text-status-waiting'
                    : badgeProveniencia === 'INFORMADO_MANUAL'
                    ? 'bg-status-available-bg text-status-available'
                    : 'bg-surface-sunken text-ink-secondary'
                }`}
              >
                {badgeProveniencia === 'ESTIMADO_PERCENTUAL' && '📊 Estimado via Marca'}
                {badgeProveniencia === 'INFORMADO_MANUAL' && '✍️ Informado Manual'}
                {badgeProveniencia === 'DESCONHECIDO' && '❓ Custo Desconhecido'}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="text-body-md text-ink-secondary">Valor do custo:</span>
              <span className="text-title-lg font-bold text-ink-primary">{custoPreviewFormatado}</span>
            </div>
            <p className="text-meta text-ink-secondary leading-snug">{explicacaoCusto}</p>

            {/* Opção para forçar custo manual */}
            <div className="pt-2 border-t border-border-hairline flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={informarCustoManual}
                  onChange={(e) => setInformarCustoManual(e.target.checked)}
                  className="w-5 h-5 accent-brand-primary rounded"
                />
                <span className="text-body-md text-ink-primary font-medium">
                  Quero informar um custo manual específico para este item
                </span>
              </label>

              {informarCustoManual && (
                <div className="mt-1">
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-body-md font-bold text-ink-muted">R$</span>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={custoManualReais}
                      onChange={(e) => setCustoManualReais(e.target.value)}
                      className="w-full min-h-touch-target pl-10 pr-3 border border-border-strong rounded-md bg-surface-raised text-ink-primary text-title-md font-bold focus:outline-brand-primary"
                    />
                  </div>
                  <span className="text-[12px] text-ink-muted">
                    Substitui o percentual padrão da marca e registra proveniência INFORMADO_MANUAL.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={salvando}
              className="min-h-touch-target bg-brand-primary hover:bg-brand-hover disabled:opacity-50 text-ink-inverse font-bold text-label-strong rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              {salvando ? 'Salvando...' : produtoParaEditar ? 'Atualizar Produto' : 'Cadastrar Produto no Catálogo'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-touch-target bg-surface-raised border border-border-strong text-ink-primary font-semibold text-label-strong rounded-md hover:bg-surface-base"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
