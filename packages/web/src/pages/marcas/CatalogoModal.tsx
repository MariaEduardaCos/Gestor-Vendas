import { useState } from 'react';
import { interpretarTextoCatalogo, type ErroLinhaCatalogo, type LinhaCatalogo } from '@consultorasync/core';
import { apiFetch, formatarReais } from '../../lib/api';
import { useSessao } from '../../app/SessaoContext';

interface Previa {
  ciclo: string;
  novos: number;
  precos_alterados: number;
  sem_mudanca: number;
  aplicado: boolean;
  acoes: Array<{
    tipo: 'CRIAR' | 'ATUALIZAR_PRECO' | 'SEM_MUDANCA';
    nome: string;
    variante: string | null;
    preco_venda_centavos: number;
    preco_anterior_centavos: number | null;
  }>;
}

interface Props {
  marca: { id: string; nome: string; catalogo_ciclo: string | null; catalogo_compartilhado_quantidade?: number };
  onClose: () => void;
  onAplicado: (resumo: Previa) => void;
}

const EXEMPLO = `7891033000011;Hidratante Tododia;Algodão 400ml;59,90
Perfume Essencial;100ml;199,90
Batom Una;39,90`;

/**
 * Carrega o catálogo do ciclo de uma marca: colar a lista (ou abrir um .csv/.txt),
 * ver a prévia do que muda e só então confirmar.
 */
