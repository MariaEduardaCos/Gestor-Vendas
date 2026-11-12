import { useEffect, useMemo, useState } from 'react';
import { useApiGet, formatarReais, formatarData } from '../lib/api';
import { useAcoes } from '../app/AcoesContext';
import { Botao, CabecalhoPagina, Cartao, EstadoCarregamento, Tabela } from '../layout/ui';
import { saldoConta, type ContaListagem } from '../types/gestao';
import type { ClienteDTO } from '../types/cliente';

export function ClientesPage() {
  const acoes = useAcoes();
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  const clientes = useApiGet<ClienteDTO[]>(`/clientes${buscaAplicada ? `?busca=${encodeURIComponent(buscaAplicada)}` : ''}`);
  const contas = useApiGet<ContaListagem[]>('/vendas');

  // Saldo devedor e última compra de cada cliente, a partir das contas.
  const porCliente = useMemo(() => {
    const mapa = new Map<string, { devendo: number; ultima: string | null; abertas: number }>();
    for (const c of contas.dados ?? []) {
      const atual = mapa.get(c.cliente_id) ?? { devendo: 0, ultima: null, abertas: 0 };
      atual.devendo += saldoConta(c);
      if (saldoConta(c) > 0) atual.abertas += 1;
      if (!atual.ultima || c.criado_em > atual.ultima) atual.ultima = c.criado_em;
      mapa.set(c.cliente_id, atual);
    }
    return mapa;
  }, [contas.dados]);

  const lista = clientes.dados ?? [];

  return (
    <>
      <CabecalhoPagina
        titulo="Clientes"
        descricao="Cadastro, histórico de compras e quanto cada cliente deve."
        acoes={<Botao onClick={acoes.novaCliente}>+ Nova cliente</Botao>}
      />
      <input
        type="search"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou telefone"
        className="w-full md:max-w-md min-h-touch-target px-3 mb-4 rounded-md border border-border-strong bg-surface-raised text-body-md"
      />
      <Cartao>
        <EstadoCarregamento
          carregando={clientes.carregando}
          erro={clientes.erro}
          vazio={lista.length === 0}
          mensagemVazio={buscaAplicada ? `Nenhuma cliente encontrada para "${buscaAplicada}".` : 'Nenhuma cliente cadastrada ainda.'}
        >
          <Tabela
            linhas={lista}
            chave={(c) => c.id}
            onLinha={(c) => acoes.abrirFicha(c.id)}
            colunas={[
              { titulo: 'Nome', render: (c) => c.nome },
              { titulo: 'Telefone', render: (c) => c.telefone_formatado || c.telefone || '—' },
              { titulo: 'Última compra', render: (c) => formatarData(porCliente.get(c.id)?.ultima), soComputador: true },
              {
                titulo: 'Crédito',
                alinhar: 'direita',
                soComputador: true,
                render: (c) => (c.saldo_credito_centavos > 0 ? <span className="text-status-available">{formatarReais(c.saldo_credito_centavos)}</span> : '—')
              },
              {
                titulo: 'Deve',
                alinhar: 'direita',
                render: (c) => {
                  const d = porCliente.get(c.id)?.devendo ?? 0;
                  return d > 0 ? <span className="font-semibold text-status-alert">{formatarReais(d)}</span> : <span className="text-ink-muted">—</span>;
                }
              },
              {
                titulo: '',
                soComputador: true,
                render: (c) => (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      acoes.novaEncomenda({ id: c.id, nome: c.nome });
                    }}
                    className="text-meta font-semibold text-brand-primary hover:underline whitespace-nowrap"
                  >
                    + Encomenda
                  </button>
                )
              }
            ]}
          />
        </EstadoCarregamento>
      </Cartao>
    </>
  );
}
