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
