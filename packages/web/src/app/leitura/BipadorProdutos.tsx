import { useState } from 'react';
import { createPortal } from 'react-dom';
import { classificarCodigo, normalizarTexto, produtoTemCodigo } from '@consultorasync/core';
import { VisorLeituraHibrido } from '../../components/VisorLeituraHibrido';
import { ProdutoModal } from '../../components/ProdutoModal';
import { useSessao } from '../SessaoContext';
import { apiFetch, formatarReais } from '../../lib/api';
import type { ProdutoDTO } from '../../types/produto';

interface Sugestao {
  marca_nome: string;
  nome: string;
  variante: string | null;
  codigo_barras: string | null;
  codigo_revista: string | null;
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

const MAX_ESCOLHAS = 8;

const rotuloProduto = (p: ProdutoDTO) => `${p.nome}${p.variante ? ` — ${p.variante}` : ''}`;

/**
 * Bipar produtos dentro de um formulário: câmera, leitor USB ou digitação.
 * Aceita o código de barras (com espaços, traços ou zero à esquerda), o código da revista
 * ou parte do nome. Mais de um resultado vira uma lista para escolher; nada é escolhido sozinho.
 * Código desconhecido oferece o cadastro já com o código preenchido.
 */
export function BipadorProdutos({ produtos, onProduto, onProdutoCadastrado }: Props) {
  const { token } = useSessao();
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tom: 'ok' | 'alerta' } | null>(null);
  const [codigoDesconhecido, setCodigoDesconhecido] = useState<string | null>(null);
  const [cadastrando, setCadastrando] = useState(false);
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);
  const [escolhas, setEscolhas] = useState<ProdutoDTO[]>([]);

  const aceitar = (produto: ProdutoDTO) => {
    setEscolhas([]);
    setCodigoDesconhecido(null);
    setMensagem({ texto: `Lido: ${rotuloProduto(produto)}`, tom: 'ok' });
    onProduto(produto);
  };

  const lido = (entrada: string) => {
    const c = classificarCodigo(entrada);
    setEscolhas([]);
    setSugestao(null);
    setCodigoDesconhecido(null);

    if (c.tipo === 'TEXTO') {
      const termo = normalizarTexto(c.valor);
      if (termo.length < 2) {
        setMensagem({ texto: 'Digite o código ou pelo menos 2 letras do nome.', tom: 'alerta' });
        return;
      }
      const achados = produtos.filter((p) => normalizarTexto(`${p.nome} ${p.variante ?? ''} ${p.marca_nome ?? ''}`).includes(termo));
      if (achados.length === 1) return aceitar(achados[0]);
      if (achados.length === 0) {
        setMensagem({ texto: `Nenhum produto com "${c.valor}" no nome.`, tom: 'alerta' });
        return;
      }
      setEscolhas(achados.slice(0, MAX_ESCOLHAS));
      setMensagem({
        texto: `${achados.length} produtos com "${c.valor}"${achados.length > MAX_ESCOLHAS ? ` (mostrando ${MAX_ESCOLHAS}; digite mais do nome)` : ''}. Toque no certo:`,
        tom: 'alerta'
      });
      return;
    }

    const achados = produtos.filter((p) => produtoTemCodigo(p, c.valor));
    if (achados.length === 1) return aceitar(achados[0]);
    if (achados.length > 1) {
      setEscolhas(achados.slice(0, MAX_ESCOLHAS));
      setMensagem({ texto: `O código ${c.valor} está em ${achados.length} produtos (marcas diferentes). Toque no certo:`, tom: 'alerta' });
      return;
    }

    const limpo = c.valor;
    setCodigoDesconhecido(limpo);
    setMensagem({ texto: `${c.tipo === 'REVISTA' ? 'Código da revista' : 'Código'} ${limpo} não está cadastrado.`, tom: 'alerta' });
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
          codigo_revista: s.codigo_revista,
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
      <VisorLeituraHibrido
        onCodigoLido={lido}
        autoStart
        pausado={cadastrando}
        placeholderManual="Código de barras, da revista ou nome"
      />
      {escolhas.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="Produtos encontrados">
          {escolhas.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => aceitar(p)}
                className="w-full text-left min-h-[44px] px-3 py-2 rounded-md bg-surface-raised border border-border-hairline hover:border-brand-primary flex items-center gap-2"
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{rotuloProduto(p)}</span>
                  <span className="block text-meta text-ink-muted truncate">
                    {[p.marca_nome, p.codigo_revista && `revista ${p.codigo_revista}`, p.fora_do_ciclo && 'fora do ciclo atual']
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="text-meta font-semibold tabular-nums">{formatarReais(p.preco_venda_centavos)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
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
