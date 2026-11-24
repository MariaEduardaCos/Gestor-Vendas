import { useState } from 'react';
import { FotoProduto } from './FotoProduto';

export interface LinhaEspelho {
  produtoId: string;
  produtoNome: string;
  variante?: string | null;
  codigoRevista?: string | null;
  codigoBarras?: string | null;
  imagemUrl?: string | null;
  quantidadeTotal: number;
  quantidadeClientes?: number;
  quantidadeProntaEntrega?: number;
  destinacoes?: Array<{ tipo: string; quantidade: number; clienteNome?: string | null }>;
}

/** Código que a revendedora digita no site da marca: o da revista; sem ele, o de barras. */
export function codigoParaPedido(l: Pick<LinhaEspelho, 'codigoRevista' | 'codigoBarras'>): string {
  return l.codigoRevista || l.codigoBarras || '';
}

const nomeCompleto = (l: LinhaEspelho) => (l.variante ? `${l.produtoNome} (${l.variante})` : l.produtoNome);

export function textoEspelho(linhas: LinhaEspelho[]): string {
  return linhas.map((l) => `${codigoParaPedido(l) || 'sem código'}\t${l.quantidadeTotal}\t${nomeCompleto(l)}`).join('\n');
}

export function csvEspelho(linhas: LinhaEspelho[]): string {
  const campo = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const cabecalho = ['Código', 'Quantidade', 'Produto', 'Código de barras', 'Para clientes', 'Pronta-entrega'];
  const corpo = linhas.map((l) =>
    [codigoParaPedido(l), l.quantidadeTotal, nomeCompleto(l), l.codigoBarras ?? '', l.quantidadeClientes ?? '', l.quantidadeProntaEntrega ?? '']
      .map(campo)
      .join(';')
  );
  return '﻿' + [cabecalho.map(campo).join(';'), ...corpo].join('\r\n');
}

function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Espelho do pedido para digitar (ou enviar) no site da marca: foto, código, nome e quantidade,
 * com cópia para a área de transferência e planilha para baixar.
 */
export function EspelhoPedido({
  linhas,
  nomeArquivo = 'pedido',
  mostrarSeparacao = true,
  exportavel = true
}: {
  linhas: LinhaEspelho[];
  nomeArquivo?: string;
  mostrarSeparacao?: boolean;
  exportavel?: boolean;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  const semCodigo = linhas.filter((l) => !codigoParaPedido(l)).length;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoEspelho(linhas));
      setAviso('Lista copiada: código, quantidade e produto.');
    } catch {
      setAviso('Não foi possível copiar. Use "Baixar planilha".');
    }
  };

  if (linhas.length === 0) {
    return <p className="text-meta text-ink-muted italic">Nenhum item adicionado ainda ao pedido.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {exportavel && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copiar}
            className="min-h-[44px] px-3 rounded-md border border-border-strong bg-surface-raised hover:bg-surface-sunken text-label-strong text-ink-primary"
          >
            Copiar lista
          </button>
          <button
            type="button"
            onClick={() => {
              baixar(`${nomeArquivo}.csv`, csvEspelho(linhas));
              setAviso('Planilha baixada.');
            }}
            className="min-h-[44px] px-3 rounded-md border border-border-strong bg-surface-raised hover:bg-surface-sunken text-label-strong text-ink-primary"
          >
            Baixar planilha
          </button>
          {aviso && <span role="status" className="text-meta text-ink-secondary">{aviso}</span>}
        </div>
      )}
      {semCodigo > 0 && (
        <p className="text-meta text-status-alert">
          {semCodigo} produto(s) sem código. Cadastre o código da revista no produto para digitar no site da marca.
        </p>
      )}
      <div className="divide-y divide-border-hairline bg-surface-raised rounded-md border border-border-hairline overflow-hidden">
        {linhas.map((l) => (
          <div key={l.produtoId} className="p-2.5 flex items-center gap-3">
            <FotoProduto url={l.imagemUrl} />
            <div className="flex-1 min-w-0">
              <p className="text-body-md font-bold text-ink-primary">{nomeCompleto(l)}</p>
              <p className="text-meta text-ink-secondary">
                Código:{' '}
                <span className="font-bold text-ink-primary tabular-nums">{codigoParaPedido(l) || 'sem código'}</span>
                {l.codigoRevista && l.codigoBarras ? <span className="text-ink-muted"> · barras {l.codigoBarras}</span> : null}
              </p>
              {mostrarSeparacao && l.destinacoes && l.destinacoes.length > 0 ? (
                <p className="text-meta text-ink-secondary">
                  {l.destinacoes
                    .map((d) => (d.tipo === 'CLIENTE' ? `${d.clienteNome ?? 'Cliente'}: ${d.quantidade}` : `Pronta-entrega: ${d.quantidade}`))
                    .join(' · ')}
                </p>
              ) : mostrarSeparacao && l.quantidadeClientes !== undefined ? (
                <p className="text-meta text-ink-muted">
                  Clientes: {l.quantidadeClientes} · Pronta-entrega: {l.quantidadeProntaEntrega ?? 0}
                </p>
              ) : null}
            </div>
            <span className="text-title-md font-extrabold text-brand-primary tabular-nums shrink-0">{l.quantidadeTotal} un</span>
          </div>
        ))}
      </div>
    </div>
  );
}
