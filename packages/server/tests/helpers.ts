import type { PrismaClient } from '@prisma/client';

/**
 * Remove todos os dados das operações criadas por um teste, na ordem das chaves
 * estrangeiras, para não deixar sobras que quebrem a limpeza de outros testes.
 */
export async function limparOperacoes(prisma: PrismaClient, operacaoIds: string[]) {
  const where = { operacao_id: { in: operacaoIds } };
  await prisma.contatoCobranca.deleteMany({ where });
  await prisma.excedentePendente.deleteMany({ where });
  await prisma.pagamentoConta.deleteMany({ where });
  await prisma.parcelaConta.deleteMany({ where });
  await prisma.itemCompraMarca.deleteMany({ where });
  await prisma.compraMarca.deleteMany({ where });
  await prisma.itemConta.deleteMany({ where });
  await prisma.conta.deleteMany({ where });
  await prisma.encomenda.deleteMany({ where });
  await prisma.movimentacaoEstoque.deleteMany({ where });
  await prisma.estoqueItem.deleteMany({ where });
  await prisma.produto.deleteMany({ where });
  await prisma.marca.deleteMany({ where });
  await prisma.cliente.deleteMany({ where });
  await prisma.registroIdempotencia.deleteMany({ where });
  await prisma.registroAuditoria.deleteMany({ where });
  await prisma.operador.deleteMany({ where });
  await prisma.operacao.deleteMany({ where: { id: { in: operacaoIds } } });
}

/** Apaga TODOS os dados do banco de teste, na ordem das chaves estrangeiras. */
export async function limparBancoDeTeste(prisma: PrismaClient) {
  const ops = await prisma.operacao.findMany({ select: { id: true } });
  await prisma.recursoExemplo.deleteMany();
  await limparOperacoes(prisma, ops.map((o) => o.id));
}
