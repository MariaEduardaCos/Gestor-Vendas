export interface MarcaDTO {
  id: string;
  operacao_id: string;
  nome: string;
  percentual_padrao: number | null;
  criado_em: string;
  atualizado_em: string;
}

export type ProvenienciaCusto = 'INFORMADO_MANUAL' | 'ESTIMADO_PERCENTUAL' | 'DESCONHECIDO';

export interface ProdutoDTO {
  id: string;
  operacao_id: string;
  marca_id: string | null;
  marca_nome: string | null;
  nome: string;
  variante: string | null;
  codigo_barras: string | null;
  /** Código impresso na revista do ciclo (3 a 7 números). */
  codigo_revista?: string | null;
  /** Ciclo do catálogo em que o produto apareceu por último. */
  ciclo_catalogo?: string | null;
  /** Veio de um catálogo anterior e não apareceu no último carregado da marca. */
  fora_do_ciclo?: boolean;
  preco_venda_centavos: number;
  preco_venda_formatado: string;
  custo_centavos: number | null;
  custo_formatado: string;
  proveniencia_custo: ProvenienciaCusto;
  estoque?: {
    presentes: number;
    reservados: number;
    pronta_entrega: number;
  };
  criado_em: string;
  atualizado_em: string;
}
