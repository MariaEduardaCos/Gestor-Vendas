import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiGet, formatarReais, formatarData, diasDesde } from '../lib/api';
import { useAcoes } from '../app/AcoesContext';
import { useSessao } from '../app/SessaoContext';
import { Cartao, Indicador, Situacao } from '../layout/ui';
import { Icone, type NomeIcone } from '../layout/Icone';
import { saldoConta, resumoItens, type CompraListagem, type ContaListagem, type EstoqueLinha } from '../types/gestao';

/** Painel do dia: o que precisa de atenção agora, calculado a partir dos dados reais. */
export function HojePage() {
  const navegar = useNavigate();
  const acoes = useAcoes();
  const { sessao } = useSessao();
  const contas = useApiGet<ContaListagem[]>('/vendas');
  const compras = useApiGet<CompraListagem[]>('/compras-marca');
  const estoque = useApiGet<EstoqueLinha[]>('/estoque');
  const marcas = useApiGet<unknown[]>('/marcas');

  const listaContas = contas.dados ?? [];
  const emAberto = listaContas.filter((c) => c.status !== 'QUITADA' && saldoConta(c) > 0);
  const totalAReceber = emAberto.reduce((s, c) => s + saldoConta(c), 0);
  const paraEntregar = listaContas.filter((c) => c.itens.some((i) => i.status_entrega === 'RESERVADO_PRESENTE'));
  const pedidosAbertos = (compras.dados ?? []).filter((c) => c.status === 'PEDIDO_REGISTRADO' || c.status === 'CONFERENCIA_EM_ANDAMENTO');
  const semProntaEntrega = (estoque.dados ?? []).filter((e) => e.pronta_entrega === 0 && e.aguardando_fabrica === 0);
  const contasAntigas = [...emAberto].sort((a, b) => a.criado_em.localeCompare(b.criado_em)).slice(0, 5);

  const primeiroNome = sessao?.operador_nome;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-title-lg font-bold">{primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}</h2>
        <p className="text-body-md text-ink-secondary">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {marcas.dados && marcas.dados.length === 0 && (
        <button
          type="button"
          onClick={() => navegar('/marcas')}
          className="text-left p-4 rounded-lg border border-brand-primary bg-brand-subtle flex items-center gap-3"
        >
          <Icone nome="marcas" className="w-6 h-6 text-brand-primary shrink-0" />
          <span className="flex-1">
            <span className="block font-bold">Comece escolhendo as marcas que você vende</span>
            <span className="block text-meta text-ink-secondary">A comissão de cada marca fica salva e o catálogo do ciclo agiliza as encomendas.</span>
          </span>
          <Icone nome="seta" />
        </button>
      )}

      {/* Ações rápidas — principalmente para o celular */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <AcaoRapida icone="vendas" rotulo="Nova venda" onClick={() => acoes.novaVenda()} destaque />
        <AcaoRapida icone="encomendas" rotulo="Anotar encomenda" onClick={() => acoes.novaEncomenda()} />
        <AcaoRapida icone="caixa" rotulo="Conferir caixa" onClick={() => acoes.conferirCaixa()} />
        <AcaoRapida icone="clientes" rotulo="Nova cliente" onClick={() => acoes.novaCliente()} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Indicador rotulo="A receber" valor={formatarReais(totalAReceber)} detalhe={`${emAberto.length} contas em aberto`} tom={totalAReceber > 0 ? 'alerta' : 'ok'} onClick={() => navegar('/contas')} />
        <Indicador rotulo="Para entregar" valor={paraEntregar.length} detalhe="clientes com itens separados" tom="reservado" onClick={() => navegar('/vendas')} />
        <Indicador rotulo="Pedidos a chegar" valor={pedidosAbertos.length} detalhe="caixas das marcas" tom="aguardando" onClick={() => navegar('/pedidos')} />
        <Indicador rotulo="Sem pronta-entrega" valor={semProntaEntrega.length} detalhe="produtos zerados" onClick={() => navegar('/estoque')} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Cartao>
          <TituloSecao titulo="Separados para entregar" verTodos={() => navegar('/vendas')} />
          <Lista vazio="Nenhum item separado aguardando entrega.">
            {paraEntregar.slice(0, 6).map((c) => {
              const separados = c.itens.filter((i) => i.status_entrega === 'RESERVADO_PRESENTE');
              return (
                <LinhaLista key={c.id} onClick={() => acoes.abrirFicha(c.cliente_id)} titulo={c.cliente.nome} subtitulo={resumoItens(separados)}>
                  <Situacao codigo="RESERVADO_PRESENTE" />
                </LinhaLista>
              );
            })}
          </Lista>
        </Cartao>

        <Cartao>
          <TituloSecao titulo="Caixas das marcas a conferir" verTodos={() => navegar('/pedidos')} />
          <Lista vazio="Nenhum pedido aguardando chegada.">
            {pedidosAbertos.slice(0, 6).map((p) => (
              <LinhaLista
                key={p.id}
                onClick={() => acoes.conferirCaixa(p.id)}
                titulo={`${p.marca_nome}${p.numero_pedido ? ` · nº ${p.numero_pedido}` : ''}`}
                subtitulo={`${p.quantidade_total_itens} itens · pedido em ${formatarData(p.data_pedido)}`}
              >
                <span className="text-label-strong text-brand-primary">Conferir</span>
              </LinhaLista>
            ))}
          </Lista>
        </Cartao>

        <Cartao className="lg:col-span-2">
          <TituloSecao titulo="Contas em aberto há mais tempo" verTodos={() => navegar('/contas')} />
          <Lista vazio="Nenhuma conta em aberto. Tudo recebido!">
            {contasAntigas.map((c) => (
              <LinhaLista
                key={c.id}
                onClick={() => acoes.abrirFicha(c.cliente_id)}
                titulo={c.cliente.nome}
                subtitulo={`Desde ${formatarData(c.criado_em)} · ${diasDesde(c.criado_em)} dias`}
              >
                <span className="font-bold tabular-nums text-status-alert">{formatarReais(saldoConta(c))}</span>
              </LinhaLista>
            ))}
          </Lista>
        </Cartao>
      </div>
    </div>
  );
}