export function CatalogoModal({ marca, onClose, onAplicado }: Props) {
  const { token } = useSessao();
  const [ciclo, setCiclo] = useState('');
  const [texto, setTexto] = useState('');
  const [linhas, setLinhas] = useState<LinhaCatalogo[]>([]);
  const [errosLeitura, setErrosLeitura] = useState<ErroLinhaCatalogo[]>([]);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [compartilhar, setCompartilhar] = useState(true);

  const lerArquivo = (arquivo: File | undefined) => {
    if (!arquivo) return;
    arquivo.text().then((t) => {
      setTexto(t);
      setPrevia(null);
    });
  };

  const enviar = async (simular: boolean, itens: LinhaCatalogo[]) => {
    setEnviando(true);
    setErro(null);
    try {
      const r = await apiFetch<Previa>(`/marcas/${marca.id}/catalogo`, token, {
        method: 'POST',
        body: JSON.stringify({ ciclo, itens, simular, compartilhar })
      });
      if (simular) setPrevia(r);
      else onAplicado(r);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const usarCompartilhado = async () => {
    setErro(null);
    try {
      const ref = await apiFetch<{ ciclo: string | null; itens: LinhaCatalogo[] }>(`/marcas/${marca.id}/catalogo-compartilhado`, token);
      if (!ref.itens.length) return setErro('Ainda não há catálogo compartilhado desta marca.');
      const cicloRef = ciclo.trim() || ref.ciclo || 'Catálogo compartilhado';
      setCiclo(cicloRef);
      setLinhas(ref.itens);
      setErrosLeitura([]);
      setEnviando(true);
      const r = await apiFetch<Previa>(`/marcas/${marca.id}/catalogo`, token, {
        method: 'POST',
        body: JSON.stringify({ ciclo: cicloRef, itens: ref.itens, simular: true })
      });
      setPrevia(r);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const verPrevia = () => {
    const { linhas: lidas, erros } = interpretarTextoCatalogo(texto);
    setLinhas(lidas);
    setErrosLeitura(erros);
    if (!ciclo.trim()) return setErro('Informe o ciclo ou campanha do catálogo.');
    if (lidas.length === 0) return setErro('Nenhum produto válido encontrado na lista.');
    enviar(true, lidas);
  };

  const alterados = previa?.acoes.filter((a) => a.tipo !== 'SEM_MUDANCA') ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-primary/50 sm:p-4" onClick={() => !enviando && onClose()}>
      <div
        role="dialog"
        aria-labelledby="catalogo-titulo"
        className="w-full sm:max-w-2xl bg-surface-raised rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border-hairline flex items-start gap-3">
          <div className="flex-1">
            <h2 id="catalogo-titulo" className="text-title-md font-bold">Catálogo {marca.nome}</h2>
            <p className="text-meta text-ink-secondary">
              {marca.catalogo_ciclo ? `Catálogo atual: ${marca.catalogo_ciclo}.` : 'Nenhum catálogo carregado ainda.'} Os produtos ficam salvos para as próximas encomendas e pedidos.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="min-w-touch-target min-h-touch-target text-ink-secondary">
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-4">
          {!previa ? (
            <>
              {(marca.catalogo_compartilhado_quantidade ?? 0) > 0 && (
                <div className="p-3 rounded-lg border border-status-available bg-status-available-bg flex flex-wrap items-center gap-3">
                  <p className="flex-1 min-w-[200px] text-body-md">
                    <strong>{marca.catalogo_compartilhado_quantidade} produtos</strong> desta marca estão no catálogo compartilhado pelas revendedoras. Use a lista e confira os preços na prévia.
                  </p>
                  <button
                    type="button"
                    onClick={usarCompartilhado}
                    disabled={enviando}
                    className="min-h-[44px] px-4 rounded-md bg-status-available text-ink-inverse font-semibold disabled:opacity-60"
                  >
                    Usar catálogo compartilhado
                  </button>
                </div>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-label-strong">Ciclo ou campanha</span>
                <input
                  value={ciclo}
                  onChange={(e) => setCiclo(e.target.value)}
                  placeholder="Ex.: Ciclo 17/2026"
                  className="min-h-touch-target px-3 rounded-md border border-border-strong bg-surface-base"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-label-strong">Lista de produtos</span>
                <span className="text-meta text-ink-secondary">
                  Uma linha por produto, colunas separadas por ponto e vírgula ou copiadas de uma planilha:
                  <strong> código; nome; variante; preço</strong>. Código e variante podem ficar de fora.
                </span>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={9}
                  placeholder={EXEMPLO}
                  className="px-3 py-2 rounded-md border border-border-strong bg-surface-base font-mono text-meta"
                />
              </label>
              <label className="text-meta text-ink-secondary">
                Ou abra um arquivo .csv ou .txt:{' '}
                <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => lerArquivo(e.target.files?.[0])} className="text-meta" />
              </label>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <Contagem rotulo="Novos" valor={previa.novos} cor="text-status-available" />
                <Contagem rotulo="Preço mudou" valor={previa.precos_alterados} cor="text-status-reserved" />
                <Contagem rotulo="Sem mudança" valor={previa.sem_mudanca} cor="text-ink-secondary" />
              </div>
              {alterados.length > 0 && (
                <ul className="divide-y divide-border-hairline border border-border-hairline rounded-md max-h-64 overflow-y-auto">
                  {alterados.map((a, i) => (
                    <li key={i} className="px-3 py-2 flex items-center justify-between gap-3 text-body-md">
                      <span className="min-w-0 truncate">
                        {a.nome}
                        {a.variante ? <span className="text-ink-secondary"> — {a.variante}</span> : null}
                      </span>
                      {a.tipo === 'CRIAR' ? (
                        <span className="whitespace-nowrap text-status-available font-semibold">Novo · {formatarReais(a.preco_venda_centavos)}</span>
                      ) : (
                        <span className="whitespace-nowrap tabular-nums">
                          <s className="text-ink-muted">{formatarReais(a.preco_anterior_centavos)}</s>{' '}
                          <strong className="text-status-reserved">{formatarReais(a.preco_venda_centavos)}</strong>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-meta text-ink-secondary">
                Vendas e encomendas já registradas continuam com o preço da época. O custo estimado acompanha o percentual da marca; custo informado à mão não muda.
              </p>
            </>
          )}

          {!previa && (
            <label className="flex items-start gap-2 text-meta text-ink-secondary">
              <input type="checkbox" checked={compartilhar} onChange={(e) => setCompartilhar(e.target.checked)} className="mt-0.5 w-4 h-4 accent-brand-primary" />
              <span>
                Compartilhar esta lista com outras revendedoras da marca (só nome, variante, código de barras e preço da revista — nunca clientes, estoque ou custos).
              </span>
            </label>
          )}

          {errosLeitura.length > 0 && (
            <div className="p-3 rounded-md bg-status-reserved-bg text-status-reserved text-meta">
              <p className="font-semibold mb-1">{errosLeitura.length} linha(s) ignorada(s):</p>
              <ul className="list-disc pl-5">
                {errosLeitura.slice(0, 5).map((e) => (
                  <li key={e.linha}>
                    Linha {e.linha}: {e.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {erro && <p className="p-3 rounded-md bg-status-alert-bg text-status-alert">{erro}</p>}
        </div>

        <div className="p-4 border-t border-border-hairline flex justify-end gap-2">
          {previa ? (
            <>
              <button type="button" onClick={() => setPrevia(null)} disabled={enviando} className="min-h-touch-target px-4 rounded-md border border-border-strong font-semibold">
                Voltar e editar
              </button>
              <button
                type="button"
                onClick={() => enviar(false, linhas)}
                disabled={enviando}
                className="min-h-touch-target px-4 rounded-md bg-brand-primary hover:bg-brand-hover text-ink-inverse font-semibold disabled:opacity-60"
              >
                {enviando ? 'Salvando…' : 'Confirmar e salvar catálogo'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={verPrevia}
              disabled={enviando || !texto.trim()}
              className="min-h-touch-target px-4 rounded-md bg-brand-primary hover:bg-brand-hover text-ink-inverse font-semibold disabled:opacity-60"
            >
              {enviando ? 'Conferindo…' : 'Ver o que vai mudar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Contagem({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="p-3 rounded-md bg-surface-sunken">
      <p className={`text-title-lg font-bold ${cor}`}>{valor}</p>
      <p className="text-meta text-ink-secondary">{rotulo}</p>
    </div>
  );
}
