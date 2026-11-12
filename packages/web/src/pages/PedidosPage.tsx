import { useState } from 'react';
import { useApiGet, formatarReais, formatarData } from '../lib/api';
import { useAcoes } from '../app/AcoesContext';
import { Botao, CabecalhoPagina, Cartao, EstadoCarregamento, Filtros, Situacao, Tabela } from '../layout/ui';
import type { CompraListagem } from '../types/gestao';

type Filtro = 'chegar' | 'conferidos' | 'todos';

export function PedidosPage() {
  const acoes = useAcoes();
  const [filtro, setFiltro] = useState<Filtro>('chegar');
  const { dados, carregando, erro } = useApiGet<CompraListagem[]>('/compras-marca');

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
              { titulo: 'Situação', render: (p) => <Situacao codigo={p.status} /> }
            ]}
          />
        </EstadoCarregamento>
      </Cartao>
    </>
  );
}
