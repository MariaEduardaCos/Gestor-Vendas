import { dividirEmParcelas, gerarVencimentosMensais, MAX_PARCELAS } from '@consultorasync/core';
import { formatarReais } from '../../lib/api';

export interface ValorVencimento {
  modo: 'SEM' | 'UNICO' | 'PARCELADO';
  data: string;
  parcelas: number;
}

export const VENCIMENTO_VAZIO: ValorVencimento = { modo: 'SEM', data: '', parcelas: 2 };

/** Corpo para a API: nada (sem vencimento) ou primeiro vencimento + número de parcelas mensais. */
export function vencimentoParaPayload(v: ValorVencimento): { primeiro_vencimento?: string; parcelas?: number; vencimentos?: string[] } {
  if (v.modo === 'SEM') return { vencimentos: [] };
  return { primeiro_vencimento: v.data, parcelas: v.modo === 'UNICO' ? 1 : v.parcelas };
}

export function vencimentoIncompleto(v: ValorVencimento): string | null {
  if (v.modo === 'SEM') return null;
  if (!v.data) return 'Informe a data do vencimento.';
  if (v.modo === 'PARCELADO' && (v.parcelas < 2 || v.parcelas > MAX_PARCELAS)) return `Parcelas: de 2 a ${MAX_PARCELAS}.`;
  return null;
}

function previa(v: ValorVencimento, totalCentavos: number): Array<{ data: string; valor: number }> {
  if (v.modo === 'SEM' || !v.data) return [];
  try {
    const n = v.modo === 'UNICO' ? 1 : v.parcelas;
    const datas = gerarVencimentosMensais(v.data, n);
    const valores = dividirEmParcelas(totalCentavos, n);
    return datas.map((data, i) => ({ data, valor: valores[i] }));
  } catch {
    return [];
  }
}

const br = (d: string) => d.split('-').reverse().join('/');

export function CampoVencimento({ valor, onChange, totalCentavos }: { valor: ValorVencimento; onChange: (v: ValorVencimento) => void; totalCentavos: number }) {
  const opcoes: Array<{ modo: ValorVencimento['modo']; rotulo: string }> = [
    { modo: 'SEM', rotulo: 'Sem vencimento' },
    { modo: 'UNICO', rotulo: 'Data única' },
    { modo: 'PARCELADO', rotulo: 'Parcelado' }
  ];
  const parcelas = previa(valor, totalCentavos);

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-label-strong mb-1">Quando a cliente vai pagar?</legend>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup">
        {opcoes.map((o) => (
          <button
            key={o.modo}
            type="button"
            role="radio"
            aria-checked={valor.modo === o.modo}
            onClick={() => onChange({ ...valor, modo: o.modo })}
            className={`min-h-[44px] rounded-md border text-meta font-semibold ${
              valor.modo === o.modo ? 'border-brand-primary bg-brand-subtle text-brand-primary' : 'border-border-strong text-ink-secondary'
            }`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>

      {valor.modo !== 'SEM' && (
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 flex-1 min-w-[150px]">
            <span className="text-meta text-ink-secondary">{valor.modo === 'UNICO' ? 'Vence em' : '1ª parcela vence em'}</span>
            <input
              type="date"
              value={valor.data}
              onChange={(e) => onChange({ ...valor, data: e.target.value })}
              className="min-h-[44px] px-3 rounded-md border border-border-strong bg-surface-raised"
            />
          </label>
          {valor.modo === 'PARCELADO' && (
            <label className="flex flex-col gap-1 w-28">
              <span className="text-meta text-ink-secondary">Parcelas</span>
              <select
                value={valor.parcelas}
                onChange={(e) => onChange({ ...valor, parcelas: Number(e.target.value) })}
                className="min-h-[44px] px-2 rounded-md border border-border-strong bg-surface-raised"
              >
                {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                  <option key={n} value={n}>
                    {n}x
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {parcelas.length > 1 && (
        <ul className="text-meta text-ink-secondary flex flex-wrap gap-x-4 gap-y-1">
          {parcelas.map((p, i) => (
            <li key={p.data}>
              {i + 1}ª {br(p.data)} · <span className="tabular-nums">{formatarReais(p.valor)}</span>
            </li>
          ))}
        </ul>
      )}
      {valor.modo === 'SEM' && <p className="text-meta text-ink-muted">Sem data, a conta nunca aparece como atrasada.</p>}
    </fieldset>
  );
}
