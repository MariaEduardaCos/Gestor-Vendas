import { useState } from 'react';
import { useApiGet, formatarReais, formatarData } from '../lib/api';
import { useAcoes } from '../app/AcoesContext';
import { Botao, CabecalhoPagina, Cartao, EstadoCarregamento, Filtros, Situacao, Tabela } from '../layout/ui';
import { resumoItens, type ContaListagem } from '../types/gestao';

type Filtro = 'entregar' | 'todas';

export function VendasPage() {
  const acoes = useAcoes();
  const [filtro, setFiltro] = useState<Filtro>('entregar');
  const { dados, carregando, erro } = useApiGet<ContaListagem[]>('/vendas');

  const lista = (dados ?? []).filter((c) =>
    filtro === 'todas' ? true : c.itens.some((i) => i.status_entrega === 'RESERVADO_PRESENTE')
  );

  return (
    <>
      <CabecalhoPagina
        titulo="Vendas e entregas"
        descricao="Vendas de pronta-entrega e encomendas. Para entregar, abra a cliente e confirme a entrega dos itens."
        acoes={<Botao onClick={() => acoes.novaVenda()}>+ Nova venda</Botao>}
      />
      <div className="mb-4">
        <Filtros<Filtro>
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: 'entregar', rotulo: 'Para entregar' },
            { valor: 'todas', rotulo: 'Todas as vendas' }
          ]}
        />
      </div>
      <Cartao>
        <EstadoCarregamento
          carregando={carregando}
          erro={erro}
          vazio={lista.length === 0}
          mensagemVazio={filtro === 'entregar' ? 'Nada separado aguardando entrega.' : 'Nenhuma venda registrada.'}
        >
          <Tabela
            linhas={lista}
            chave={(c) => c.id}
            onLinha={(c) => acoes.abrirFicha(c.cliente_id)}
            colunas={[
              { titulo: 'Cliente', render: (c) => c.cliente.nome },
              { titulo: 'Produtos', render: (c) => <span className="text-ink-secondary">{resumoItens(c.itens)}</span> },
              { titulo: 'Data', render: (c) => formatarData(c.criado_em), soComputador: true },
              { titulo: 'Tipo', render: (c) => (c.encomenda_id ? 'Encomenda' : 'Pronta-entrega'), soComputador: true },
              { titulo: 'Total', alinhar: 'direita', render: (c) => formatarReais(c.valor_total) },
              { titulo: 'Entrega', render: (c) => <Situacao codigo={c.status_entrega} /> }
            ]}
          />
        </EstadoCarregamento>
      </Cartao>
    </>
  );
}
