import { useState, type FormEvent } from 'react';
import { useApiGet, apiFetch, formatarReais, formatarData } from '../lib/api';
import { useSessao } from '../app/SessaoContext';
import { Cartao, Indicador } from '../layout/ui';

interface Boleto {
  id: string;
  descricao: string;
  valor_centavos: number;
  vencimento: string;
  linha_digitavel: string | null;
  status: 'ABERTO' | 'PAGO';
  vencido: boolean;
  pago_em: string | null;
  marca_id: string | null;
  marca_nome: string | null;
  compra_id: string | null;
  compra_numero_pedido: string | null;
}

interface RespostaBoletos {
  boletos: Boleto[];
  total_aberto_centavos: number;
  total_vencido_centavos: number;
  total_pago_centavos: number;
}

interface MarcaOpcao {
  id: string;
  nome: string;
}

interface PedidoOpcao {
  id: string;
  marca_id?: string;
  marca_nome: string;
  numero_pedido: string | null;
  data_pedido: string;
}

/** "1.234,56" ou "1234.56" → centavos; null se não for um valor. */
function lerValor(texto: string): number | null {
  const limpo = texto.replace(/r\$/i, '').replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(limpo)) return null;
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normal);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

const campo = 'w-full min-h-[44px] px-3 rounded-md border border-border-strong bg-surface-raised text-body-md text-ink-primary';
const botaoSecundario = 'min-h-[44px] px-3 rounded-md border border-border-strong bg-surface-raised hover:bg-surface-sunken text-label-strong text-ink-primary';

