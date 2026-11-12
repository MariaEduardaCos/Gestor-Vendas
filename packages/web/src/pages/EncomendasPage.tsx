import { useState } from 'react';
import { useApiGet, formatarReais, formatarData } from '../lib/api';
import { useAcoes } from '../app/AcoesContext';
import { Botao, CabecalhoPagina, Cartao, EstadoCarregamento, Filtros, Situacao, Tabela } from '../layout/ui';
import { resumoItens, type EncomendaListagem } from '../types/gestao';

type Filtro = 'abertas' | 'aguardando' | 'separadas' | 'todas';

function situacaoEncomenda(e: EncomendaListagem): string {
  const ativos = e.itens.filter((i) => !i.status_entrega.startsWith('CANCELADO'));
  if (ativos.length === 0) return 'CANCELADO';
  if (ativos.every((i) => i.status_entrega === 'ENTREGUE')) return 'ENTREGUE';
  if (ativos.some((i) => i.status_entrega === 'ENTREGUE')) return 'PARCIALMENTE_ENTREGUE';
  if (ativos.some((i) => i.status_entrega === 'RESERVADO_PRESENTE')) return 'DISPONIVEL_RETIRADA';
  return 'AGUARDANDO_FABRICA';
}

export function EncomendasPage() {
  const acoes = useAcoes();
  const [filtro, setFiltro] = useState<Filtro>('abertas');
  const { dados, carregando, erro } = useApiGet<EncomendaListagem[]>('/encomendas');

  const lista = (dados ?? []).filter((e) => {
    const s = situacaoEncomenda(e);
    if (filtro === 'aguardando') return s === 'AGUARDANDO_FABRICA';
    if (filtro === 'separadas') return s === 'DISPONIVEL_RETIRADA' || s === 'PARCIALMENTE_ENTREGUE';
    if (filtro === 'abertas') return s !== 'ENTREGUE' && s !== 'CANCELADO';
    return true;
  });

  return (
    <>
      <CabecalhoPagina
        titulo="Encomendas"
        descricao="Pedidos das clientes, do anotado até a entrega."
        acoes={
          <>
            <Botao variante="secundario" onClick={acoes.novoPedidoMarca}>Fechar pedido com a marca</Botao>
            <Botao onClick={() => acoes.novaEncomenda()}>+ Anotar encomenda</Botao>
          </>
        }
      />
      <div className="mb-4">
        <Filtros<Filtro>
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: 'abertas', rotulo: 'Em andamento' },
            { valor: 'aguardando', rotulo: 'Aguardando a marca' },
            { valor: 'separadas', rotulo: 'Prontas p/ entregar' },
            { valor: 'todas', rotulo: 'Todas' }
          ]}
        />
      </div>
      <Cartao>
        <EstadoCarregamento carregando={carregando} erro={erro} vazio={lista.length === 0} mensagemVazio="Nenhuma encomenda nesta situação.">
          <Tabela
            linhas={lista}
            chave={(e) => e.id}
            onLinha={(e) => acoes.abrirFicha(e.cliente_id)}
            colunas={[
              { titulo: 'Cliente', render: (e) => e.cliente_nome },
              { titulo: 'Produtos', render: (e) => <span className="text-ink-secondary">{resumoItens(e.itens)}</span> },
              { titulo: 'Anotada em', render: (e) => formatarData(e.criado_em), soComputador: true },
              { titulo: 'Valor', alinhar: 'direita', render: (e) => formatarReais(e.valor_total_centavos) },
              { titulo: 'Situação', render: (e) => <Situacao codigo={situacaoEncomenda(e)} /> }
            ]}
          />
        </EstadoCarregamento>
      </Cartao>
    </>
  );
}
