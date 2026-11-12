import { useNavigate } from 'react-router-dom';
import { useApiGet, formatarReais } from '../lib/api';
import { CabecalhoPagina, Cartao, Indicador } from '../layout/ui';
import type { ResumoFinanceiro } from '../types/gestao';

export function FinanceiroPage() {
  const navegar = useNavigate();
  const { dados: r, erro } = useApiGet<ResumoFinanceiro>('/relatorios/resumo-financeiro');

  if (erro) return <p className="p-4 rounded-md bg-status-alert-bg text-status-alert">{erro}</p>;

  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro"
        descricao="Vendido, recebido e a receber ficam separados: venda anotada ainda não é dinheiro no bolso."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Indicador rotulo="Total vendido" valor={formatarReais(r?.total_vendido_centavos)} detalhe="soma das contas" />
        <Indicador rotulo="Recebido" valor={formatarReais(r?.total_recebido_bruto_centavos)} detalhe="pagamentos confirmados" tom="ok" />
        <Indicador rotulo="A receber" valor={formatarReais(r?.total_a_receber_centavos)} tom="alerta" onClick={() => navegar('/contas')} />
        <Indicador rotulo="Créditos de clientes" valor={formatarReais(r?.total_creditos_ativos_centavos)} detalhe="valor que você deve em produtos" tom="reservado" />
      </div>

      <Cartao className="p-5">
        <h3 className="text-title-md font-bold mb-3">Recebimentos</h3>
        <dl className="divide-y divide-border-hairline text-body-md">
          <Linha rotulo="Recebido (bruto)" valor={formatarReais(r?.total_recebido_bruto_centavos)} />
          <Linha rotulo="Taxas de maquininha pagas por você" valor={`− ${formatarReais(r?.total_taxas_cartao_centavos)}`} />
          <Linha rotulo="Recebido (líquido)" valor={formatarReais(r?.total_recebido_liquido_centavos)} forte />
          <Linha rotulo="Devolvido às clientes" valor={formatarReais(r?.total_devolvido_centavos)} />
        </dl>
        <p className="text-meta text-ink-muted mt-4">
          O ganho por venda depende do custo de cada produto (informado ou estimado pelo percentual da marca) e ainda não é exibido aqui.
        </p>
      </Cartao>
    </>
  );
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-2.5 ${forte ? 'font-bold' : ''}`}>
      <dt className={forte ? '' : 'text-ink-secondary'}>{rotulo}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}
