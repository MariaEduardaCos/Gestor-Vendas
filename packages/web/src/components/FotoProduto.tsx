/** Miniatura da foto do produto; sem foto, um quadro neutro do mesmo tamanho para a lista não "pular". */
export function FotoProduto({ url, tamanho = 'md' }: { url?: string | null; tamanho?: 'sm' | 'md' }) {
  const lado = tamanho === 'sm' ? 'w-10 h-10' : 'w-12 h-12';
  if (!url) {
    return <div aria-hidden className={`${lado} rounded-md bg-surface-sunken border border-border-hairline shrink-0`} />;
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={`${lado} rounded-md object-contain bg-white border border-border-hairline shrink-0`}
    />
  );
}
