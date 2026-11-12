import { useState } from 'react';
import { useApiGet } from '../lib/api';
import { useSessao } from '../app/SessaoContext';
import { CabecalhoPagina, Cartao, EstadoCarregamento, Filtros, Tabela } from '../layout/ui';
import { ProdutosView } from '../components/ProdutosView';
import type { EstoqueLinha } from '../types/gestao';

type Aba = 'quantidades' | 'catalogo';

function Numero({ valor, cor }: { valor: number; cor: string }) {
  return <span className={`tabular-nums font-semibold ${valor === 0 ? 'text-ink-muted' : cor}`}>{valor}</span>;
}

export function EstoquePage() {
  const { token, versaoDados } = useSessao();
  const [aba, setAba] = useState<Aba>('quantidades');
  const [busca, setBusca] = useState('');
  const { dados, carregando, erro } = useApiGet<EstoqueLinha[]>('/estoque');

  const termo = busca.trim().toLowerCase();
  const lista = (dados ?? []).filter(
    (e) =>
      !termo ||
      e.produto_nome.toLowerCase().includes(termo) ||
      (e.produto_variante ?? '').toLowerCase().includes(termo) ||
      (e.produto_codigo_barras ?? '').includes(termo)
  );

  return (
    <>
      <CabecalhoPagina titulo="Estoque e produtos" descricao="Quanto você tem em casa, quanto já é de clientes e o que está para chegar." />
      <div className="mb-4">
        <Filtros<Aba>
          valor={aba}
          onChange={setAba}
          opcoes={[
            { valor: 'quantidades', rotulo: 'Quantidades' },
            { valor: 'catalogo', rotulo: 'Catálogo, preços e marcas' }
          ]}
        />
      </div>

      {aba === 'catalogo' ? (
        <ProdutosView sessionToken={token ?? undefined} refreshTrigger={versaoDados} />
      ) : (
        <>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto, variante ou código"
            className="w-full md:max-w-md min-h-touch-target px-3 mb-4 rounded-md border border-border-strong bg-surface-raised text-body-md"
          />
          <Cartao>
            <EstadoCarregamento
              carregando={carregando}
              erro={erro}
              vazio={lista.length === 0}
              mensagemVazio="Nenhum produto com estoque. Lance o estoque inicial pelo catálogo ou confira uma caixa."
            >
              <Tabela
                linhas={lista}
                chave={(e) => e.id}
                colunas={[
                  { titulo: 'Produto', render: (e) => `${e.produto_nome}${e.produto_variante ? ` — ${e.produto_variante}` : ''}` },
                  { titulo: 'Marca', render: (e) => e.marca_nome ?? '—', soComputador: true },
                  { titulo: 'Em casa', alinhar: 'direita', render: (e) => <Numero valor={e.presentes} cor="text-ink-primary" /> },
                  { titulo: 'Separados p/ clientes', alinhar: 'direita', render: (e) => <Numero valor={e.reservados} cor="text-status-reserved" /> },
                  { titulo: 'Pronta-entrega', alinhar: 'direita', render: (e) => <Numero valor={e.pronta_entrega} cor="text-status-available" /> },
                  { titulo: 'A chegar', alinhar: 'direita', render: (e) => <Numero valor={e.aguardando_fabrica} cor="text-status-waiting" /> }
                ]}
              />
            </EstadoCarregamento>
          </Cartao>
        </>
      )}
    </>
  );
}
