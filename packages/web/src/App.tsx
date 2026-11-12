import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessaoProvider } from './app/SessaoContext';
import { AcoesProvider } from './app/AcoesContext';
import { AppShell } from './layout/AppShell';
import { LeitorRemotoMobileView } from './components/LeitorRemotoMobileView';
import { HojePage } from './pages/HojePage';
import { ClientesPage } from './pages/ClientesPage';
import { EncomendasPage } from './pages/EncomendasPage';
import { ContasPage } from './pages/ContasPage';
import { PedidosPage } from './pages/PedidosPage';
import { EstoquePage } from './pages/EstoquePage';
import { VendasPage } from './pages/VendasPage';
import { FinanceiroPage } from './pages/FinanceiroPage';
import { LeitorPage } from './pages/LeitorPage';
import { ConfiguracoesPage } from './pages/ConfiguracoesPage';
import { MarcasPage } from './pages/marcas/MarcasPage';

function tokenLeitorRemoto(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('leitor_token') || params.get('t');
}

export function App() {
  // Celular aberto pelo QR Code de pareamento: tela leve de leitor, sem login.
  const leitorToken = tokenLeitorRemoto();
  if (leitorToken) {
    return <LeitorRemotoMobileView token={leitorToken} onSair={() => (window.location.href = window.location.pathname)} />;
  }

  return (
    <SessaoProvider>
      <AcoesProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<HojePage />} />
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="encomendas" element={<EncomendasPage />} />
              <Route path="contas" element={<ContasPage />} />
              <Route path="pedidos" element={<PedidosPage />} />
              <Route path="estoque" element={<EstoquePage />} />
              <Route path="marcas" element={<MarcasPage />} />
              <Route path="vendas" element={<VendasPage />} />
              <Route path="financeiro" element={<FinanceiroPage />} />
              <Route path="leitor" element={<LeitorPage />} />
              <Route path="configuracoes" element={<ConfiguracoesPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AcoesProvider>
    </SessaoProvider>
  );
}

export default App;