/** Boletos que a revendedora paga às marcas: adicionar, acompanhar o vencimento e marcar como pago. */
export function BoletosCartao() {
  const { token, notificarAlteracao } = useSessao();
  const { dados, erro: erroCarga, carregando } = useApiGet<RespostaBoletos>('/boletos');
  const { dados: marcas } = useApiGet<MarcaOpcao[]>('/marcas');
  const { dados: pedidos } = useApiGet<PedidoOpcao[]>('/compras-marca');

  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [linha, setLinha] = useState('');
  const [marcaId, setMarcaId] = useState('');
  const [compraId, setCompraId] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mostrarPagos, setMostrarPagos] = useState(false);

  const limpar = () => {
    setDescricao('');
    setValor('');
    setVencimento('');
    setLinha('');
    setMarcaId('');
    setCompraId('');
  };

  const executar = async (acao: () => Promise<unknown>, mensagem: string) => {
    setErro(null);
    setAviso(null);
    setSalvando(true);
    try {
      await acao();
      setAviso(mensagem);
      notificarAlteracao();
      return true;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.');
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    const centavos = lerValor(valor);
    if (descricao.trim().length < 2) return setErro('Dê um nome ao boleto, por exemplo "Pedido do ciclo 17".');
    if (centavos === null) return setErro('Informe o valor do boleto, por exemplo 260,00.');
    if (!vencimento) return setErro('Informe a data de vencimento.');
    const ok = await executar(
      () =>
        apiFetch('/boletos', token, {
          method: 'POST',
          body: JSON.stringify({
            descricao: descricao.trim(),
            valor_centavos: centavos,
            vencimento,
            linha_digitavel: linha.trim() || null,
            marca_id: marcaId || null,
            compra_id: compraId || null
          })
        }),
      'Boleto adicionado.'
    );
    if (ok) {
      limpar();
      setAberto(false);
    }
  };

  const copiarLinha = async (b: Boleto) => {
    try {
      await navigator.clipboard.writeText(b.linha_digitavel ?? '');
      setAviso('Linha digitável copiada.');
    } catch {
      setErro('Não foi possível copiar a linha digitável.');
    }
  };

  const boletos = dados?.boletos ?? [];
  const abertos = boletos.filter((b) => b.status === 'ABERTO');
  const pagos = boletos.filter((b) => b.status === 'PAGO');

  return (
    <Cartao className="p-5 mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-title-md font-bold">Boletos das marcas</h3>
          <p className="text-meta text-ink-secondary">O que você tem a pagar às marcas pelos pedidos. Não entra na conta das clientes.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAberto((v) => !v);
            setErro(null);
          }}
          className="min-h-[44px] px-4 rounded-md bg-brand-primary hover:bg-brand-hover text-ink-inverse text-label-strong"
        >
          {aberto ? 'Fechar' : '+ Adicionar boleto'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <Indicador rotulo="A pagar" valor={formatarReais(dados?.total_aberto_centavos)} detalhe={`${abertos.length} boleto(s) em aberto`} tom="alerta" />
        <Indicador rotulo="Vencido" valor={formatarReais(dados?.total_vencido_centavos)} detalhe="em aberto com data passada" tom={dados?.total_vencido_centavos ? 'alerta' : 'neutro'} />
        <Indicador rotulo="Pago" valor={formatarReais(dados?.total_pago_centavos)} detalhe={`${pagos.length} boleto(s)`} tom="ok" />
      </div>

      {erro && <p role="alert" className="mb-3 p-3 rounded-md bg-status-alert-bg text-status-alert text-body-md">{erro}</p>}
      {aviso && !erro && <p role="status" className="mb-3 text-meta text-ink-secondary">{aviso}</p>}
      {erroCarga && <p className="mb-3 p-3 rounded-md bg-status-alert-bg text-status-alert">{erroCarga}</p>}

      {aberto && (
        <form onSubmit={salvar} className="mb-5 p-4 rounded-md bg-surface-sunken border border-border-hairline grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-meta text-ink-secondary sm:col-span-2">
            Descrição
            <input className={campo} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Pedido do ciclo 17" maxLength={120} />
          </label>
          <label className="text-meta text-ink-secondary">
            Valor (R$)
            <input className={campo} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </label>
          <label className="text-meta text-ink-secondary">
            Vencimento
            <input className={campo} type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </label>
          <label className="text-meta text-ink-secondary">
            Marca (opcional)
            <select className={campo} value={marcaId} onChange={(e) => setMarcaId(e.target.value)}>
              <option value="">Sem marca</option>
              {(marcas ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </label>
          <label className="text-meta text-ink-secondary">
            Pedido (opcional)
            <select className={campo} value={compraId} onChange={(e) => setCompraId(e.target.value)}>
              <option value="">Sem pedido</option>
              {(pedidos ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.marca_nome} · {formatarData(p.data_pedido)}{p.numero_pedido ? ` · nº ${p.numero_pedido}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="text-meta text-ink-secondary sm:col-span-2">
            Linha digitável (opcional)
            <input className={campo} value={linha} onChange={(e) => setLinha(e.target.value)} placeholder="Os 47 números do boleto" inputMode="numeric" />
          </label>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className={botaoSecundario} onClick={() => { limpar(); setAberto(false); setErro(null); }}>Cancelar</button>
            <button type="submit" disabled={salvando} className="min-h-[44px] px-4 rounded-md bg-brand-primary hover:bg-brand-hover text-ink-inverse text-label-strong disabled:opacity-60">
              {salvando ? 'Salvando…' : 'Salvar boleto'}
            </button>
          </div>
        </form>
      )}

      {carregando && !dados ? (
        <p className="text-ink-secondary">Carregando…</p>
      ) : abertos.length === 0 ? (
        <p className="text-body-md text-ink-secondary">Nenhum boleto em aberto.</p>
      ) : (
        <ul className="divide-y divide-border-hairline">
          {abertos.map((b) => (
            <LinhaBoleto key={b.id} b={b} salvando={salvando} onCopiar={copiarLinha}>
              <button type="button" disabled={salvando} className="min-h-[44px] px-3 rounded-md bg-brand-primary hover:bg-brand-hover text-ink-inverse text-label-strong disabled:opacity-60"
                onClick={() => executar(() => apiFetch(`/boletos/${b.id}/pagar`, token, { method: 'POST' }), `Boleto "${b.descricao}" marcado como pago.`)}>
                Marcar como pago
              </button>
              <button type="button" disabled={salvando} className={botaoSecundario}
                onClick={() => {
                  if (window.confirm(`Excluir o boleto "${b.descricao}"? Isso não pode ser desfeito.`))
                    executar(() => apiFetch(`/boletos/${b.id}`, token, { method: 'DELETE' }), 'Boleto excluído.');
                }}>
                Excluir
              </button>
            </LinhaBoleto>
          ))}
        </ul>
      )}

      {pagos.length > 0 && (
        <div className="mt-4">
          <button type="button" className="text-label-strong text-brand-primary underline min-h-[44px]" onClick={() => setMostrarPagos((v) => !v)}>
            {mostrarPagos ? 'Esconder pagos' : `Ver ${pagos.length} boleto(s) pago(s)`}
          </button>
          {mostrarPagos && (
            <ul className="divide-y divide-border-hairline">
              {pagos.map((b) => (
                <LinhaBoleto key={b.id} b={b} salvando={salvando} onCopiar={copiarLinha}>
                  <button type="button" disabled={salvando} className={botaoSecundario}
                    onClick={() => executar(() => apiFetch(`/boletos/${b.id}/reabrir`, token, { method: 'POST' }), `Boleto "${b.descricao}" voltou para em aberto.`)}>
                    Desfazer pagamento
                  </button>
                </LinhaBoleto>
              ))}
            </ul>
          )}
        </div>
      )}
    </Cartao>
  );
}

function LinhaBoleto({ b, children, onCopiar }: { b: Boleto; salvando: boolean; onCopiar: (b: Boleto) => void; children: React.ReactNode }) {
  return (
    <li className="py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-body-md font-bold text-ink-primary">
          {b.descricao}
          {b.vencido && <span className="ml-2 px-2 py-0.5 rounded bg-status-alert-bg text-status-alert text-meta font-bold">Vencido</span>}
          {b.status === 'PAGO' && <span className="ml-2 px-2 py-0.5 rounded bg-status-available-bg text-status-available text-meta font-bold">Pago</span>}
        </p>
        <p className="text-meta text-ink-secondary">
          <span className="font-bold text-ink-primary tabular-nums">{formatarReais(b.valor_centavos)}</span> · vence em {formatarData(`${b.vencimento}T12:00:00`)}
          {b.marca_nome ? ` · ${b.marca_nome}` : ''}
          {b.compra_numero_pedido ? ` · pedido nº ${b.compra_numero_pedido}` : b.compra_id ? ' · ligado a um pedido' : ''}
          {b.pago_em ? ` · pago em ${formatarData(b.pago_em)}` : ''}
        </p>
        {b.linha_digitavel && (
          <button type="button" onClick={() => onCopiar(b)} className="text-meta text-brand-primary underline min-h-[44px] text-left break-all">
            Copiar linha digitável ({b.linha_digitavel.slice(0, 10)}…)
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </li>
  );
}
