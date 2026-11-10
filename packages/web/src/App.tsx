import { useState } from 'react';

export function App() {
  const [operadorNome] = useState('Dona Sônia');
  const [operacaoNome] = useState('Consultoria Beleza Viva');

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary flex flex-col justify-between">
      {/* Cabeçalho da Sessão Operacional */}
      <header className="bg-surface-raised border-b border-border-hairline px-4 py-3 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-title-md font-semibold text-ink-primary">ConsultoraSync</h1>
            <p className="text-meta text-ink-secondary">{operacaoNome}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-status-available"></span>
            <span className="text-label-strong text-ink-primary">{operadorNome}</span>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-md mx-auto w-full p-4 flex-1 flex flex-col gap-4">
        <div className="bg-surface-raised border border-border-hairline rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-meta text-ink-muted uppercase tracking-wide">Sessão Operacional Ativa</span>
            <span className="bg-status-available-bg text-status-available text-meta font-semibold px-3 py-1 rounded-full">
              Isolamento 100% Ativo
            </span>
          </div>
          <h2 className="text-title-lg font-bold text-ink-primary mb-1">
            Olá, {operadorNome}!
          </h2>
          <p className="text-body-md text-ink-secondary">
            O ambiente multi-inquilino está configurado com barreiras de isolamento estritas. Todos os seus dados, clientes e estoques estão protegidos por sua chave operacional única.
          </p>
        </div>

        {/* Demonstração de Design Tokens e Status */}
        <div className="bg-surface-raised border border-border-hairline rounded-lg p-5 flex flex-col gap-3">
          <h3 className="text-title-md text-ink-primary">Indicadores de Conformidade</h3>
          
          <div className="flex items-center justify-between p-3 bg-surface-sunken rounded-md">
            <span className="text-body-md text-ink-primary">Rastreabilidade Nominal</span>
            <span className="text-meta font-semibold text-brand-primary">Ativa (NFR-003)</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-sunken rounded-md">
            <span className="text-body-md text-ink-primary">Barreira Multi-inquilino</span>
            <span className="text-meta font-semibold text-status-available">Garantida (NFR-002)</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-surface-sunken rounded-md">
            <span className="text-body-md text-ink-primary">Precisão Financeira</span>
            <span className="text-meta font-semibold text-status-waiting">Centavos Inteiros</span>
          </div>
        </div>
      </main>

      {/* Barra de Ação Fixa Inferior (Mobile Friendly com 48px touch-target) */}
      <footer className="bg-surface-raised border-t border-border-hairline p-4 sticky bottom-0">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            className="w-full min-h-touch-target bg-brand-primary hover:bg-brand-hover text-ink-inverse rounded-md text-label-strong font-semibold flex items-center justify-center transition-colors shadow-sm"
          >
            Iniciar Operação
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
