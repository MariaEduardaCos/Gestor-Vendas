import { useState } from 'react';
import { linkWhatsApp, mensagemFilaCobranca, type ItemFilaCobranca } from '@consultorasync/core';
import { apiFetch, formatarReais, useApiGet } from '../../lib/api';
import { useSessao } from '../SessaoContext';
import { useAcoes } from '../AcoesContext';

interface ItemFila extends ItemFilaCobranca {
  cliente: { id: string; nome: string; telefone: string | null };
  ultimo_contato: { canal: string; em: string } | null;
  cobrada_hoje: boolean;
}

interface RespostaFila {
  hoje: string;
  dias_lembrete: number;
  pendentes: ItemFila[];
  cobradas_hoje: ItemFila[];
}

const br = (d: string) => d.split('-').reverse().slice(0, 2).join('/');

function valorDoMotivo(i: ItemFila) {
  if (i.motivo === 'ATRASADA') return i.valor_vencido_centavos + i.valor_vence_hoje_centavos;
  if (i.motivo === 'VENCE_HOJE') return i.valor_vence_hoje_centavos;
  return i.valor_em_breve_centavos;
}

function Etiqueta({ item }: { item: ItemFila }) {
  const estilo = {
    ATRASADA: 'bg-status-danger-bg text-status-danger',
    VENCE_HOJE: 'bg-status-reserved-bg text-status-reserved',
    VENCE_EM_BREVE: 'bg-surface-sunken text-ink-secondary'
  }[item.motivo];
  const texto =
    item.motivo === 'ATRASADA'
      ? `Atrasada · ${item.dias_atraso} dia${item.dias_atraso === 1 ? '' : 's'}`
      : item.motivo === 'VENCE_HOJE'
        ? 'Vence hoje'
        : `Vence ${br(item.proximo_vencimento!)}`;
  return <span className={`inline-block px-2 py-0.5 rounded text-meta font-semibold ${estilo}`}>{texto}</span>;
}

function diasDesdeContato(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoje';
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}

/**
 * Fila de cobrança do dia: uma cliente por linha, mensagem pronta somando todas as contas dela.
 * Ao cobrar, a cliente sai da fila (fica registrado); "Desfazer" devolve.
 */
