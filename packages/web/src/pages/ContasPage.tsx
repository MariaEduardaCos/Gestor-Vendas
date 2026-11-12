import { useState } from 'react';
import { useApiGet, formatarReais, formatarData, diasDesde } from '../lib/api';
import { useAcoes } from '../app/AcoesContext';
import { CabecalhoPagina, Cartao, EstadoCarregamento, Filtros, Indicador, Situacao, Tabela } from '../layout/ui';
import { saldoConta, type ContaListagem } from '../types/gestao';

type Filtro = 'abertas' | 'quitadas' | 'todas';

export function ContasPage() {
  const acoes = useAcoes();
  const [filtro, setFiltro] = useState<Filtro>('abertas');
  const { dados, carregando, erro } = useApiGet<ContaListagem[]>('/vendas');

  const todas = dados ?? [];
  const abertas = todas.filter((c) => saldoConta(c) > 0);
  const lista = (filtro === 'abertas' ? abertas : filtro === 'quitadas' ? todas.filter((c) => saldoConta(c) === 0) : todas)
    .slice()
    .sort((a, b) => (filtro === 'abertas' ? a.criado_em.localeCompare(b.criado_em) : b.criado_em.localeCompare(a.criado_em)));

  const totalAReceber = abertas.reduce((s, c) => s + saldoConta(c), 0);
  const maisDe30 = abertas.filter((c) => diasDesde(c.criado_em) > 30);

  return (
    <>
      <CabecalhoPagina
        titulo="Contas a receber"
        descricao="Cada compra da cliente gera uma conta. Para receber, abra a conta e registre o pagamento."
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <Indicador rotulo="Total a receber" valor={formatarReais(totalAReceber)} tom={totalAReceber > 0 ? 'alerta' : 'ok'} />
        <Indicador rotulo="Contas em aberto" valor={abertas.length} />
        <Indicador
          rotulo="Abertas há mais de 30 dias"
          valor={maisDe30.length}
          detalhe={formatarReais(maisDe30.reduce((s, c) => s + saldoConta(c), 0))}
          tom={maisDe30.length ? 'alerta' : 'neutro'}
        />
      </div>
      <div className="mb-4">
        <Filtros<Filtro>
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: 'abertas', rotulo: 'Em aberto' },
            { valor: 'quitadas', rotulo: 'Quitadas' },
            { valor: 'todas', rotulo: 'Todas' }
          ]}
        />
      </div>
      <Cartao>
        <EstadoCarregamento carregando={carregando} erro={erro} vazio={lista.length === 0} mensagemVazio="Nenhuma conta nesta situação.">
          <Tabela
            linhas={lista}
            chave={(c) => c.id}
            onLinha={(c) => acoes.abrirFicha(c.cliente_id)}
            colunas={[
              { titulo: 'Cliente', render: (c) => c.cliente.nome },
              { titulo: 'Aberta em', render: (c) => `${formatarData(c.criado_em)} (${diasDesde(c.criado_em)}d)` },
              { titulo: 'Total', alinhar: 'direita', render: (c) => formatarReais(c.valor_total), soComputador: true },
              { titulo: 'Pago', alinhar: 'direita', render: (c) => formatarReais(c.total_pago), soComputador: true },
              {
                titulo: 'Falta receber',
                alinhar: 'direita',
                render: (c) => <span className={saldoConta(c) > 0 ? 'font-semibold text-status-alert' : ''}>{formatarReais(saldoConta(c))}</span>
              },
              { titulo: 'Entrega', render: (c) => <Situacao codigo={c.status_entrega} />, soComputador: true },
              { titulo: 'Pagamento', render: (c) => <Situacao codigo={c.status} /> }
            ]}
          />
        </EstadoCarregamento>
      </Cartao>
    </>
  );
}
