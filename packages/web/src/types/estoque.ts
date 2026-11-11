export interface MovimentacaoEstoqueDTO {
  id: string;
  tipo: string;
  quantidade: number;
  presentes_anterior: number;
  presentes_posterior: number;
  reservados_anterior: number;
  reservados_posterior: number;
  pronta_entrega_anterior: number;
  pronta_entrega_posterior: number;
  compra_id: string | null;
  operador_id: string;
  operador_nome: string;
  detalhes: string | null;
  criado_em: string;
}

export interface EstoqueDTO {
  id: string | null;
  operacao_id: string;
  produto_id: string;
  produto_nome?: string;
  produto_variante?: string | null;
  produto_codigo_barras?: string | null;
  marca_nome?: string | null;
  presentes: number;
  reservados: number;
  pronta_entrega: number;
  aguardando_fabrica?: number;
  criado_em?: string | null;
  atualizado_em?: string | null;
  movimentacoes?: MovimentacaoEstoqueDTO[];
}
