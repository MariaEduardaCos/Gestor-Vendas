import { useEffect, useState } from 'react';
import { useApiGet, apiFetch, formatarReais, formatarData } from '../lib/api';
import { useSessao } from '../app/SessaoContext';
import { EspelhoPedido, type LinhaEspelho } from '../components/EspelhoPedido';
import { useAcoes } from '../app/AcoesContext';
import { Botao, CabecalhoPagina, Cartao, EstadoCarregamento, Filtros, Situacao, Tabela } from '../layout/ui';
import type { CompraListagem } from '../types/gestao';

type Filtro = 'chegar' | 'conferidos' | 'todos';

export function PedidosPage() {
  const acoes = useAcoes();
  const [filtro, setFiltro] = useState<Filtro>('chegar');
  const { dados, carregando, erro } = useApiGet<CompraListagem[]>('/compras-marca');
  const [espelhoDe, setEspelhoDe] = useState<CompraListagem | null>(null);

  const lista = (dados ?? []).filter((p) =>
    filtro === 'todos' ? true : filtro === 'conferidos' ? p.status === 'CONFERIDA' : p.status !== 'CONFERIDA' && p.status !== 'CANCELADA'
  );

  return (
    <>
      <CabecalhoPagina
        titulo="Pedidos às marcas"
        descricao="Junte as encomendas das clientes com a pronta-entrega e confira a caixa quando chegar."
        acoes={
          <>
            <Botao variante="secundario" onClick={() => acoes.conferirCaixa()}>Conferir caixa</Botao>
            <Botao onClick={acoes.novoPedidoMarca}>+ Novo pedido</Botao>
          </>
        }
      />
      <div className="mb-4">
        <Filtros<Filtro>
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: 'chegar', rotulo: 'A chegar' },
            { valor: 'conferidos', rotulo: 'Conferidos' },
            { valor: 'todos', rotulo: 'Todos' }
          ]}
        />
      </div>
      <Cartao>
        <EstadoCarregamento carregando={carregando} erro={erro} vazio={lista.length === 0} mensagemVazio="Nenhum pedido nesta situação.">
          <Tabela
            linhas={lista}
            chave={(p) => p.id}
            onLinha={(p) => acoes.conferirCaixa(p.id)}
            colunas={[
              { titulo: 'Marca', render: (p) => `${p.marca_nome}${p.numero_pedido ? ` · nº ${p.numero_pedido}` : ''}` },
              { titulo: 'Data do pedido', render: (p) => formatarData(p.data_pedido) },
              { titulo: 'Para clientes', alinhar: 'direita', render: (p) => p.quantidade_itens_clientes, soComputador: true },
              { titulo: 'Pronta-entrega', alinhar: 'direita', render: (p) => p.quantidade_itens_pronta_entrega, soComputador: true },
              { titulo: 'Itens', alinhar: 'direita', render: (p) => p.quantidade_total_itens },
              { titulo: 'Custo', alinhar: 'direita', render: (p) => formatarReais(p.custo_total_centavos), soComputador: true },
              { titulo: 'Situação', render: (p) => <Situacao codigo={p.status} /> },
              {
                titulo: 'Espelho',
                render: (p) => (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEspelhoDe(p);
                    }}
                    className="min-h-[44px] px-3 rounded-md border border-border-strong bg-surface-raised hover:bg-surface-sunken text-label-strong text-ink-primary whitespace-nowrap"
                  >
                    Ver espelho
                  </button>
                )
              }
            ]}
          />
        </EstadoCarregamento>
      </Cartao>
      {espelhoDe && <JanelaEspelho pedido={espelhoDe} onFechar={() => setEspelhoDe(null)} />}
    </>
  );
}

function JanelaEspelho({ pedido, onFechar }: { pedido: CompraListagem; onFechar: () => void }) {
  const { token } = useSessao();
  const [linhas, setLinhas] = useState<LinhaEspelho[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    apiFetch<{ espelho_produtos: LinhaEspelho[] }>(`/compras-marca/${pedido.id}`, token)
      .then((d) => ativo && setLinhas(d.espelho_produtos ?? []))
      .catch((e: Error) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
  }, [pedido.id, token]);

  const arquivo = `pedido-${pedido.marca_nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${pedido.numero_pedido ? `-${pedido.numero_pedido}` : ''}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onFechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Espelho do pedido"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-raised w-full sm:max-w-2xl max-h-[90vh] rounded-t-xl sm:rounded-xl shadow-xl flex flex-col"
      >
        <div className="p-4 border-b border-border-hairline flex items-start justify-between gap-3">
          <div>
            <h2 className="text-title-md font-bold text-ink-primary">Espelho do pedido · {pedido.marca_nome}</h2>
            <p className="text-meta text-ink-secondary">
              {formatarData(pedido.data_pedido)}
              {pedido.numero_pedido ? ` · nº ${pedido.numero_pedido}` : ''} · {pedido.quantidade_total_itens} itens. Use o código e a quantidade para digitar no site da marca.
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="min-h-[44px] min-w-[44px] text-title-lg text-ink-secondary hover:text-ink-primary">
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          {erro ? (
            <p className="p-3 rounded-md bg-status-alert-bg text-status-alert">{erro}</p>
          ) : linhas === null ? (
            <p className="text-ink-secondary">Carregando…</p>
          ) : (
            <EspelhoPedido linhas={linhas} nomeArquivo={arquivo} />
          )}
        </div>
      </div>
    </div>
  );
}
