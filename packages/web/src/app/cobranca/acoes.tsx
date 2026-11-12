import { useState } from 'react';
import { linkWhatsApp, mensagemCobranca, type ResumoCobranca } from '@consultorasync/core';
import { apiFetch, formatarReais } from '../../lib/api';
import { useSessao } from '../SessaoContext';
import { useAcoes } from '../AcoesContext';
import { CampoVencimento, VENCIMENTO_VAZIO, vencimentoIncompleto, vencimentoParaPayload, type ValorVencimento } from './CampoVencimento';

interface ContaCobravel {
  id: string;
  valor_total: number;
  cliente: { nome: string; telefone: string | null };
  cobranca: ResumoCobranca;
}

/** Abre o WhatsApp da cliente com um lembrete pronto. Sem telefone, avisa. */
export function BotaoCobrar({ conta, compacto }: { conta: ContaCobravel; compacto?: boolean }) {
  const { avisar } = useAcoes();
  const link = linkWhatsApp(conta.cliente.telefone, mensagemCobranca(conta.cliente.nome, conta.cobranca, formatarReais));
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!link) return avisar(`${conta.cliente.nome} não tem telefone cadastrado. Inclua na ficha da cliente.`);
        window.open(link, '_blank', 'noopener');
      }}
      className={`whitespace-nowrap rounded-md font-semibold text-meta border ${
        link ? 'border-status-available text-status-available hover:bg-status-available-bg' : 'border-border-strong text-ink-muted'
      } ${compacto ? 'px-2 min-h-[36px]' : 'px-3 min-h-[40px]'}`}
      aria-label={`Cobrar ${conta.cliente.nome} pelo WhatsApp`}
    >
      Cobrar
    </button>
  );
}

export function BotaoVencimento({ conta }: { conta: ContaCobravel }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAberto(true);
        }}
        className="whitespace-nowrap px-2 min-h-[36px] rounded-md text-meta font-semibold text-brand-primary hover:bg-brand-subtle"
      >
        {conta.cobranca.parcelas.length ? 'Alterar vencimento' : 'Definir vencimento'}
      </button>
      {aberto && <VencimentoModal conta={conta} onClose={() => setAberto(false)} />}
    </>
  );
}

function valorInicial(conta: ContaCobravel): ValorVencimento {
  const p = conta.cobranca.parcelas;
  if (p.length === 0) return VENCIMENTO_VAZIO;
  return { modo: p.length === 1 ? 'UNICO' : 'PARCELADO', data: p[0].vencimento, parcelas: Math.max(2, p.length) };
}

function VencimentoModal({ conta, onClose }: { conta: ContaCobravel; onClose: () => void }) {
  const { token, notificarAlteracao } = useSessao();
  const { avisar } = useAcoes();
  const [valor, setValor] = useState<ValorVencimento>(() => valorInicial(conta));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const problema = vencimentoIncompleto(valor);
    if (problema) return setErro(problema);
    setSalvando(true);
    try {
      await apiFetch(`/contas/${conta.id}/vencimentos`, token, { method: 'PUT', body: JSON.stringify(vencimentoParaPayload(valor)) });
      notificarAlteracao();
      avisar('Vencimento salvo.');
      onClose();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-primary/50 sm:p-4" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div role="dialog" aria-label="Vencimento da conta" className="w-full sm:max-w-md bg-surface-raised rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-title-md font-bold">Vencimento · {conta.cliente.nome}</h2>
          <p className="text-meta text-ink-secondary">Conta de {formatarReais(conta.valor_total)}. As parcelas se ajustam se algum item for cancelado.</p>
        </div>
        <CampoVencimento valor={valor} onChange={setValor} totalCentavos={conta.valor_total} />
        {erro && <p className="p-3 rounded-md bg-status-alert-bg text-status-alert text-meta">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-touch-target px-4 rounded-md border border-border-strong font-semibold">
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={salvando} className="min-h-touch-target px-4 rounded-md bg-brand-primary hover:bg-brand-hover text-ink-inverse font-semibold disabled:opacity-60">
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const br = (d: string) => d.split('-').reverse().join('/');

/** Texto curto da situação de cobrança para tabelas e cartões. */
export function DescricaoVencimento({ cobranca }: { cobranca: ResumoCobranca }) {
  if (cobranca.situacao === 'ATRASADA') {
    return (
      <span className="text-status-alert font-semibold">
        {formatarReais(cobranca.valor_vencido_centavos)} atrasado · {cobranca.dias_atraso}d
      </span>
    );
  }
  if (cobranca.situacao === 'EM_DIA' && cobranca.proximo_vencimento) {
    return <span>Vence {br(cobranca.proximo_vencimento)}</span>;
  }
  if (cobranca.situacao === 'QUITADA') return <span className="text-status-available">Quitada</span>;
  return <span className="text-ink-muted">Sem vencimento</span>;
}
