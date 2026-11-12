// Formatos das listagens usadas pelas páginas de gestão.

/** GET /api/vendas — todas as contas (vendas e encomendas) com itens. */
export interface ContaListagem {
  id: string;
  cliente_id: string;
  encomenda_id: string | null;
  valor_total: number;
  total_pago: number;
  status: 'ABERTA' | 'PARCIALMENTE_PAGA' | 'QUITADA' | string;
  status_entrega: string;
  criado_em: string;
  cliente: { id: string; nome: string; telefone: string | null };
  itens: Array<{
    id: string;
    quantidade: number;
    preco_unitario_centavos: number;
    status_entrega: string;
    produto: { id: string; nome: string; variante: string | null; codigo_barras: string | null };
  }>;
}

/** GET /api/encomendas */
export interface EncomendaListagem {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  descricao: string | null;
  status: string;
  quantidade_total_itens: number;
  valor_total_centavos: number;
  criado_em: string;
  conta: { id: string; valor_total: number; total_pago: number; saldo_cobravel_hoje_centavos: number; status: string } | null;
  itens: Array<{ id: string; produto_nome: string; variante: string | null; quantidade: number; status_entrega: string }>;
}

/** GET /api/compras-marca */
export interface CompraListagem {
  id: string;
  marca_nome: string;
  numero_pedido: string | null;
  observacoes: string | null;
  status: string;
  data_pedido: string;
  quantidade_total_itens: number;
  quantidade_itens_clientes: number;
  quantidade_itens_pronta_entrega: number;
  custo_total_centavos: number;
}

/** GET /api/estoque */
export interface EstoqueLinha {
  id: string;
  produto_id: string;
  produto_nome: string;
  produto_variante: string | null;
  produto_codigo_barras: string | null;
  marca_nome: string | null;
  presentes: number;
  reservados: number;
  pronta_entrega: number;
  aguardando_fabrica: number;
}

/** GET /api/relatorios/resumo-financeiro */
export interface ResumoFinanceiro {
  total_vendido_centavos: number;
  total_recebido_bruto_centavos: number;
  total_taxas_cartao_centavos: number;
  total_recebido_liquido_centavos: number;
  total_a_receber_centavos: number;
  total_devolvido_centavos: number;
  total_creditos_ativos_centavos: number;
}

export const saldoConta = (c: Pick<ContaListagem, 'valor_total' | 'total_pago'>) => Math.max(0, c.valor_total - c.total_pago);

export function resumoItens(itens: Array<{ quantidade: number; produto?: { nome: string }; produto_nome?: string }>): string {
  const nomes = itens.map((i) => `${i.quantidade}× ${i.produto?.nome ?? i.produto_nome ?? ''}`);
  return nomes.length <= 2 ? nomes.join(', ') : `${nomes.slice(0, 2).join(', ')} e mais ${nomes.length - 2}`;
}
