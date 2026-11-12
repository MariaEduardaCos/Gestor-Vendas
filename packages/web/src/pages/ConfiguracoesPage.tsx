import { useNavigate } from 'react-router-dom';
import { useSessao } from '../app/SessaoContext';
import { Botao, CabecalhoPagina, Cartao } from '../layout/ui';

export function ConfiguracoesPage() {
  const { sessao } = useSessao();
  const navegar = useNavigate();

  return (
    <>
      <CabecalhoPagina titulo="Configurações" />
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Cartao className="p-5 flex flex-col gap-3">
          <h3 className="text-title-md font-bold">Marcas, comissões e catálogos</h3>
          <p className="text-body-md text-ink-secondary">Escolha as marcas que você vende, ajuste a comissão de cada uma e carregue o catálogo do ciclo.</p>
          <div>
            <Botao variante="secundario" onClick={() => navegar('/marcas')}>Abrir marcas e catálogos</Botao>
          </div>
        </Cartao>

        <Cartao className="p-5">
          <h3 className="text-title-md font-bold mb-3">Sessão</h3>
          <dl className="text-body-md flex flex-col gap-2">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-secondary">Pessoa conectada</dt>
              <dd className="font-semibold">{sessao?.operador_nome ?? '—'}</dd>
            </div>
          </dl>
          <p className="text-meta text-ink-muted mt-4">
            Ambiente de desenvolvimento: o acesso entra automaticamente com a conta de demonstração. O login por pessoa (revendedora, ajudante e contratada) é a próxima etapa.
          </p>
        </Cartao>
      </div>
    </>
  );
}
