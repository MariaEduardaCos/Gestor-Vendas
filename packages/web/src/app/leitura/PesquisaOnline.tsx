import { useEffect, useState } from 'react';
import { classificarCodigo } from '@consultorasync/core';
import { apiFetch, formatarReais } from '../../lib/api';

export interface DadosOnline {
  codigo_barras: string;
  nome: string;
  marca_nome: string | null;
  preco_medio_centavos: number | null;
  imagem_url: string | null;
  fonte: string;
}

type Resposta = { encontrado: boolean } & Partial<DadosOnline>;

interface Props {
  /** Código que não foi encontrado no cadastro nem no catálogo. */
  codigo: string;
  token: string | null;
  /** Abre o cadastro já preenchido com o que a pesquisa trouxe (a revendedora confere antes de salvar). */
  onUsar: (dados: DadosOnline) => void;
}

/**
 * Forma alternativa de cadastro: pesquisa na internet o código de barras que não está no
 * nosso banco e traz nome, marca, preço médio e foto. Só aparece para código de barras.
 */
export function PesquisaOnline({ codigo, token, onUsar }: Props) {
  const [estado, setEstado] = useState<'parado' | 'buscando' | 'pronto'>('parado');
  const [resultado, setResultado] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setEstado('parado');
    setResultado(null);
    setErro(null);
  }, [codigo]);

  if (classificarCodigo(codigo).tipo !== 'BARRAS') return null;

  const pesquisar = async () => {
    setEstado('buscando');
    setErro(null);
    try {
      setResultado(await apiFetch<Resposta>(`/produtos/consulta-online/${encodeURIComponent(codigo)}`, token));
      setEstado('pronto');
    } catch (e) {
      setErro((e as Error).message);
      setEstado('parado');
    }
  };

  if (estado !== 'pronto') {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={pesquisar}
          disabled={estado === 'buscando'}
          className="min-h-[44px] px-3 rounded-md border border-brand-primary text-brand-primary font-semibold hover:bg-brand-subtle disabled:opacity-60"
        >
          {estado === 'buscando' ? 'Pesquisando…' : 'Pesquisar na internet'}
        </button>
        {erro && (
          <p role="alert" className="text-meta text-status-danger">
            {erro}
          </p>
        )}
      </div>
    );
  }

  if (!resultado?.encontrado || !resultado.nome) {
    return (
      <p role="status" className="p-2 rounded-md bg-surface-sunken text-meta text-ink-secondary">
        A pesquisa na internet não encontrou este código. Cadastre o produto à mão.
      </p>
    );
  }

  const dados = resultado as DadosOnline;
  return (
    <div className="p-3 rounded-md border border-brand-primary bg-surface-raised flex gap-3 items-start text-left">
      {dados.imagem_url && (
        <img src={dados.imagem_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-16 h-16 rounded object-contain bg-white border border-border-hairline shrink-0" />
      )}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-meta text-brand-primary font-semibold">Encontrado na internet · {dados.fonte}</p>
        <p className="font-semibold text-ink-primary">{dados.nome}</p>
        <p className="text-meta text-ink-secondary">
          {[dados.marca_nome, dados.preco_medio_centavos ? `preço médio ${formatarReais(dados.preco_medio_centavos)}` : 'sem preço médio'].filter(Boolean).join(' · ')}
        </p>
        <button type="button" onClick={() => onUsar(dados)} className="self-start min-h-[40px] px-3 rounded-md bg-brand-primary text-ink-inverse font-semibold text-meta">
          Cadastrar com estes dados
        </button>
        <p className="text-meta text-ink-muted">Confira o nome e o preço antes de salvar: a informação vem de uma base pública.</p>
      </div>
    </div>
  );
}
