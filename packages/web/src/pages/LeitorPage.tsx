import { useSessao } from '../app/SessaoContext';
import { CabecalhoPagina } from '../layout/ui';
import { VisorView } from '../components/VisorView';

export function LeitorPage() {
  const { token } = useSessao();
  return (
    <>
      <CabecalhoPagina
        titulo="Leitor de código"
        descricao="Use a câmera deste aparelho ou pareie o celular para bipar produtos e ver preço e estoque na hora."
      />
      <div className="max-w-2xl">
        <VisorView sessionToken={token ?? undefined} />
      </div>
    </>
  );
}
