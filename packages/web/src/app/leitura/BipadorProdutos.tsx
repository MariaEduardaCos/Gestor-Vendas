import { useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizarTexto } from '@consultorasync/core';
import { VisorLeituraHibrido } from '../../components/VisorLeituraHibrido';
import { ProdutoModal } from '../../components/ProdutoModal';
import { useSessao } from '../SessaoContext';
import { apiFetch, formatarReais } from '../../lib/api';
import type { ProdutoDTO } from '../../types/produto';

interface Sugestao {
  marca_nome: string;
  nome: string;
  variante: string | null;
  codigo_barras: string;
  preco_sugerido_centavos: number;
  ciclo: string;
}

interface Props {
  /** Produtos já carregados pela tela (venda ou encomenda). */
  produtos: ProdutoDTO[];
  /** Chamado ao ler um código cadastrado; a tela decide se aceita (ex.: venda checa pronta-entrega). */
  onProduto: (produto: ProdutoDTO) => void;
  /** Produto criado a partir de um código desconhecido. */
  onProdutoCadastrado: (produto: ProdutoDTO) => void;
}

/**
 * Bipar produtos dentro de um formulário: câmera, leitor USB ou digitação do código.
 * Código desconhecido oferece o cadastro já com o código preenchido.
 */
export function BipadorProdutos({ produtos, onProduto, onProdutoCadastrado }: Props) {
  const { token } = useSessao();
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tom: 'ok' | 'alerta' } | null>(null);
  const [codigoDesconhecido, setCodigoDesconhecido] = useState<string | null>(null);
  const [cadastrando, setCadastrando] = useState(false);
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);

  const lido = (codigo: string) => {
    const limpo = codigo.trim();
    const produto = produtos.find((p) => p.codigo_barras === limpo);
    if (produto) {
      setCodigoDesconhecido(null);
      setMensagem({ texto: `Lido: ${produto.nome}${produto.variante ? ` — ${produto.variante}` : ''}`, tom: 'ok' });
      onProduto(produto);
      return;
    }
    setCodigoDesconhecido(limpo);
    setSugestao(null);
    setMensagem({ texto: `Código ${limpo} não está cadastrado.`, tom: 'alerta' });
    // Procura no catálogo compartilhado para evitar digitar o produto
    apiFetch<Sugestao[]>(`/catalogo-compartilhado/codigo/${encodeURIComponent(limpo)}`, token)
      .then((lista) => {
        if (lista[0]) {
          setSugestao(lista[0]);
          setMensagem({ texto: `Encontrado no catálogo compartilhado.`, tom: 'ok' });
        }
      })
      .catch(() => undefined);
  };

  const usarSugestao = async (s: Sugestao) => {
    try {
      const marcas = await apiFetch<Array<{ id: string; nome: string }>>('/marcas', token);
      const marca = marcas.find((m) => normalizarTexto(m.nome) === normalizarTexto(s.marca_nome));
      const produto = await apiFetch<ProdutoDTO>('/produtos', token, {
        method: 'POST',
        body: JSON.stringify({
          marca_id: marca?.id ?? null,
          nome: s.nome,
          variante: s.variante,
          codigo_barras: s.codigo_barras,
          preco_venda_centavos: s.preco_sugerido_centavos
        })
      });
      setSugestao(null);
      setCodigoDesconhecido(null);
      setMensagem({ texto: `Cadastrado: ${produto.nome}${marca ? '' : ' (sem marca: adicione a marca em Marcas e catálogos)'}`, tom: 'ok' });
      onProdutoCadastrado(produto);
    } catch (e) {
      setMensagem({ texto: (e as Error).message, tom: 'alerta' });
    }
  };

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full min-h-[44px] mb-3 rounded-md border border-dashed border-brand-primary text-brand-primary font-semibold hover:bg-brand-subtle"
      >
        Bipar código de barras
      </button>
    );
  }

  return (
    <div className="mb-3 flex flex-col gap-2 p-3 rounded-lg border border-border-hairline bg-surface-sunken">
      <div className="flex items-center justify-between">
        <span className="text-label-strong">Leitura de código</span>
        <button type="button" onClick={() => setAberto(false)} className="text-meta font-semibold text-ink-secondary min-h-[36px] px-2">
          Fechar leitor
        </button>
      </div>
      <VisorLeituraHibrido onCodigoLido={lido} autoStart pausado={cadastrando} placeholderManual="Digite ou bipe o código de barras" />
      {sugestao && (
        <div className="p-2 rounded-md bg-surface-raised border border-status-available text-meta flex flex-wrap items-center gap-2">
          <span className="flex-1 min-w-[180px]">
            <strong>{sugestao.nome}</strong>
            {sugestao.variante ? ` — ${sugestao.variante}` : ''} · {sugestao.marca_nome} · {formatarReais(sugestao.preco_sugerido_centavos)}
            <span className="text-ink-muted"> ({sugestao.ciclo})</span>
          </span>
          <button type="button" onClick={() => usarSugestao(sugestao)} className="min-h-[36px] px-3 rounded-md bg-status-available text-ink-inverse font-semibold">
            Usar este produto
          </button>
        </div>
      )}
      {mensagem && (
        <div
          role="status"
          className={`p-2 rounded-md text-meta flex items-center justify-between gap-2 ${
            mensagem.tom === 'ok' ? 'bg-status-available-bg text-status-available' : 'bg-status-reserved-bg text-status-reserved'
          }`}
        >
          <span>{mensagem.texto}</span>
          {codigoDesconhecido && (
            <button type="button" onClick={() => setCadastrando(true)} className="font-semibold underline min-h-[36px]">
              Cadastrar produto
            </button>
          )}
        </div>
      )}
      {/* Portal: o cadastro abre por cima de tudo, fora da área com rolagem da venda/encomenda */}
      {createPortal(
      <ProdutoModal
        isOpen={cadastrando}
        codigoPrePreenchido={codigoDesconhecido ?? undefined}
        sessionToken={token ?? undefined}
        onClose={() => setCadastrando(false)}
        onProdutoSalvo={(produto) => {
          setCadastrando(false);
          setCodigoDesconhecido(null);
          setMensagem({ texto: `Cadastrado: ${produto.nome}`, tom: 'ok' });
          onProdutoCadastrado(produto);
        }}
      />,
        document.body
      )}
    </div>
  );
}
