/**
 * Trava a linha de estoque do produto até o fim da transação (SELECT ... FOR UPDATE no PostgreSQL).
 * Chame dentro de uma transação, antes de ler o saldo: duas vendas simultâneas da última unidade
 * passam a esperar uma pela outra, e a segunda já lê o saldo atualizado.
 * Se ainda não houver linha de estoque, não trava nada (não há saldo para disputar).
 */
export async function travarEstoque(tx: any, operacaoId: string, produtoId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM itens_estoque WHERE operacao_id = ${operacaoId} AND produto_id = ${produtoId} FOR UPDATE`;
}
