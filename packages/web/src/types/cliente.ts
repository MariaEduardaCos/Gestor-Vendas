export interface ItemContaDTO {
  id: string;
  produto_id: string;
  produto_nome?: string;
  quantidade: number;
  preco_unitario_centavos: number;
  custo_unitario_centavos?: number | null;
  origem_custo?: string;
  status_entrega: string;
}

export interface ContaDTO {
  id: string;
  encomenda_id?: string | null;
  valor_total: number;
  total_pago: number;
  total_sem_aguardados?: number;
  saldo_cobravel_hoje?: number;
  status: string;
  criado_em: string;
  itens?: ItemContaDTO[];
}

export interface EncomendaDTO {
  id: string;
  descricao?: string | null;
  status: string;
  criado_em: string;
  itens?: Array<{
    id: string;
    produto_id: string;
    produto_nome?: string;
    variante?: string | null;
    quantidade: number;
    preco_unitario_centavos: number;
    status_entrega: string;
  }>;
}

export interface ClienteDTO {
  id: string;
  operacao_id: string;
  nome: string;
  telefone?: string | null;
  telefone_formatado?: string | null;
  endereco?: string | null;
  saldo_credito_centavos: number;
  criado_em: string;
  atualizado_em: string;
}

export interface ClienteFichaDTO extends ClienteDTO {
  contas: ContaDTO[];
  encomendas: EncomendaDTO[];
}
