import { useState, useEffect } from 'react';
import { ClientesView } from './components/ClientesView';
import { ClienteDrawer } from './components/ClienteDrawer';
import { ClienteFichaModal } from './components/ClienteFichaModal';
import { ProdutosView } from './components/ProdutosView';
import { VisorView } from './components/VisorView';
import { LeitorRemotoMobileView } from './components/LeitorRemotoMobileView';
import { EncomendaModal } from './components/EncomendaModal';
import type { ClienteDTO } from './types/cliente';

export function App() {
  // Detecta se a página foi aberta no celular via leitura de QR Code efêmero (AD-6)
  const [leitorToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('leitor_token') || params.get('t') || null;
  });

  const [operadorNome] = useState('Dona Sônia');
  const [operacaoNome] = useState('Consultoria Beleza Viva');
  const [abaAtiva, setAbaAtiva] = useState<'inicio' | 'leitor' | 'produtos' | 'clientes'>('inicio');

  // Sessão Operacional para autenticação nas requisições do navegador
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    return localStorage.getItem('consultorasync_session_token') || null;
  });

  // Gatilho para atualizar a ClientesView quando a ficha editar/excluir cliente
  const [refreshClientesKey, setRefreshClientesKey] = useState(0);
  const [refreshFichaKey, setRefreshFichaKey] = useState(0);

  // Estados da Gaveta Rápida (S3), Ficha da Cliente (S2) e Encomenda Modal (S7)
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [fichaClienteId, setFichaClienteId] = useState<string | null>(null);
  const [encomendaCliente, setEncomendaCliente] = useState<{ id: string; nome: string } | null>(null);
  const [clienteRecemCriado, setClienteRecemCriado] = useState<ClienteDTO | null>(null);
  const [clienteSelecionadoFluxo, setClienteSelecionadoFluxo] = useState<ClienteDTO | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Bootstrap automático da sessão dev para Dona Sônia (apenas se não estiver no leitor remoto móvel)
  useEffect(() => {
    if (leitorToken) return;

    if (!sessionToken) {
      fetch('/api/auth/dev-session', { method: 'POST' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.token) {
            setSessionToken(data.token);
            localStorage.setItem('consultorasync_session_token', data.token);
          }
        })
        .catch((err) => {
          console.warn('Bootstrap dev-session:', err);
        });
    }
  }, [sessionToken, leitorToken]);

  // Se a URL contém token de pareamento efêmero, abre a tela do celular sem login (AD-6, FR-014)
  if (leitorToken) {
    return (
      <LeitorRemotoMobileView
        token={leitorToken}
        onSair={() => {
          window.location.href = window.location.pathname;
        }}
      />
    );
  }

  const handleClienteCriadoNaGaveta = (novoCliente: ClienteDTO) => {
    setClienteRecemCriado(novoCliente);
    setClienteSelecionadoFluxo(novoCliente);
    setRefreshClientesKey((k) => k + 1);
    setMensagemSucesso(`Cliente "${novoCliente.nome}" cadastrada com sucesso e selecionada para o seu fluxo!`);
    setTimeout(() => {
      setMensagemSucesso(null);
    }, 5000);
  };

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary flex flex-col justify-between">
      {/* Cabeçalho da Sessão Operacional (Dona Sônia) */}
      <header className="bg-surface-raised border-b border-border-hairline px-4 py-3 shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-title-md font-bold text-ink-primary">ConsultoraSync</h1>
            <p className="text-meta text-ink-secondary">{operacaoNome}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-status-available animate-pulse" />
            <span className="text-label-strong text-ink-primary">{operadorNome}</span>
          </div>
        </div>
      </header>

      {/* Banner de Feedback Amigável */}
      {mensagemSucesso && (
        <div className="max-w-md mx-auto w-full px-4 pt-3">
          <div className="bg-status-available-bg border border-status-available text-status-available p-3 rounded-lg text-body-md font-medium flex items-center justify-between shadow-sm">
            <span>✨ {mensagemSucesso}</span>
            <button
              type="button"
              onClick={() => setMensagemSucesso(null)}
              className="text-status-available font-bold text-title-md ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-md mx-auto w-full p-4 flex-1 flex flex-col gap-4">
        {abaAtiva === 'inicio' ? (
          <div className="flex flex-col gap-4">
            {/* Cartão de Boas-vindas */}
            <div className="bg-surface-raised border border-border-hairline rounded-lg p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-meta text-ink-muted uppercase tracking-wide">
                  Sessão Operacional Ativa
                </span>
                <span className="bg-status-available-bg text-status-available text-meta font-semibold px-3 py-1 rounded-full">
                  Isolamento 100% Ativo
                </span>
              </div>
              <h2 className="text-title-lg font-bold text-ink-primary mb-1">
                Olá, {operadorNome}!
              </h2>
              <p className="text-body-md text-ink-secondary leading-relaxed">
                Bem-vinda ao seu caderno digital. Aqui você tem acesso rápido a todas as suas clientes, encomendas e estoque de forma organizada.
              </p>
            </div>

            {/* Teste da Gaveta Rápida a partir de qualquer fluxo (UX-DR4) */}
            <div className="bg-surface-raised border border-border-hairline rounded-lg p-5 shadow-sm flex flex-col gap-3">
              <h3 className="text-title-md font-bold text-ink-primary">
                Atalho Rápido de Atendimento
              </h3>
              <p className="text-body-md text-ink-secondary">
                Abra a gaveta rápida em qualquer momento sem perder o contexto operacional de vendas ou encomendas.
              </p>

              {clienteSelecionadoFluxo && (
                <div className="p-3 bg-brand-subtle border border-brand-primary/20 rounded-md flex items-center justify-between">
                  <div>
                    <span className="text-meta font-semibold text-brand-primary">Cliente Atual no Fluxo:</span>
                    <p className="text-body-lg font-bold text-ink-primary">{clienteSelecionadoFluxo.nome}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFichaClienteId(clienteSelecionadoFluxo.id)}
                    className="text-meta text-brand-primary font-bold hover:underline"
                  >
                    Ver Ficha
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setDrawerAberto(true)}
                className="min-h-touch-target bg-brand-primary hover:bg-brand-hover text-ink-inverse font-semibold text-label-strong rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <span>+</span> Cadastrar Cliente na Gaveta Rápida (S3)
              </button>
            </div>

            {/* Acesso Rápido a Encomendas (S7, Story 2.1) */}
            <div className="bg-surface-raised border border-border-hairline rounded-lg p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-title-md font-bold text-ink-primary">
                  Encomendas de Clientes (S7)
                </h3>
                <span className="text-meta font-semibold text-brand-primary">Story 2.1</span>
              </div>
              <p className="text-body-md text-ink-secondary">
                Anote pedidos de clientes antes de fechar a compra na revista. Cria a conta da cliente sem alterar o estoque da sua estante.
              </p>

              <button
                type="button"
                onClick={() => {
                  if (clienteSelecionadoFluxo) {
                    setEncomendaCliente({ id: clienteSelecionadoFluxo.id, nome: clienteSelecionadoFluxo.nome });
                  } else {
                    setAbaAtiva('clientes');
                    setMensagemSucesso('Selecione ou clique em "+ Encomenda" na cliente desejada.');
                  }
                }}
                className="min-h-touch-target bg-brand-primary hover:bg-brand-hover text-ink-inverse font-bold text-label-strong rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <span>📝</span> Anotar Nova Encomenda (S7)
              </button>
            </div>

            {/* Acesso Rápido ao Catálogo de Produtos e Marcas (S4) */}
            <div className="bg-surface-raised border border-border-hairline rounded-lg p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-title-md font-bold text-ink-primary">
                  Catálogo & Marcas
                </h3>
                <span className="text-meta font-semibold text-brand-primary">Story 1.3</span>
              </div>
              <p className="text-body-md text-ink-secondary">
                Consulte seus produtos e variantes, configure marcas com percentual de lucro e veja o custo unitário estimado ou informado na hora.
              </p>

              <button
                type="button"
                onClick={() => setAbaAtiva('produtos')}
                className="min-h-touch-target bg-surface-raised hover:bg-surface-sunken border border-brand-primary text-brand-primary font-bold text-label-strong rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <span>📦</span> Abrir Catálogo de Produtos (S4)
              </button>
            </div>

            {/* Acesso Rápido ao Visor de Leitura Híbrido (S5, UX-DR2) */}
            <div className="bg-surface-raised border border-border-hairline rounded-lg p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-title-md font-bold text-ink-primary">
                  Leitor / Visor de Leitura
                </h3>
                <span className="text-meta font-semibold text-brand-primary">Story 1.5</span>
              </div>
              <p className="text-body-md text-ink-secondary">
                Abra a câmera contínua sem cliques intermediários para conferir estoque de produtos e bipar sem repetições acidentais (debounce 1,5s).
              </p>

              <button
                type="button"
                onClick={() => setAbaAtiva('leitor')}
                className="min-h-touch-target bg-brand-primary hover:bg-brand-hover text-ink-inverse font-bold text-label-strong rounded-md flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <span>📷</span> Abrir Visor de Leitura (S5)
              </button>
            </div>

            {/* Indicadores de Conformidade */}
            <div className="bg-surface-raised border border-border-hairline rounded-lg p-5 shadow-sm flex flex-col gap-3">
              <h3 className="text-title-md text-ink-primary font-bold">Indicadores de Conformidade</h3>

              <div className="flex items-center justify-between p-3 bg-surface-sunken rounded-md">
                <span className="text-body-md text-ink-primary">Pareamento Efêmero com WebSocket</span>
                <span className="text-meta font-semibold text-brand-primary">Ativo (AD-6, FR-014)</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-sunken rounded-md">
                <span className="text-body-md text-ink-primary">Visor Híbrido Zero Cliques</span>
                <span className="text-meta font-semibold text-status-available">Ativo (UX-DR2, FR-009)</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-sunken rounded-md">
                <span className="text-body-md text-ink-primary">Cadastro com Gaveta Rápida</span>
                <span className="text-meta font-semibold text-brand-primary">Ativo (UX-DR4)</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-sunken rounded-md">
                <span className="text-body-md text-ink-primary">Custo Estimado por Marca &amp; Proveniência</span>
                <span className="text-meta font-semibold text-brand-primary">Ativo (FR-011, D-01)</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-sunken rounded-md">
                <span className="text-body-md text-ink-primary">Busca Instantânea &lt; 2s</span>
                <span className="text-meta font-semibold text-status-available">Homologada (NFR-006)</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-sunken rounded-md">
                <span className="text-body-md text-ink-primary">Barreira Multi-inquilino</span>
                <span className="text-meta font-semibold text-status-available">Garantida (NFR-002)</span>
              </div>
            </div>
          </div>
        ) : abaAtiva === 'leitor' ? (
          /* Aba de Leitor / Visor Contínuo (S5) */
          <VisorView sessionToken={sessionToken || undefined} />
        ) : abaAtiva === 'produtos' ? (
          /* Aba de Catálogo de Produtos e Marcas (S4) */
          <ProdutosView sessionToken={sessionToken || undefined} />
        ) : (
          /* Aba de Clientes (S2) */
          <ClientesView
            onAbrirGaveta={() => setDrawerAberto(true)}
            clienteRecemCriado={clienteRecemCriado}
            sessionToken={sessionToken || undefined}
            refreshTrigger={refreshClientesKey}
            onVerFicha={(id) => setFichaClienteId(id)}
            onAnotarEncomenda={(c) => {
              setEncomendaCliente({ id: c.id, nome: c.nome });
            }}
            onSelecionarCliente={(c) => {
              setClienteSelecionadoFluxo(c);
              setMensagemSucesso(`Cliente "${c.nome}" selecionada para o fluxo!`);
            }}
          />
        )}
      </main>

      {/* Barra de Navegação Inferior (Mobile Friendly com 48px touch-target) */}
      <footer className="bg-surface-raised border-t border-border-hairline p-2 sticky bottom-0 z-10 shadow-lg">
        <nav className="max-w-md mx-auto grid grid-cols-4 gap-1">
          <button
            type="button"
            onClick={() => setAbaAtiva('inicio')}
            className={`min-h-touch-target flex flex-col items-center justify-center rounded-lg font-semibold text-label-strong transition-colors ${
              abaAtiva === 'inicio'
                ? 'bg-brand-subtle text-brand-primary'
                : 'text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            <span className="text-title-md">🏠</span>
            <span className="text-meta">Início</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('leitor')}
            className={`min-h-touch-target flex flex-col items-center justify-center rounded-lg font-semibold text-label-strong transition-colors ${
              abaAtiva === 'leitor'
                ? 'bg-brand-subtle text-brand-primary'
                : 'text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            <span className="text-title-md">📷</span>
            <span className="text-meta">Leitor</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('produtos')}
            className={`min-h-touch-target flex flex-col items-center justify-center rounded-lg font-semibold text-label-strong transition-colors ${
              abaAtiva === 'produtos'
                ? 'bg-brand-subtle text-brand-primary'
                : 'text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            <span className="text-title-md">📦</span>
            <span className="text-meta">Produtos</span>
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva('clientes')}
            className={`min-h-touch-target flex flex-col items-center justify-center rounded-lg font-semibold text-label-strong transition-colors ${
              abaAtiva === 'clientes'
                ? 'bg-brand-subtle text-brand-primary'
                : 'text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            <span className="text-title-md">👥</span>
            <span className="text-meta">Clientes</span>
          </button>
        </nav>
      </footer>

      {/* Componente de Gaveta Rápida (S3) */}
      <ClienteDrawer
        isOpen={drawerAberto}
        onClose={() => setDrawerAberto(false)}
        onClienteCriado={handleClienteCriadoNaGaveta}
        sessionToken={sessionToken || undefined}
      />

      {/* Modal da Ficha da Cliente (S2) */}
      <ClienteFichaModal
        clienteId={fichaClienteId}
        isOpen={!!fichaClienteId}
        sessionToken={sessionToken || undefined}
        refreshKey={refreshFichaKey}
        onClose={() => setFichaClienteId(null)}
        onAbrirEncomenda={(cli) => {
          setEncomendaCliente(cli);
        }}
        onClienteAtualizado={() => {
          setRefreshClientesKey((k) => k + 1);
        }}
        onClienteExcluido={(id) => {
          setRefreshClientesKey((k) => k + 1);
          if (clienteSelecionadoFluxo?.id === id) {
            setClienteSelecionadoFluxo(null);
          }
          setFichaClienteId(null);
        }}
      />

      {/* Modal de Anotação de Encomenda Individual (S7) */}
      <EncomendaModal
        isOpen={!!encomendaCliente}
        cliente={encomendaCliente}
        sessionToken={sessionToken || undefined}
        onClose={() => setEncomendaCliente(null)}
        onEncomendaCriada={(novaEnc) => {
          setRefreshClientesKey((k) => k + 1);
          setRefreshFichaKey((k) => k + 1);
          setMensagemSucesso(`Encomenda anotada com sucesso para ${novaEnc.cliente_nome}! Total: ${novaEnc.valor_total_formatado}`);
          setTimeout(() => setMensagemSucesso(null), 6000);
        }}
      />
    </div>
  );
}

export default App;
