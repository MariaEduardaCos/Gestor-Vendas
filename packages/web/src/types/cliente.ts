export interface ContaDTO {
  id: string;
  valor_total: number;
  total_pago: number;
  status: string;
  criado_em: string;
}

export interface EncomendaDTO {
  id: string;
  descricao?: string | null;
  status: string;
  criado_em: string;
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
