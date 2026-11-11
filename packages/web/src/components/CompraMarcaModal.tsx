import { useState, useEffect } from 'react';
import type { MarcaDTO, ProdutoDTO } from '../types/produto';

interface CompraMarcaModalProps {
  isOpen: boolean;
  sessionToken?: string;
  apiBaseUrl?: string;
  onClose: () => void;
  onCompraRegistrada: (compra: any) => void;
}

interface ItemPendencia {
  item_conta_id: string;
  encomenda_id: string | null;
  cliente_id: string;
  cliente_nome: string;
  produto_id: string;
  produto_nome: string;
  variante: string | null;
  marca_id: string;
  quantidade: number;
  custo_unitario_centavos: number | null;
  selecionado: boolean;
}

interface ItemProntaEntrega {
  produto: ProdutoDTO;
  quantidade: number;
}

export function CompraMarcaModal({
  isOpen,
  sessionToken,
  apiBaseUrl = '/api',
  onClose,
  onCompraRegistrada
}: CompraMarcaModalProps) {
  const [marcas, setMarcas] = useState<MarcaDTO[]>([]);
  const [marcaSelecionadaId, setMarcaSelecionadaId] = useState<string>('');
  const [numeroPedido, setNumeroPedido] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Pendências de fábrica desta marca
  const [pendencias, setPendencias] = useState<ItemPendencia[]>([]);
  const [carregandoPendencias, setCarregandoPendencias] = useState(false);

  // Itens adicionais para pronta-entrega
  const [produtosMarca, setProdutosMarca] = useState<ProdutoDTO[]>([]);
  const [itensProntaEntrega, setItensProntaEntrega] = useState<ItemProntaEntrega[]>([]);
  const [produtoBusca, setProdutoBusca] = useState('');

  // Estados de envio e resultado
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [compraSucesso, setCompraSucesso] = useState<any | null>(null);

  // Fechar com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !salvando) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, salvando, onClose]);

  // Carregar marcas ao abrir
  useEffect(() => {
    if (isOpen) {
      setCompraSucesso(null);
      setErro(null);
      setNumeroPedido('');
      setObservacoes('');
      setPendencias([]);
      setItensProntaEntrega([]);
      setProdutoBusca('');
      carregarMarcas();
    }
  }, [isOpen]);

  // Ao trocar de marca, recarregar pendências e catálogo de produtos da marca
  useEffect(() => {
    if (marcaSelecionadaId) {
      carregarPendenciasEMarcaProdutos(marcaSelecionadaId);
    } else {
      setPendencias([]);
      setProdutosMarca([]);
      setItensProntaEntrega([]);
    }
  }, [marcaSelecionadaId]);

  const carregarMarcas = async () => {
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;
      const res = await fetch(`${apiBaseUrl}/marcas`, { headers });
      if (res.ok) {
        const data = await res.json();
        setMarcas(data);
        if (data.length > 0 && !marcaSelecionadaId) {
          setMarcaSelecionadaId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Erro ao buscar marcas:', e);
    }
  };

  const carregarPendenciasEMarcaProdutos = async (marcaId: string) => {
    setCarregandoPendencias(true);
    setErro(null);
    try {
      const headers: Record<string, string> = {};
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;

      // 1. Pendências de encomendas
      const resPend = await fetch(`${apiBaseUrl}/compras-marca/pendencias?marca_id=${marcaId}`, { headers });
      if (resPend.ok) {
        const dataPend = await resPend.json();
        setPendencias(
          dataPend.pendencias.map((p: any) => ({
            ...p,
            selecionado: true // por padrão já vem marcado para facilitar a vida da consultora
          }))
        );
      }

      // 2. Produtos da marca para pronta-entrega
      const resProd = await fetch(`${apiBaseUrl}/produtos?marca_id=${marcaId}`, { headers });
      if (resProd.ok) {
        const dataProd = await resProd.json();
        setProdutosMarca(dataProd);
      }
    } catch (e) {
      console.error('Erro ao carregar dados da marca:', e);
      setErro('Erro ao carregar itens da marca selecionada.');
    } finally {
      setCarregandoPendencias(false);
    }
  };

  if (!isOpen) return null;

  // Alternar checkbox de item de encomenda
  const togglePendencia = (idx: number) => {
    setPendencias((atuais) => {
      const novos = [...atuais];
      novos[idx].selecionado = !novos[idx].selecionado;
      return novos;
    });
  };

  // Adicionar produto para pronta-entrega
  const handleAdicionarProntaEntrega = (prod: ProdutoDTO) => {
    setItensProntaEntrega((atuais) => {
      const idx = atuais.findIndex((i) => i.produto.id === prod.id);
      if (idx >= 0) {
        const novos = [...atuais];
        novos[idx].quantidade += 1;
        return novos;
      }
      return [...atuais, { produto: prod, quantidade: 1 }];
    });
  };

  const handleAlterarQtdProntaEntrega = (prodId: string, delta: number) => {
    setItensProntaEntrega((atuais) =>
      atuais
        .map((i) => {
          if (i.produto.id === prodId) {
            const novaQtd = i.quantidade + delta;
            return novaQtd > 0 ? { ...i, quantidade: novaQtd } : null;
          }
          return i;
        })
        .filter(Boolean) as ItemProntaEntrega[]
    );
  };

  // Cálculo ao vivo do espelho do pedido (FR-017)
  const itensClientesSelecionados = pendencias.filter((p) => p.selecionado);

  interface LinhaEspelhoPreview {
    produtoId: string;
    produtoNome: string;
    variante: string | null;
    quantidadeTotal: number;
    quantidadeClientes: number;
    quantidadeProntaEntrega: number;
    clientesVinculados: Array<{ nome: string; quantidade: number }>;
  }

  const mapaEspelho = new Map<string, LinhaEspelhoPreview>();

  // Somar clientes
  for (const item of itensClientesSelecionados) {
    if (!mapaEspelho.has(item.produto_id)) {
      mapaEspelho.set(item.produto_id, {
        produtoId: item.produto_id,
        produtoNome: item.produto_nome,
        variante: item.variante,
        quantidadeTotal: 0,
        quantidadeClientes: 0,
        quantidadeProntaEntrega: 0,
        clientesVinculados: []
      });
    }
    const linha = mapaEspelho.get(item.produto_id)!;
    linha.quantidadeTotal += item.quantidade;
    linha.quantidadeClientes += item.quantidade;
    linha.clientesVinculados.push({
      nome: item.cliente_nome,
      quantidade: item.quantidade
    });
  }

  // Somar pronta-entrega
  for (const item of itensProntaEntrega) {
    if (!mapaEspelho.has(item.produto.id)) {
      mapaEspelho.set(item.produto.id, {
        produtoId: item.produto.id,
        produtoNome: item.produto.nome,
        variante: item.produto.variante,
        quantidadeTotal: 0,
        quantidadeClientes: 0,
        quantidadeProntaEntrega: 0,
        clientesVinculados: []
      });
    }
    const linha = mapaEspelho.get(item.produto.id)!;
    linha.quantidadeTotal += item.quantidade;
    linha.quantidadeProntaEntrega += item.quantidade;
  }

  const linhasEspelho = Array.from(mapaEspelho.values());
  const totalItensPedido = linhasEspelho.reduce((acc, l) => acc + l.quantidadeTotal, 0);

  // Submissão da compra
  const handleConfirmarCompra = async () => {
    if (!marcaSelecionadaId) {
      setErro('Por favor, selecione uma marca.');
      return;
    }

    if (totalItensPedido === 0) {
      setErro('Selecione ao menos um item de encomenda ou adicione itens para pronta-entrega.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const payloadItens: any[] = [];

      // Itens de clientes
      for (const p of itensClientesSelecionados) {
        payloadItens.push({
          produto_id: p.produto_id,
          destinacao: 'CLIENTE',
          quantidade: p.quantidade,
          cliente_id: p.cliente_id,
          encomenda_id: p.encomenda_id,
          item_conta_id: p.item_conta_id
        });
      }

      // Itens de pronta-entrega
      for (const pe of itensProntaEntrega) {
        payloadItens.push({
          produto_id: pe.produto.id,
          destinacao: 'PRONTA_ENTREGA',
          quantidade: pe.quantidade
        });
      }

      const headers: Record<string, string> = {
        'content-type': 'application/json'
      };
      if (sessionToken) headers['authorization'] = `Bearer ${sessionToken}`;

      const res = await fetch(`${apiBaseUrl}/compras-marca`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          marca_id: marcaSelecionadaId,
          numero_pedido: numeroPedido.trim() || null,
          observacoes: observacoes.trim() || null,
          itens: payloadItens
        })
      });

      if (!res.ok) {
        const prob = await res.json().catch(() => null);
        throw new Error(prob?.detail || 'Erro ao registrar compra à marca.');
      }

      const compraCriada = await res.json();
      setCompraSucesso(compraCriada);
      onCompraRegistrada(compraCriada);
    } catch (e: any) {
      setErro(e.message || 'Erro de conexão ao salvar compra.');
    } finally {
      setSalvando(false);
    }
  };

  const marcaAtual = marcas.find((m) => m.id === marcaSelecionadaId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compra-marca-title"
    >
      <div className="bg-surface-raised border border-border-hairline rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 border-b border-border-hairline bg-surface-base flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 id="compra-marca-title" className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
              <span>🛒</span> Fechar Compra com a Marca (Fábrica)
            </h2>
            <p className="text-meta text-ink-secondary">
              Gera o espelho consolidado para digitação no site da marca e separa clientes de pronta-entrega.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="min-h-touch-target min-w-touch-target flex items-center justify-center text-ink-secondary hover:text-ink-primary rounded-lg text-title-lg"
            aria-label="Fechar janela"
          >
            ✕
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Alerta de Registro Local vs Portal da Marca (FR-017) */}
          <div className="p-3 bg-brand-subtle border border-brand-primary/20 rounded-lg text-body-sm text-ink-primary flex items-start gap-2">
            <span className="text-title-md">ℹ️</span>
            <div>
              <p className="font-bold text-brand-primary">Espelho Auxiliar para Digitação</p>
              <p className="text-ink-secondary leading-snug">
                Este registro organiza seu pedido e preserva os nomes das clientes. Ele <strong>não envia dados automaticamente para o site da marca</strong> — utilize o espelho gerado abaixo para digitar o pedido no portal oficial da fabricante.
              </p>
            </div>
          </div>

          {erro && (
            <div className="p-3 bg-status-danger-bg border border-status-danger text-status-danger rounded-lg text-body-md font-medium">
              ⚠️ {erro}
            </div>
          )}

          {/* Tela de Sucesso com Espelho Final */}
          {compraSucesso ? (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="p-4 bg-status-available-bg border border-status-available text-status-available rounded-lg">
                <h3 className="text-title-md font-bold mb-1">✅ Compra Registrada com Sucesso!</h3>
                <p className="text-body-md">
                  Marca: <strong>{compraSucesso.marca_nome}</strong> | Total de Itens: <strong>{compraSucesso.quantidade_total_itens}</strong> ({compraSucesso.quantidade_itens_clientes} para clientes, {compraSucesso.quantidade_itens_pronta_entrega} pronta-entrega).
                </p>
                <p className="text-body-sm font-semibold mt-1">
                  Custo Estimado: {compraSucesso.custo_total_estimado_formatado}
                </p>
              </div>

              <div className="bg-surface-sunken p-4 rounded-lg border border-border-hairline">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-title-md font-bold text-ink-primary">
                    📋 Espelho Consolidado para Digitação
                  </h4>
                  <span className="text-meta bg-brand-primary text-ink-inverse font-bold px-2 py-1 rounded">
                    Site da Marca
                  </span>
                </div>

                <div className="divide-y divide-border-hairline bg-surface-raised rounded-md border border-border-hairline overflow-hidden">
                  {compraSucesso.espelho_produtos?.map((linha: any) => (
                    <div key={linha.produtoId} className="p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-body-lg font-bold text-ink-primary">{linha.produtoNome}</p>
                          {linha.variante && <p className="text-meta text-ink-muted">{linha.variante}</p>}
                        </div>
                        <div className="text-right">
                          <span className="text-title-lg font-extrabold text-brand-primary bg-brand-subtle px-3 py-1 rounded-md">
                            {linha.quantidadeTotal} un
                          </span>
                        </div>
                      </div>

                      <div className="text-meta text-ink-secondary bg-surface-sunken p-2 rounded">
                        <span className="font-semibold text-ink-primary">Separação: </span>
                        {linha.destinacoes?.map((d: any, idx: number) => (
                          <span key={idx} className="mr-2 inline-block">
                            {d.tipo === 'CLIENTE' ? (
                              <span className="text-brand-primary font-medium">👤 {d.clienteNome}: {d.quantidade} un</span>
                            ) : (
                              <span className="text-ink-primary font-medium">📦 Pronta-Entrega: {d.quantidade} un</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-touch-target px-6 bg-brand-primary hover:bg-brand-hover text-ink-inverse font-bold text-label-strong rounded-lg shadow-md transition-colors"
                >
                  Concluir e Voltar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Passo 1: Selecionar Marca */}
              <div className="flex flex-col gap-2">
                <label className="text-label-strong text-ink-primary font-semibold">
                  1. Escolha a Marca do Pedido:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {marcas.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMarcaSelecionadaId(m.id)}
                      className={`min-h-touch-target p-2 rounded-lg border text-label-strong font-bold transition-all text-left flex flex-col justify-center ${
                        marcaSelecionadaId === m.id
                          ? 'border-brand-primary bg-brand-subtle text-brand-primary shadow-sm'
                          : 'border-border-hairline bg-surface-raised text-ink-secondary hover:bg-surface-sunken'
                      }`}
                    >
                      <span>{m.nome}</span>
                      {m.percentual_padrao !== null && (
                        <span className="text-meta text-ink-muted">Desconto: {m.percentual_padrao}%</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Passo 2: Encomendas Pendentes de Fábrica desta Marca (FR-017, FR-018) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-label-strong text-ink-primary font-semibold flex items-center gap-2">
                    <span>2. Encomendas Pendentes de Clientes ({marcaAtual?.nome || 'Marca'})</span>
                  </label>
                  <span className="text-meta text-ink-muted">
                    {itensClientesSelecionados.length} item(ns) marcado(s)
                  </span>
                </div>

                {carregandoPendencias ? (
                  <p className="text-meta text-ink-muted p-3 bg-surface-sunken rounded-lg">
                    Carregando encomendas pendentes...
                  </p>
                ) : pendencias.length === 0 ? (
                  <p className="text-body-sm text-ink-muted p-3 bg-surface-sunken rounded-lg italic">
                    Nenhuma cliente com encomenda pendente de fábrica para esta marca no momento. Você ainda pode registrar itens para sua pronta-entrega abaixo!
                  </p>
                ) : (
                  <div className="border border-border-hairline rounded-lg divide-y divide-border-hairline max-h-48 overflow-y-auto bg-surface-raised">
                    {pendencias.map((item, idx) => (
                      <label
                        key={item.item_conta_id}
                        className={`min-h-touch-target p-3 flex items-center justify-between cursor-pointer hover:bg-surface-sunken transition-colors ${
                          item.selecionado ? 'bg-brand-subtle/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={item.selecionado}
                            onChange={() => togglePendencia(idx)}
                            className="w-5 h-5 accent-brand-primary cursor-pointer"
                          />
                          <div>
                            <p className="text-body-md font-bold text-ink-primary">
                              {item.produto_nome}
                              {item.variante && <span className="text-ink-muted font-normal"> ({item.variante})</span>}
                            </p>
                            <p className="text-meta text-brand-primary font-semibold">
                              👤 Cliente: {item.cliente_nome}
                            </p>
                          </div>
                        </div>
                        <span className="text-label-strong font-bold text-ink-primary bg-surface-sunken px-2.5 py-1 rounded">
                          {item.quantidade} un
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Passo 3: Adicionar Itens de Pronta-Entrega */}
              <div className="flex flex-col gap-2">
                <label className="text-label-strong text-ink-primary font-semibold">
                  3. Adicionar Itens Extras para Pronta-Entrega:
                </label>
                <input
                  type="text"
                  placeholder="Buscar produto desta marca para estante..."
                  value={produtoBusca}
                  onChange={(e) => setProdutoBusca(e.target.value)}
                  className="min-h-touch-target p-3 border border-border-hairline rounded-lg text-body-md bg-surface-raised focus:outline-brand-primary"
                />

                {produtoBusca.trim() && (
                  <div className="border border-border-hairline rounded-lg divide-y divide-border-hairline max-h-36 overflow-y-auto bg-surface-raised shadow-sm">
                    {produtosMarca
                      .filter((p) => p.nome.toLowerCase().includes(produtoBusca.toLowerCase()))
                      .map((prod) => (
                        <div
                          key={prod.id}
                          className="p-2 flex items-center justify-between hover:bg-surface-sunken"
                        >
                          <div>
                            <p className="text-body-md font-medium text-ink-primary">{prod.nome}</p>
                            {prod.variante && <p className="text-meta text-ink-muted">{prod.variante}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAdicionarProntaEntrega(prod)}
                            className="min-h-touch-target px-3 bg-brand-primary text-ink-inverse text-meta font-bold rounded-md hover:bg-brand-hover"
                          >
                            + Pronta-Entrega
                          </button>
                        </div>
                      ))}
                  </div>
                )}

                {/* Lista de itens para pronta-entrega já selecionados */}
                {itensProntaEntrega.length > 0 && (
                  <div className="bg-surface-sunken p-2 rounded-lg border border-border-hairline flex flex-col gap-1">
                    <span className="text-meta font-semibold text-ink-secondary">Itens Pronta-Entrega Selecionados:</span>
                    {itensProntaEntrega.map((pe) => (
                      <div
                        key={pe.produto.id}
                        className="flex items-center justify-between bg-surface-raised p-2 rounded border border-border-hairline text-body-sm"
                      >
                        <div>
                          <span className="font-bold text-ink-primary">{pe.produto.nome}</span>
                          {pe.produto.variante && <span className="text-ink-muted"> ({pe.produto.variante})</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAlterarQtdProntaEntrega(pe.produto.id, -1)}
                            className="w-8 h-8 rounded bg-surface-sunken text-ink-primary font-bold flex items-center justify-center hover:bg-border-hairline"
                          >
                            -
                          </button>
                          <span className="font-extrabold text-body-md px-1">{pe.quantidade}</span>
                          <button
                            type="button"
                            onClick={() => handleAlterarQtdProntaEntrega(pe.produto.id, 1)}
                            className="w-8 h-8 rounded bg-surface-sunken text-ink-primary font-bold flex items-center justify-center hover:bg-border-hairline"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Passo 4: Prévia ao Vivo do Espelho de Compra */}
              <div className="border border-brand-primary/30 bg-brand-subtle/20 p-3 rounded-lg flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-label-strong font-bold text-ink-primary">
                    4. Espelho de Digitação Consolidado (Ao Vivo)
                  </span>
                  <span className="text-meta font-bold bg-brand-primary text-ink-inverse px-2 py-0.5 rounded">
                    Total: {totalItensPedido} un
                  </span>
                </div>

                {linhasEspelho.length === 0 ? (
                  <p className="text-meta text-ink-muted italic">
                    Nenhum item adicionado ainda ao pedido.
                  </p>
                ) : (
                  <div className="divide-y divide-border-hairline bg-surface-raised rounded border border-border-hairline overflow-hidden">
                    {linhasEspelho.map((linha) => (
                      <div key={linha.produtoId} className="p-2.5 flex items-center justify-between">
                        <div>
                          <p className="text-body-md font-bold text-ink-primary">{linha.produtoNome}</p>
                          <p className="text-meta text-ink-muted">
                            Clientes: {linha.quantidadeClientes} un | Pronta-entrega: {linha.quantidadeProntaEntrega} un
                          </p>
                        </div>
                        <span className="text-title-md font-extrabold text-brand-primary">
                          {linha.quantidadeTotal} un
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informações Complementares Opcionais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-meta text-ink-secondary font-medium">
                    Número do Pedido da Fábrica (opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: PED-2026-99"
                    value={numeroPedido}
                    onChange={(e) => setNumeroPedido(e.target.value)}
                    className="w-full min-h-touch-target p-2.5 border border-border-hairline rounded-lg text-body-md bg-surface-raised"
                  />
                </div>
                <div>
                  <label className="text-meta text-ink-secondary font-medium">
                    Observações / Ciclo:
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Ciclo 15 / Especial Mães"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="w-full min-h-touch-target p-2.5 border border-border-hairline rounded-lg text-body-md bg-surface-raised"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rodapé com Ações */}
        {!compraSucesso && (
          <div className="p-4 border-t border-border-hairline bg-surface-base flex items-center justify-between sticky bottom-0 z-10">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="min-h-touch-target px-4 border border-border-hairline text-ink-secondary font-semibold text-label-strong rounded-lg hover:bg-surface-sunken transition-colors"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmarCompra}
              disabled={salvando || totalItensPedido === 0}
              className={`min-h-touch-target px-6 rounded-lg font-bold text-label-strong text-ink-inverse shadow-md transition-all flex items-center gap-2 ${
                salvando || totalItensPedido === 0
                  ? 'bg-ink-muted cursor-not-allowed opacity-60'
                  : 'bg-brand-primary hover:bg-brand-hover'
              }`}
            >
              {salvando ? (
                <>
                  <span className="w-4 h-4 border-2 border-ink-inverse border-t-transparent rounded-full animate-spin" />
                  Salvando Compra...
                </>
              ) : (
                <>
                  <span>🛒</span> Confirmar Pedido à Marca ({totalItensPedido} un)
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
