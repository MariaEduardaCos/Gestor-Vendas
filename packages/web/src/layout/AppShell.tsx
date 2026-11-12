import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icone, type NomeIcone } from './Icone';
import { useSessao } from '../app/SessaoContext';
import { useAcoes } from '../app/AcoesContext';

interface ItemMenu {
  para: string;
  rotulo: string;
  icone: NomeIcone;
}

const GRUPOS: { titulo: string; itens: ItemMenu[] }[] = [
  {
    titulo: 'Dia a dia',
    itens: [
      { para: '/', rotulo: 'Hoje', icone: 'hoje' },
      { para: '/vendas', rotulo: 'Vendas e entregas', icone: 'vendas' },
      { para: '/leitor', rotulo: 'Leitor de código', icone: 'leitor' }
    ]
  },
  {
    titulo: 'Clientes',
    itens: [
      { para: '/clientes', rotulo: 'Clientes', icone: 'clientes' },
      { para: '/encomendas', rotulo: 'Encomendas', icone: 'encomendas' },
      { para: '/contas', rotulo: 'Contas a receber', icone: 'contas' }
    ]
  },
  {
    titulo: 'Mercadorias',
    itens: [
      { para: '/pedidos', rotulo: 'Pedidos às marcas', icone: 'pedidos' },
      { para: '/marcas', rotulo: 'Marcas e catálogos', icone: 'marcas' },
      { para: '/estoque', rotulo: 'Estoque e produtos', icone: 'estoque' }
    ]
  },
  {
    titulo: 'Gestão',
    itens: [
      { para: '/financeiro', rotulo: 'Financeiro', icone: 'financeiro' },
      { para: '/configuracoes', rotulo: 'Configurações', icone: 'config' }
    ]
  }
];

const TODOS = GRUPOS.flatMap((g) => g.itens);

// Barra inferior do celular: tarefas de balcão mais frequentes.
const BARRA_CELULAR: ItemMenu[] = [
  { para: '/', rotulo: 'Hoje', icone: 'hoje' },
  { para: '/clientes', rotulo: 'Clientes', icone: 'clientes' },
  { para: '/estoque', rotulo: 'Estoque', icone: 'estoque' }
];

function classeLink(ativo: boolean) {
  return `flex items-center gap-3 px-3 min-h-[44px] rounded-md text-label-strong transition-colors ${
    ativo ? 'bg-brand-subtle text-brand-primary' : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink-primary'
  }`;
}

export function AppShell() {
  const { sessao } = useSessao();
  const acoes = useAcoes();
  const { pathname } = useLocation();
  const [menuMaisAberto, setMenuMaisAberto] = useState(false);

  const paginaAtual = TODOS.find((i) => (i.para === '/' ? pathname === '/' : pathname.startsWith(i.para)));
  const nomeOperador = sessao?.operador_nome ?? '…';

  return (
    <div className="min-h-screen bg-surface-base text-ink-primary lg:flex">
      {/* Menu lateral — computador */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 h-screen sticky top-0 bg-surface-raised border-r border-border-hairline">
        <div className="px-5 py-5 border-b border-border-hairline">
          <p className="text-title-md font-bold text-brand-primary">ConsultoraSync</p>
          <p className="text-meta text-ink-secondary">Gestão de revenda</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5" aria-label="Menu principal">
          {GRUPOS.map((g) => (
            <div key={g.titulo}>
              <p className="px-3 mb-1 text-meta uppercase tracking-wide text-ink-muted">{g.titulo}</p>
              <div className="flex flex-col gap-0.5">
                {g.itens.map((i) => (
                  <NavLink key={i.para} to={i.para} end={i.para === '/'} className={({ isActive }) => classeLink(isActive)}>
                    <Icone nome={i.icone} />
                    {i.rotulo}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-border-hairline">
          <p className="text-meta text-ink-muted">Conectada como</p>
          <p className="text-label-strong">{nomeOperador}</p>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-20 bg-surface-raised/95 backdrop-blur border-b border-border-hairline">
          <div className="px-4 lg:px-8 h-14 flex items-center gap-3">
            <p className="text-title-md font-bold flex-1 truncate">
              <span className="lg:hidden text-brand-primary">ConsultoraSync</span>
              <span className="hidden lg:inline text-ink-secondary">{paginaAtual?.rotulo}</span>
            </p>
            <div className="hidden sm:flex items-center gap-2">
              <button type="button" onClick={() => acoes.novaEncomenda()} className="min-h-[40px] px-3 rounded-md border border-border-strong text-label-strong hover:bg-surface-sunken">
                + Encomenda
              </button>
              <button type="button" onClick={() => acoes.novaVenda()} className="min-h-[40px] px-4 rounded-md bg-brand-primary hover:bg-brand-hover text-ink-inverse text-label-strong">
                + Venda
              </button>
            </div>
            <span className="lg:hidden text-meta text-ink-secondary truncate max-w-[40%]">{nomeOperador}</span>
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 lg:px-8 py-5 lg:py-8 pb-28 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior — celular */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-raised border-t border-border-hairline grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegação"
      >
        {BARRA_CELULAR.slice(0, 2).map((i) => (
          <ItemBarra key={i.para} item={i} />
        ))}
        <button
          type="button"
          onClick={() => acoes.novaVenda()}
          className="flex flex-col items-center justify-center gap-0.5 min-h-[60px] text-meta font-semibold text-brand-primary"
        >
          <span className="w-11 h-11 -mt-5 rounded-full bg-brand-primary text-ink-inverse flex items-center justify-center shadow-lg">
            <Icone nome="mais_sinal" className="w-6 h-6" />
          </span>
          Vender
        </button>
        <ItemBarra item={BARRA_CELULAR[2]} />
        <button
          type="button"
          onClick={() => setMenuMaisAberto(true)}
          className="flex flex-col items-center justify-center gap-0.5 min-h-[60px] text-meta font-semibold text-ink-secondary"
        >
          <Icone nome="mais" />
          Mais
        </button>
      </nav>

      {menuMaisAberto && (
        <div className="lg:hidden fixed inset-0 z-40 bg-ink-primary/50 flex items-end" onClick={() => setMenuMaisAberto(false)}>
          <div className="w-full bg-surface-raised rounded-t-2xl p-4 pb-8 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button type="button" onClick={() => { setMenuMaisAberto(false); acoes.novaEncomenda(); }} className="min-h-touch-target rounded-md border border-border-strong font-semibold">
                + Encomenda
              </button>
              <button type="button" onClick={() => { setMenuMaisAberto(false); acoes.novaCliente(); }} className="min-h-touch-target rounded-md border border-border-strong font-semibold">
                + Cliente
              </button>
            </div>
            {GRUPOS.map((g) => (
              <div key={g.titulo} className="mb-3">
                <p className="px-3 mb-1 text-meta uppercase tracking-wide text-ink-muted">{g.titulo}</p>
                {g.itens.map((i) => (
                  <NavLink key={i.para} to={i.para} end={i.para === '/'} onClick={() => setMenuMaisAberto(false)} className={({ isActive }) => classeLink(isActive)}>
                    <Icone nome={i.icone} />
                    {i.rotulo}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemBarra({ item }: { item: ItemMenu }) {
  return (
    <NavLink
      to={item.para}
      end={item.para === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-0.5 min-h-[60px] text-meta font-semibold ${isActive ? 'text-brand-primary' : 'text-ink-secondary'}`
      }
    >
      <Icone nome={item.icone} />
      {item.rotulo}
    </NavLink>
  );
}
