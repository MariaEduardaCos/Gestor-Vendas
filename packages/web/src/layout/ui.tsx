import type { ReactNode } from 'react';

export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-5">
      <div className="flex-1 min-w-0">
        <h2 className="text-title-lg font-bold">{titulo}</h2>
        {descricao && <p className="text-body-md text-ink-secondary mt-0.5">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  );
}

export function Botao({
  children,
  onClick,
  variante = 'primario',
  type = 'button'
}: {
  children: ReactNode;
  onClick?: () => void;
  variante?: 'primario' | 'secundario';
  type?: 'button' | 'submit';
}) {
  const estilo =
    variante === 'primario'
      ? 'bg-brand-primary hover:bg-brand-hover text-ink-inverse'
      : 'bg-surface-raised border border-border-strong hover:bg-surface-sunken text-ink-primary';
  return (
    <button type={type} onClick={onClick} className={`min-h-[44px] px-4 rounded-md text-label-strong transition-colors ${estilo}`}>
      {children}
    </button>
  );
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`bg-surface-raised border border-border-hairline rounded-lg ${className}`}>{children}</section>;
}

export function Indicador({ rotulo, valor, detalhe, tom = 'neutro', onClick }: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: string;
  tom?: 'neutro' | 'alerta' | 'reservado' | 'aguardando' | 'ok';
  onClick?: () => void;
}) {
  const cor = {
    neutro: 'text-ink-primary',
    alerta: 'text-status-alert',
    reservado: 'text-status-reserved',
    aguardando: 'text-status-waiting',
    ok: 'text-status-available'
  }[tom];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`text-left bg-surface-raised border border-border-hairline rounded-lg p-4 ${onClick ? 'hover:border-brand-primary transition-colors' : ''}`}
    >
      <p className="text-meta text-ink-secondary">{rotulo}</p>
      <p className={`text-title-lg font-bold mt-1 ${cor}`}>{valor}</p>
      {detalhe && <p className="text-meta text-ink-muted mt-0.5">{detalhe}</p>}
    </Tag>
  );
}

const SITUACOES: Record<string, { texto: string; tom: string }> = {
  // Itens e encomendas
  AGUARDANDO_FABRICA: { texto: 'Aguardando a marca', tom: 'aguardando' },
  RESERVADO_PRESENTE: { texto: 'Separado p/ cliente', tom: 'reservado' },
  DISPONIVEL_RETIRADA: { texto: 'Pronto p/ entregar', tom: 'reservado' },
  PARCIALMENTE_ENTREGUE: { texto: 'Entregue em parte', tom: 'reservado' },
  ENTREGUE: { texto: 'Entregue', tom: 'ok' },
  CANCELADO: { texto: 'Cancelado', tom: 'neutro' },
  CANCELADO_FALTA_FABRICA: { texto: 'Faltou na marca', tom: 'alerta' },
  SEM_ITENS: { texto: 'Sem itens', tom: 'neutro' },
  PENDENTE: { texto: 'Pendente', tom: 'neutro' },
  // Contas
  ABERTA: { texto: 'Em aberto', tom: 'alerta' },
  PARCIALMENTE_PAGA: { texto: 'Paga em parte', tom: 'reservado' },
  QUITADA: { texto: 'Quitada', tom: 'ok' },
  // Pedidos às marcas
  PEDIDO_REGISTRADO: { texto: 'Aguardando chegar', tom: 'aguardando' },
  CONFERENCIA_EM_ANDAMENTO: { texto: 'Chegou em parte', tom: 'reservado' },
  CONFERIDA: { texto: 'Conferido', tom: 'ok' },
  CANCELADA: { texto: 'Cancelado', tom: 'neutro' }
};

const TONS: Record<string, string> = {
  aguardando: 'bg-status-waiting-bg text-status-waiting',
  reservado: 'bg-status-reserved-bg text-status-reserved',
  ok: 'bg-status-available-bg text-status-available',
  alerta: 'bg-status-alert-bg text-status-alert',
  neutro: 'bg-surface-sunken text-ink-secondary'
};

export function Situacao({ codigo }: { codigo: string }) {
  const s = SITUACOES[codigo] ?? { texto: codigo.toLowerCase().replace(/_/g, ' '), tom: 'neutro' };
  return <span className={`inline-block whitespace-nowrap text-meta font-semibold px-2 py-0.5 rounded-full ${TONS[s.tom]}`}>{s.texto}</span>;
}

export function EstadoCarregamento({ carregando, erro, vazio, mensagemVazio, children }: {
  carregando: boolean;
  erro: string | null;
  vazio: boolean;
  mensagemVazio: ReactNode;
  children: ReactNode;
}) {
  if (erro) return <p className="p-4 rounded-md bg-status-alert-bg text-status-alert">{erro}</p>;
  if (carregando && vazio) return <p className="p-6 text-center text-ink-secondary">Carregando…</p>;
  if (vazio) return <div className="p-8 text-center text-ink-secondary">{mensagemVazio}</div>;
  return <>{children}</>;
}

export interface Coluna<T> {
  titulo: string;
  render: (linha: T) => ReactNode;
  alinhar?: 'direita';
  /** Esconde a coluna no cartão do celular (fica só na tabela do computador). */
  soComputador?: boolean;
}

/** Tabela no computador; lista de cartões no celular. */
export function Tabela<T>({ linhas, colunas, chave, onLinha }: {
  linhas: T[];
  colunas: Coluna<T>[];
  chave: (l: T) => string;
  onLinha?: (l: T) => void;
}) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-body-md">
          <thead>
            <tr className="border-b border-border-hairline text-meta text-ink-secondary">
              {colunas.map((c) => (
                <th key={c.titulo} className={`px-4 py-3 font-semibold ${c.alinhar === 'direita' ? 'text-right' : 'text-left'}`}>
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr
                key={chave(l)}
                onClick={onLinha ? () => onLinha(l) : undefined}
                className={`border-b border-border-hairline last:border-0 ${onLinha ? 'cursor-pointer hover:bg-surface-sunken' : ''}`}
              >
                {colunas.map((c) => (
                  <td key={c.titulo} className={`px-4 py-3 align-top ${c.alinhar === 'direita' ? 'text-right tabular-nums' : ''}`}>
                    {c.render(l)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden divide-y divide-border-hairline">
        {linhas.map((l) => (
          <li key={chave(l)}>
            <div
              role={onLinha ? 'button' : undefined}
              tabIndex={onLinha ? 0 : undefined}
              onClick={onLinha ? () => onLinha(l) : undefined}
              className={`p-4 flex flex-col gap-1.5 ${onLinha ? 'active:bg-surface-sunken' : ''}`}
            >
              {colunas
                .filter((c) => !c.soComputador)
                .map((c, idx) => (
                  <div key={c.titulo} className={idx === 0 ? 'font-semibold' : 'flex justify-between gap-3 text-body-md'}>
                    {idx > 0 && <span className="text-ink-secondary">{c.titulo}</span>}
                    <span className={idx > 0 ? 'text-right' : ''}>{c.render(l)}</span>
                  </div>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Filtros<T extends string>({ opcoes, valor, onChange }: {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={`whitespace-nowrap min-h-[40px] px-3 rounded-full text-label-strong border transition-colors ${
            valor === o.valor ? 'bg-ink-primary text-ink-inverse border-ink-primary' : 'border-border-strong text-ink-secondary hover:bg-surface-sunken'
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
