import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessao } from '../app/SessaoContext';
import { useAcoes } from '../app/AcoesContext';
import { apiFetch, baixarArquivo } from '../lib/api';
import { useInstalacaoApp } from '../lib/pwa';
import { Botao, CabecalhoPagina, Cartao } from '../layout/ui';

const classeCampo =
  'w-full min-h-touch-target px-3 rounded-md border border-border-strong bg-surface-base text-body-md focus:outline-none focus:ring-2 focus:ring-brand-primary';

const somenteNumeros = (v: string) => v.replace(/\D/g, '').slice(0, 8);

/** Usuário e PIN de quem está conectada. Quem já tem PIN confirma o atual antes de mudar. */
function CartaoAcesso() {
  const { sessao, token, atualizarSessao, sair } = useSessao();
  const { avisar } = useAcoes();
  const possuiPin = !!sessao?.possui_pin;
  const [usuario, setUsuario] = useState(sessao?.usuario ?? '');
  const [pinAtual, setPinAtual] = useState('');
  const [pinNovo, setPinNovo] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => setUsuario(sessao?.usuario ?? ''), [sessao?.usuario]);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (pinNovo && pinNovo !== confirma) {
      setErro('Os dois PINs novos não são iguais.');
      return;
    }
    setSalvando(true);
    try {
      await apiFetch('/auth/acesso', token, {
        method: 'PUT',
        body: JSON.stringify({ usuario: usuario.trim().toLowerCase(), pin_atual: pinAtual || undefined, pin_novo: pinNovo || undefined })
      });
      try {
        localStorage.setItem('consultorasync_ultimo_usuario', usuario.trim().toLowerCase());
      } catch {
        /* sem armazenamento */
      }
      setPinAtual('');
      setPinNovo('');
      setConfirma('');
      atualizarSessao();
      avisar('Acesso atualizado.');
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Cartao className="p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-title-md font-bold">Acesso</h3>
          <p className="text-body-md text-ink-secondary">
            Conectada como <strong>{sessao?.operador_nome ?? '—'}</strong>
          </p>
        </div>
        <Botao variante="secundario" onClick={sair}>Sair</Botao>
      </div>

      {!possuiPin && (
        <p className="p-2 rounded-md bg-status-danger-bg text-status-danger text-meta">
          Esta conta ainda não tem PIN. Defina um usuário e um PIN para conseguir entrar fora do modo de demonstração.
        </p>
      )}

      <form onSubmit={salvar} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-label-strong">Usuário</span>
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))}
            autoComplete="username"
            autoCapitalize="none"
            required
            minLength={3}
            className={classeCampo}
          />
        </label>
        {possuiPin && (
          <label className="flex flex-col gap-1">
            <span className="text-label-strong">PIN atual</span>
            <input
              value={pinAtual}
              onChange={(e) => setPinAtual(somenteNumeros(e.target.value))}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              required
              className={`${classeCampo} tracking-[0.4em] placeholder:tracking-normal`}
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-label-strong">{possuiPin ? 'Novo PIN' : 'PIN'}</span>
            <input
              value={pinNovo}
              onChange={(e) => setPinNovo(somenteNumeros(e.target.value))}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              required={!possuiPin}
              minLength={4}
              placeholder={possuiPin ? 'vazio = manter' : ''}
              className={`${classeCampo} tracking-[0.4em] placeholder:tracking-normal`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label-strong">Repita o PIN</span>
            <input
              value={confirma}
              onChange={(e) => setConfirma(somenteNumeros(e.target.value))}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              required={!!pinNovo}
              className={`${classeCampo} tracking-[0.4em] placeholder:tracking-normal`}
            />
          </label>
        </div>
        <p className="text-meta text-ink-muted">O PIN tem de 4 a 8 números. Depois de 5 tentativas erradas, o acesso fica bloqueado por 15 minutos.</p>
        {erro && (
          <p role="alert" className="p-2 rounded-md bg-status-danger-bg text-status-danger text-meta">
            {erro}
          </p>
        )}
        <div>
          <Botao type="submit">{salvando ? 'Salvando…' : 'Salvar acesso'}</Botao>
        </div>
      </form>
    </Cartao>
  );
}

const EXPORTACOES = [
  { tipo: 'clientes', rotulo: 'Clientes', dica: 'Contatos, compras, em aberto e crédito' },
  { tipo: 'contas', rotulo: 'Contas a receber', dica: 'Saldo, situação, vencimentos e atraso' },
  { tipo: 'vendas', rotulo: 'Itens vendidos', dica: 'Cada produto vendido, com preço e situação' },
  { tipo: 'pagamentos', rotulo: 'Pagamentos', dica: 'Recebimentos, taxas e estornos' },
  { tipo: 'estoque', rotulo: 'Estoque e produtos', dica: 'Preço, custo e quantidades' }
];

/** Planilhas para o Excel e cópia completa dos dados (NFR-009). */
function CartaoExportacao() {
  const { token } = useSessao();
  const { avisar } = useAcoes();
  const [baixando, setBaixando] = useState<string | null>(null);

  const baixar = async (caminho: string) => {
    setBaixando(caminho);
    try {
      const nome = await baixarArquivo(caminho, token);
      avisar(`Arquivo ${nome} baixado.`);
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setBaixando(null);
    }
  };

  return (
    <Cartao className="p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-title-md font-bold">Exportar dados</h3>
        <p className="text-body-md text-ink-secondary">Planilhas que abrem direto no Excel ou no Planilhas Google.</p>
      </div>
      <ul className="flex flex-col divide-y divide-border-hairline">
        {EXPORTACOES.map((e) => {
          const caminho = `/exportar/${e.tipo}.csv`;
          return (
            <li key={e.tipo} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block text-label-strong">{e.rotulo}</span>
                <span className="block text-meta text-ink-muted">{e.dica}</span>
              </span>
              <button
                type="button"
                onClick={() => baixar(caminho)}
                disabled={baixando !== null}
                className="shrink-0 min-h-[40px] px-3 rounded-md border border-border-strong text-label-strong hover:bg-surface-sunken disabled:opacity-60"
              >
                {baixando === caminho ? 'Baixando…' : 'Baixar CSV'}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="pt-3 border-t border-border-hairline flex flex-col gap-2">
        <p className="text-label-strong">Cópia de segurança</p>
        <p className="text-meta text-ink-muted">
          Arquivo com todos os dados da sua revenda (clientes, vendas, pagamentos, estoque, pedidos e histórico). Guarde em um lugar seguro: ele tem dados pessoais das clientes.
        </p>
        <div>
          <Botao variante="secundario" onClick={() => baixar('/exportar/copia.json')}>
            {baixando === '/exportar/copia.json' ? 'Gerando…' : 'Baixar cópia completa'}
          </Botao>
        </div>
      </div>
    </Cartao>
  );
}

/** Instalar o sistema como app no celular ou no computador (PWA). */
function CartaoInstalar() {
  const { situacao, instalar } = useInstalacaoApp();
  const { avisar } = useAcoes();

  return (
    <Cartao className="p-5 flex flex-col gap-3">
      <div>
        <h3 className="text-title-md font-bold">App no celular</h3>
        <p className="text-body-md text-ink-secondary">
          Instale o ConsultoraSync para abrir pelo ícone na tela inicial, em tela cheia, como um aplicativo. Sem internet, ele mostra os últimos dados que você viu.
        </p>
      </div>
      {situacao === 'instalado' && (
        <p className="p-2 rounded-md bg-status-available-bg text-status-available text-meta font-semibold">Você está usando o app instalado.</p>
      )}
      {situacao === 'disponivel' && (
        <div>
          <Botao
            onClick={async () => {
              if (await instalar()) avisar('App instalado. Procure o ícone na tela inicial.');
            }}
          >
            Instalar app
          </Botao>
        </div>
      )}
      {situacao === 'ios' && (
        <ol className="list-decimal pl-5 text-body-md text-ink-secondary flex flex-col gap-1">
          <li>Abra este endereço no Safari.</li>
          <li>Toque em <strong>Compartilhar</strong> (o quadrado com a seta para cima).</li>
          <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
        </ol>
      )}
      {situacao === 'indisponivel' && (
        <p className="text-meta text-ink-muted">
          No celular Android, abra no Chrome e use o menu <strong>⋮ → Instalar app</strong>. No computador, procure o ícone de instalar na barra de endereço. O endereço precisa ser seguro (https).
        </p>
      )}
    </Cartao>
  );
}

export function ConfiguracoesPage() {
  const navegar = useNavigate();

  return (
    <>
      <CabecalhoPagina titulo="Configurações" />
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <CartaoAcesso />

        <Cartao className="p-5 flex flex-col gap-3">
          <h3 className="text-title-md font-bold">Marcas, comissões e catálogos</h3>
          <p className="text-body-md text-ink-secondary">Escolha as marcas que você vende, ajuste a comissão de cada uma e carregue o catálogo do ciclo.</p>
          <div>
            <Botao variante="secundario" onClick={() => navegar('/marcas')}>Abrir marcas e catálogos</Botao>
          </div>
        </Cartao>

        <CartaoInstalar />

        <CartaoExportacao />
      </div>
    </>
  );
}
