import { useState } from 'react';
import { hojeNoFuso } from '@consultorasync/core';
import { useApiGet, formatarReais, formatarData } from '../lib/api';
import { useAcoes } from '../app/AcoesContext';
import { BotaoCobrar, BotaoVencimento, DescricaoVencimento } from '../app/cobranca/acoes';
import { CabecalhoPagina, Cartao, EstadoCarregamento, Filtros, Indicador, Situacao, Tabela } from '../layout/ui';
import type { ContaListagem } from '../types/gestao';

type Filtro = 'atrasadas' | 'semana' | 'abertas' | 'sem_vencimento' | 'quitadas' | 'todas';

function emDias(dias: number): string {
  const d = new Date(`${hojeNoFuso()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function ContasPage() {
  const acoes = useAcoes();
  const [filtro, setFiltro] = useState<Filtro>('abertas');
  const { dados, carregando, erro } = useApiGet<ContaListagem[]>('/vendas');

  const todas = dados ?? [];
  const abertas = todas.filter((c) => c.cobranca.saldo_centavos > 0);
  const atrasadas = abertas.filter((c) => c.cobranca.situacao === 'ATRASADA');
  const limiteSemana = emDias(7);
  const vencemNaSemana = abertas.filter(
    (c) => c.cobranca.situacao === 'EM_DIA' && c.cobranca.proximo_vencimento && c.cobranca.proximo_vencimento <= limiteSemana
  );

  const porFiltro: Record<Filtro, ContaListagem[]> = {
    atrasadas: [...atrasadas].sort((a, b) => b.cobranca.dias_atraso - a.cobranca.dias_atraso),
    semana: [...vencemNaSemana].sort((a, b) => (a.cobranca.proximo_vencimento ?? '').localeCompare(b.cobranca.proximo_vencimento ?? '')),
    abertas: [...abertas].sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
    sem_vencimento: abertas.filter((c) => c.cobranca.situacao === 'SEM_VENCIMENTO'),
    quitadas: todas.filter((c) => c.cobranca.saldo_centavos === 0),
    todas
  };
  const lista = porFiltro[filtro];

  const soma = (l: ContaListagem[], f: (c: ContaListagem) => number) => l.reduce((s, c) => s + f(c), 0);

  return (
    <>
      <CabecalhoPagina
        titulo="Contas a receber"
        descricao="Cada compra da cliente gera uma conta. Defina o vencimento para saber quem está atrasada e cobre pelo WhatsApp."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Indicador
          rotulo="Atrasado"
          valor={formatarReais(soma(atrasadas, (c) => c.cobranca.valor_vencido_centavos))}
          detalhe={`${atrasadas.length} conta(s)`}
          tom={atrasadas.length ? 'alerta' : 'ok'}
          onClick={() => setFiltro('atrasadas')}
        />
        <Indicador
          rotulo="Vence em 7 dias"
          valor={formatarReais(soma(vencemNaSemana, (c) => c.cobranca.saldo_centavos))}
          detalhe={`${vencemNaSemana.length} conta(s)`}
          tom="reservado"
          onClick={() => setFiltro('semana')}
        />
        <Indicador
          rotulo="Total a receber"
          valor={formatarReais(soma(abertas, (c) => c.cobranca.saldo_centavos))}
          detalhe={`${abertas.length} conta(s) em aberto`}
          onClick={() => setFiltro('abertas')}
        />
        <Indicador
          rotulo="Sem vencimento"
          valor={porFiltro.sem_vencimento.length}
          detalhe="defina uma data para acompanhar"
          onClick={() => setFiltro('sem_vencimento')}
        />
      </div>
      <div className="mb-4">
        <Filtros<Filtro>
          valor={filtro}
          onChange={setFiltro}
          opcoes={[
            { valor: 'atrasadas', rotulo: `Atrasadas (${atrasadas.length})` },
            { valor: 'semana', rotulo: 'Vencem esta semana' },
            { valor: 'abertas', rotulo: 'Em aberto' },
            { valor: 'sem_vencimento', rotulo: 'Sem vencimento' },
            { valor: 'quitadas', rotulo: 'Quitadas' },
            { valor: 'todas', rotulo: 'Todas' }
          ]}
        />
      </div>
      <Cartao>
        <EstadoCarregamento
          carregando={carregando}
          erro={erro}
          vazio={lista.length === 0}
          mensagemVazio={filtro === 'atrasadas' ? 'Nenhuma conta atrasada.' : 'Nenhuma conta nesta situação.'}
        >
          <Tabela
            linhas={lista}
            chave={(c) => c.id}
            onLinha={(c) => acoes.abrirFicha(c.cliente_id)}
            colunas={[
              { titulo: 'Cliente', render: (c) => c.cliente.nome },
              { titulo: 'Compra em', render: (c) => formatarData(c.criado_em), soComputador: true },
              { titulo: 'Total', alinhar: 'direita', render: (c) => formatarReais(c.valor_total), soComputador: true },
              {
                titulo: 'Falta receber',
                alinhar: 'direita',
                render: (c) => <span className={c.cobranca.saldo_centavos > 0 ? 'font-semibold' : ''}>{formatarReais(c.cobranca.saldo_centavos)}</span>
              },
              {
                titulo: 'Vencimento',
                render: (c) => (
                  <span>
                    <DescricaoVencimento cobranca={c.cobranca} />
                    {c.cobranca.parcelas.length > 1 && <span className="text-ink-muted"> · {c.cobranca.parcelas.length}x</span>}
                  </span>
                )
              },
              { titulo: 'Pagamento', render: (c) => <Situacao codigo={c.status} />, soComputador: true },
              {
                titulo: 'Ações',
                render: (c) =>
                  c.cobranca.saldo_centavos > 0 ? (
                    <span className="inline-flex gap-1 justify-end">
                      <BotaoVencimento conta={c} />
                      <BotaoCobrar conta={c} compacto />
                    </span>
                  ) : null
              }
            ]}
          />
        </EstadoCarregamento>
      </Cartao>
    </>
  );
}