export function FilaCobranca({ onVerContas }: { onVerContas: () => void }) {
  const { token, notificarAlteracao } = useSessao();
  const { avisar, abrirFicha } = useAcoes();
  const { dados, carregando } = useApiGet<RespostaFila>('/cobranca/fila');
  const [enviando, setEnviando] = useState<string | null>(null);
  const [mostrarCobradas, setMostrarCobradas] = useState(false);

  const pendentes = dados?.pendentes ?? [];
  const cobradas = dados?.cobradas_hoje ?? [];
  const total = pendentes.length + cobradas.length;

  const registrar = async (item: ItemFila, canal: 'WHATSAPP' | 'OUTRO') => {
    setEnviando(item.cliente_id);
    try {
      await apiFetch('/cobranca/contatos', token, {
        method: 'POST',
        body: JSON.stringify({ cliente_id: item.cliente_id, canal, motivo: item.motivo, valor_centavos: valorDoMotivo(item) })
      });
      notificarAlteracao();
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setEnviando(null);
    }
  };

  const cobrarNoWhatsApp = (item: ItemFila, link: string) => {
    // Abre a janela no próprio clique (navegadores bloqueiam se vier depois de uma espera).
    window.open(link, '_blank', 'noopener');
    registrar(item, 'WHATSAPP');
  };

  const desfazer = async (item: ItemFila) => {
    try {
      await apiFetch(`/cobranca/contatos/hoje/${item.cliente_id}`, token, { method: 'DELETE' });
      notificarAlteracao();
    } catch (e) {
      avisar((e as Error).message);
    }
  };

  return (
    <section className="bg-surface-raised border border-border-hairline rounded-lg">
      <div className="px-4 pt-4 pb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-title-md font-bold flex-1">Cobranças de hoje</h3>
        {total > 0 && (
          <span className="text-meta text-ink-secondary tabular-nums">
            {cobradas.length} de {total} avisada{total === 1 ? '' : 's'}
          </span>
        )}
        <button type="button" onClick={onVerContas} className="text-meta font-semibold text-brand-primary min-h-[36px]">
          Ver contas
        </button>
      </div>
      {total > 0 && (
        <div className="mx-4 mb-2 h-1.5 rounded-full bg-surface-sunken overflow-hidden" aria-hidden>
          <div className="h-full bg-status-available transition-all" style={{ width: `${(cobradas.length / total) * 100}%` }} />
        </div>
      )}

      {carregando && !dados ? (
        <p className="px-4 pb-5 pt-2 text-body-md text-ink-secondary">Carregando…</p>
      ) : pendentes.length === 0 ? (
        <p className="px-4 pb-5 pt-2 text-body-md text-ink-secondary">
          {total > 0
            ? 'Todas as cobranças de hoje foram feitas.'
            : `Ninguém para cobrar hoje: nenhuma conta atrasada nem vencendo nos próximos ${dados?.dias_lembrete ?? 3} dias.`}
        </p>
      ) : (
        <ul className="divide-y divide-border-hairline">
          {pendentes.map((item) => {
            const link = linkWhatsApp(item.cliente.telefone, mensagemFilaCobranca(item.cliente.nome, item, formatarReais));
            const ocupado = enviando === item.cliente_id;
            return (
              <li key={item.cliente_id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <button type="button" onClick={() => abrirFicha(item.cliente_id)} className="flex-1 min-w-0 text-left">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{item.cliente.nome}</span>
                    <Etiqueta item={item} />
                  </span>
                  <span className="block text-meta text-ink-secondary">
                    {formatarReais(valorDoMotivo(item))} a cobrar · saldo {formatarReais(item.saldo_centavos)}
                    {item.conta_ids.length > 1 ? ` · ${item.conta_ids.length} compras` : ''}
                    {item.ultimo_contato ? ` · último aviso ${diasDesdeContato(item.ultimo_contato.em)}` : ''}
                    {!link ? ' · sem telefone' : ''}
                  </span>
                </button>
                <div className="flex gap-2 shrink-0">
                  {link && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => cobrarNoWhatsApp(item, link)}
                      className="min-h-[40px] px-3 rounded-md bg-status-available text-ink-inverse font-semibold text-meta disabled:opacity-60"
                    >
                      Cobrar no WhatsApp
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => registrar(item, 'OUTRO')}
                    className="min-h-[40px] px-3 rounded-md border border-border-strong font-semibold text-meta hover:bg-surface-sunken disabled:opacity-60"
                  >
                    Já avisei
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cobradas.length > 0 && (
        <div className="border-t border-border-hairline">
          <button
            type="button"
            onClick={() => setMostrarCobradas((v) => !v)}
            className="w-full text-left px-4 min-h-[44px] text-meta font-semibold text-ink-secondary"
            aria-expanded={mostrarCobradas}
          >
            {mostrarCobradas ? '▾' : '▸'} Avisadas hoje ({cobradas.length})
          </button>
          {mostrarCobradas && (
            <ul className="divide-y divide-border-hairline pb-2">
              {cobradas.map((item) => (
                <li key={item.cliente_id} className="px-4 py-2 flex items-center gap-3">
                  <span className="flex-1 min-w-0 truncate">
                    {item.cliente.nome}
                    <span className="text-meta text-ink-muted"> · {item.ultimo_contato?.canal === 'WHATSAPP' ? 'WhatsApp' : 'outro meio'}</span>
                  </span>
                  <button type="button" onClick={() => desfazer(item)} className="text-meta font-semibold text-brand-primary min-h-[36px] px-2">
                    Desfazer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
