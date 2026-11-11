export interface ItemEncomendaDTO {
  id: string;
  produto_id: string;
  produto_nome?: string;
  variante?: string | null;
  quantidade: number;
  preco_unitario_centavos: number;
  preco_unitario_formatado?: string;
  custo_unitario_centavos?: number | null;
  origem_custo?: string;
  status_entrega: string;
  subtotal_centavos?: number;
  subtotal_formatado?: string;
}

export interface EncomendaDTO {
  id: string;
  operacao_id: string;
  cliente_id: string;
  cliente_nome?: string;
  cliente_telefone?: string | null;
  descricao?: string | null;
  status: string;
  quantidade_total_itens?: number;
  valor_total_centavos?: number;
  valor_total_formatado?: string;
  criado_em: string;
  conta?: {
    id: string;
    valor_total: number;
    total_pago: number;
    saldo_cobravel_hoje_centavos?: number;
    status: string;
  } | null;
  itens: ItemEncomendaDTO[];
}
