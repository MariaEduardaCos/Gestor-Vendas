import { useEffect, useMemo, useState } from 'react';
import { MARCAS_CONHECIDAS, normalizarTexto } from '@consultorasync/core';
import { apiFetch, formatarData, useApiGet } from '../../lib/api';
import { useSessao } from '../../app/SessaoContext';
import { useAcoes } from '../../app/AcoesContext';
import { Botao, CabecalhoPagina, Cartao } from '../../layout/ui';
import { CatalogoModal } from './CatalogoModal';

export interface MarcaDTO {
  id: string;
  nome: string;
  percentual_padrao: number | null;
  catalogo_ciclo: string | null;
  catalogo_atualizado_em: string | null;
  quantidade_produtos: number;
  catalogo_compartilhado_quantidade: number;
}

interface Escolha {
  marcada: boolean;
  percentual: string;
}

export function MarcasPage() {
  const { token, notificarAlteracao } = useSessao();
  const { avisar } = useAcoes();
  const { dados } = useApiGet<MarcaDTO[]>('/marcas');
  const minhas = dados ?? [];
  const [catalogoDe, setCatalogoDe] = useState<MarcaDTO | null>(null);

  // Marcas conhecidas que a revendedora ainda não adicionou + campo para outra marca.
  const disponiveis = useMemo(
    () => MARCAS_CONHECIDAS.filter((c) => !minhas.some((m) => normalizarTexto(m.nome) === normalizarTexto(c.nome))),
    [minhas]
  );
  const [escolhas, setEscolhas] = useState<Record<string, Escolha>>({});
  const [outraNome, setOutraNome] = useState('');
  const [outraPercentual, setOutraPercentual] = useState('30');
  const [percentuais, setPercentuais] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setPercentuais(Object.fromEntries(minhas.map((m) => [m.id, m.percentual_padrao != null ? String(m.percentual_padrao) : ''])));
  }, [dados]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolha = (nome: string, sugerido: number): Escolha => escolhas[nome] ?? { marcada: false, percentual: String(sugerido) };
  const paraNumero = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

  const salvar = async () => {
    const novas = disponiveis
      .filter((c) => escolha(c.nome, c.percentualSugerido).marcada)
      .map((c) => ({ nome: c.nome, percentual_padrao: paraNumero(escolha(c.nome, c.percentualSugerido).percentual) }));
    if (outraNome.trim()) novas.push({ nome: outraNome.trim(), percentual_padrao: paraNumero(outraPercentual) });
    const alteradas = minhas.filter((m) => paraNumero(percentuais[m.id] ?? '') !== m.percentual_padrao);

    const invalida = [...novas.map((n) => n.percentual_padrao), ...alteradas.map((m) => paraNumero(percentuais[m.id] ?? ''))].some(
      (p) => p !== null && (Number.isNaN(p) || p < 0 || p > 100)
    );
    if (invalida) return avisar('O percentual precisa ser um número entre 0 e 100.');
    if (novas.length === 0 && alteradas.length === 0) return avisar('Nada para salvar.');

    setSalvando(true);
    try {
      for (const n of novas) await apiFetch('/marcas', token, { method: 'POST', body: JSON.stringify(n) });
      for (const m of alteradas) {
        await apiFetch(`/marcas/${m.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({ nome: m.nome, percentual_padrao: paraNumero(percentuais[m.id] ?? '') })
        });
      }
      setEscolhas({});
      setOutraNome('');
      notificarAlteracao();
      avisar('Marcas salvas. O percentual será usado automaticamente nos produtos novos.');
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Marcas e catálogos"
        descricao="Escolha as marcas que você vende e guarde a sua comissão de cada uma. Carregue o catálogo do ciclo para anotar encomendas sem digitar produto por produto."
        acoes={<Botao onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar marcas'}</Botao>}
      />

      <h3 className="text-title-md font-bold mb-2">Suas marcas</h3>
      {minhas.length === 0 ? (
        <p className="text-body-md text-ink-secondary mb-6">Você ainda não escolheu nenhuma marca. Marque abaixo as que você vende.</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-8">
          {minhas.map((m) => (
            <Cartao key={m.id} className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-title-md font-bold">{m.nome}</p>
                <CampoPercentual valor={percentuais[m.id] ?? ''} onChange={(v) => setPercentuais((p) => ({ ...p, [m.id]: v }))} rotulo={`Comissão ${m.nome}`} />
              </div>
              <p className="text-meta text-ink-secondary">
                {m.catalogo_ciclo
                  ? `Catálogo: ${m.catalogo_ciclo} · atualizado em ${formatarData(m.catalogo_atualizado_em)}`
                  : 'Nenhum catálogo carregado'}{' '}
                · {m.quantidade_produtos} produto(s)
              </p>
              {m.catalogo_compartilhado_quantidade > 0 && m.quantidade_produtos === 0 && (
                <p className="text-meta text-status-available font-semibold">
                  {m.catalogo_compartilhado_quantidade} produtos disponíveis no catálogo compartilhado
                </p>
              )}
              <button
                type="button"
                onClick={() => setCatalogoDe(m)}
                className="min-h-[44px] rounded-md border border-brand-primary text-brand-primary font-semibold hover:bg-brand-subtle"
              >
                {m.catalogo_ciclo ? 'Atualizar catálogo' : 'Carregar catálogo'}
              </button>
            </Cartao>
          ))}
        </div>
      )}

      <h3 className="text-title-md font-bold mb-1">Adicionar marcas</h3>
      <p className="text-meta text-ink-secondary mb-3">
        O percentual é a sua comissão sobre o preço da revista (ex.: produto de R$ 100 com 30% custa R$ 70 para você). Ele vem com uma sugestão — ajuste conforme a sua tabela; depois de salvo, não precisa digitar de novo.
      </p>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2 mb-3">
        {disponiveis.map((c) => {
          const e = escolha(c.nome, c.percentualSugerido);
          return (
            <div
              key={c.nome}
              className={`flex items-center gap-3 p-3 rounded-lg border ${e.marcada ? 'border-brand-primary bg-brand-subtle' : 'border-border-hairline bg-surface-raised'}`}
            >
              <label className="flex items-center gap-3 flex-1 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={e.marcada}
                  onChange={(ev) => setEscolhas((s) => ({ ...s, [c.nome]: { ...e, marcada: ev.target.checked } }))}
                  className="w-5 h-5 accent-brand-primary"
                />
                <span className="font-semibold">{c.nome}</span>
              </label>
              {e.marcada && (
                <CampoPercentual valor={e.percentual} onChange={(v) => setEscolhas((s) => ({ ...s, [c.nome]: { ...e, percentual: v } }))} rotulo={`Comissão ${c.nome}`} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-dashed border-border-strong">
        <input
          value={outraNome}
          onChange={(e) => setOutraNome(e.target.value)}
          placeholder="Outra marca"
          className="flex-1 min-w-[160px] min-h-[44px] px-3 rounded-md border border-border-strong bg-surface-raised"
        />
        <CampoPercentual valor={outraPercentual} onChange={setOutraPercentual} rotulo="Comissão da outra marca" />
      </div>

      {catalogoDe && (
        <CatalogoModal
          marca={catalogoDe}
          onClose={() => setCatalogoDe(null)}
          onAplicado={(r) => {
            setCatalogoDe(null);
            notificarAlteracao();
            avisar(`Catálogo ${r.ciclo} salvo: ${r.novos} novos, ${r.precos_alterados} preços atualizados.`);
          }}
        />
      )}
    </>
  );
}

function CampoPercentual({ valor, onChange, rotulo }: { valor: string; onChange: (v: string) => void; rotulo: string }) {
  return (
    <span className="flex items-center gap-1">
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        aria-label={rotulo}
        className="w-16 min-h-[40px] px-2 text-right rounded-md border border-border-strong bg-surface-raised tabular-nums"
      />
      <span className="text-ink-secondary">%</span>
    </span>
  );
}