function AcaoRapida({ icone, rotulo, onClick, destaque }: { icone: NomeIcone; rotulo: string; onClick: () => void; destaque?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[64px] rounded-lg flex items-center gap-3 px-4 text-label-strong transition-colors ${
        destaque ? 'bg-brand-primary hover:bg-brand-hover text-ink-inverse' : 'bg-surface-raised border border-border-hairline hover:border-brand-primary'
      }`}
    >
      <Icone nome={icone} className="w-6 h-6 shrink-0" />
      <span className="text-left">{rotulo}</span>
    </button>
  );
}

function TituloSecao({ titulo, verTodos }: { titulo: string; verTodos: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <h3 className="text-title-md font-bold">{titulo}</h3>
      <button type="button" onClick={verTodos} className="text-meta font-semibold text-brand-primary min-h-[36px]">
        Ver tudo
      </button>
    </div>
  );
}

function Lista({ children, vazio }: { children: ReactNode[]; vazio: string }) {
  if (children.length === 0) return <p className="px-4 pb-5 pt-2 text-body-md text-ink-secondary">{vazio}</p>;
  return <ul className="divide-y divide-border-hairline">{children}</ul>;
}

function LinhaLista({ titulo, subtitulo, onClick, children }: { titulo: string; subtitulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-sunken">
        <span className="flex-1 min-w-0">
          <span className="block font-semibold truncate">{titulo}</span>
          <span className="block text-meta text-ink-secondary truncate">{subtitulo}</span>
        </span>
        {children}
      </button>
    </li>
  );
}
