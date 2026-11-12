import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useSessao } from './SessaoContext';
import { SeletorClienteModal } from './SeletorClienteModal';
import { ClienteDrawer } from '../components/ClienteDrawer';
import { ClienteFichaModal } from '../components/ClienteFichaModal';
import { EncomendaModal } from '../components/EncomendaModal';
import { CompraMarcaModal } from '../components/CompraMarcaModal';
import { ConferenciaCaixaModal } from '../components/ConferenciaCaixaModal';
import { VendaModal } from '../components/VendaModal';
import { formatarReais } from '../lib/api';
import type { ClienteDTO } from '../types/cliente';

type ClienteRef = { id: string; nome: string };

interface AcoesContextValue {
  novaCliente: () => void;
  abrirFicha: (clienteId: string) => void;
  novaEncomenda: (cliente?: ClienteRef) => void;
  novaVenda: (cliente?: ClienteRef) => void;
  novoPedidoMarca: () => void;
  conferirCaixa: (compraId?: string) => void;
  avisar: (mensagem: string) => void;
}

const AcoesContext = createContext<AcoesContextValue | null>(null);

/**
 * Centraliza os formulários de operação (cliente, encomenda, venda, pedido, conferência)
 * para que possam ser abertos de qualquer página, no computador ou no celular.
 */
export function AcoesProvider({ children }: { children: ReactNode }) {
  const { token, notificarAlteracao } = useSessao();
  const tk = token ?? undefined;

  const [aviso, setAviso] = useState<string | null>(null);
  const [drawerCliente, setDrawerCliente] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [encomendaCliente, setEncomendaCliente] = useState<ClienteRef | null>(null);
  const [seletorEncomenda, setSeletorEncomenda] = useState(false);
  const [venda, setVenda] = useState<{ cliente: ClienteRef | null } | null>(null);
  const [pedidoMarca, setPedidoMarca] = useState(false);
  const [conferencia, setConferencia] = useState<{ compraId: string | null } | null>(null);
  const [versaoFicha, setVersaoFicha] = useState(0);
  // De onde o cadastro rápido foi aberto, para devolver a cliente nova ao fluxo certo.
  const [aposCadastro, setAposCadastro] = useState<'venda' | 'encomenda' | null>(null);
  const [clienteNovoVenda, setClienteNovoVenda] = useState<ClienteRef | null>(null);

  const avisar = useCallback((mensagem: string) => {
    setAviso(mensagem);
    window.setTimeout(() => setAviso((atual) => (atual === mensagem ? null : atual)), 5000);
  }, []);

  const alterou = (mensagem?: string) => {
    notificarAlteracao();
    setVersaoFicha((v) => v + 1);
    if (mensagem) avisar(mensagem);
  };

  const novaEncomenda = useCallback((cliente?: ClienteRef) => {
    if (cliente) setEncomendaCliente(cliente);
    else setSeletorEncomenda(true);
  }, []);

  const valor: AcoesContextValue = {
    novaCliente: () => setDrawerCliente(true),
    abrirFicha: (id) => setFichaId(id),
    novaEncomenda,
    novaVenda: (cliente) => {
      setClienteNovoVenda(null);
      setVenda({ cliente: cliente ?? null });
    },
    novoPedidoMarca: () => setPedidoMarca(true),
    conferirCaixa: (compraId) => setConferencia({ compraId: compraId ?? null }),
    avisar
  };

  return (
    <AcoesContext.Provider value={valor}>
      {children}

      {aviso && (
        <div
          role="status"
          className="fixed z-[70] left-4 right-4 bottom-24 lg:bottom-6 lg:left-auto lg:right-6 lg:max-w-sm bg-ink-primary text-ink-inverse rounded-lg px-4 py-3 shadow-xl flex items-start gap-3 animate-fade-in"
        >
          <span className="flex-1 text-body-md">{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso" className="font-bold">
            ✕
          </button>
        </div>
      )}

      {seletorEncomenda && (
        <SeletorClienteModal
          titulo="Encomenda para qual cliente?"
          onClose={() => setSeletorEncomenda(false)}
          onNovaCliente={() => {
            setSeletorEncomenda(false);
            setAposCadastro('encomenda');
            setDrawerCliente(true);
          }}
          onEscolher={(c) => {
            setSeletorEncomenda(false);
            setEncomendaCliente({ id: c.id, nome: c.nome });
          }}
        />
      )}

      <ClienteFichaModal
        clienteId={fichaId}
        isOpen={!!fichaId}
        sessionToken={tk}
        refreshKey={versaoFicha}
        onClose={() => setFichaId(null)}
        onAbrirEncomenda={(c) => setEncomendaCliente(c)}
        onClienteAtualizado={() => alterou()}
        onClienteExcluido={() => {
          setFichaId(null);
          alterou('Cliente excluída.');
        }}
      />

      <EncomendaModal
        isOpen={!!encomendaCliente}
        cliente={encomendaCliente}
        sessionToken={tk}
        onClose={() => setEncomendaCliente(null)}
        onEncomendaCriada={(enc) =>
          alterou(`Encomenda anotada para ${enc.cliente_nome}. Total: ${enc.valor_total_formatado}`)
        }
      />

      <VendaModal
        isOpen={!!venda}
        clientePreSelecionado={venda?.cliente ?? null}
        sessionToken={tk}
        onClose={() => setVenda(null)}
        clienteNovo={clienteNovoVenda}
        onAbrirGavetaCliente={() => {
          setAposCadastro('venda');
          setDrawerCliente(true);
        }}
        onVendaConcluida={(r) =>
          alterou(`Venda confirmada para ${r.conta.cliente_nome}. Total: ${formatarReais(r.conta.valor_total)}`)
        }
      />

      <CompraMarcaModal
        isOpen={pedidoMarca}
        sessionToken={tk}
        onClose={() => setPedidoMarca(false)}
        onCompraRegistrada={(c) => alterou(`Pedido à ${c.marca_nome} registrado com ${c.quantidade_total_itens} itens.`)}
      />

      <ConferenciaCaixaModal
        isOpen={!!conferencia}
        compraId={conferencia?.compraId ?? null}
        sessionToken={tk}
        onClose={() => setConferencia(null)}
        onConferenciaAtualizada={() => alterou('Conferência registrada e estoque atualizado.')}
      />
      {/* Por último: o cadastro rápido abre por cima da venda ou da encomenda em andamento. */}
      <ClienteDrawer
        isOpen={drawerCliente}
        onClose={() => {
          setDrawerCliente(false);
          setAposCadastro(null);
        }}
        sessionToken={tk}
        onClienteCriado={(c: ClienteDTO) => {
          const ref = { id: c.id, nome: c.nome };
          if (aposCadastro === 'venda') setClienteNovoVenda(ref);
          if (aposCadastro === 'encomenda') setEncomendaCliente(ref);
          alterou(`Cliente ${c.nome} cadastrada.`);
        }}
      />
    </AcoesContext.Provider>
  );
}

export function useAcoes() {
  const ctx = useContext(AcoesContext);
  if (!ctx) throw new Error('useAcoes fora do AcoesProvider');
  return ctx;
}
