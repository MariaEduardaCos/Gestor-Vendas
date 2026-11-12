import type { FastifyPluginAsync } from 'fastify';
import {
  Produto,
  gerarUuidV7,
  createProblemDetails,
  planejarImportacaoCatalogo,
  type LinhaCatalogo
} from '@consultorasync/core';

interface ImportarCatalogoBody {
  ciclo: string;
  itens: LinhaCatalogo[];
  /** true: só calcula a prévia, sem gravar nada. */
  simular?: boolean;
}

const MAX_ITENS = 2000;

export const catalogoRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/marcas/:id/catalogo — carrega o catálogo do ciclo da marca (prévia ou aplicação)
  fastify.post<{ Params: { id: string }; Body: ImportarCatalogoBody }>(
    '/api/marcas/:id/catalogo',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const session = request.session!;
      const { ciclo, itens, simular } = request.body || ({} as ImportarCatalogoBody);
      const cicloLimpo = (ciclo ?? '').trim();

      const invalido = (detalhe: string) =>
        reply.status(400).type('application/problem+json').send(createProblemDetails(400, 'BAD_REQUEST', 'Catálogo inválido', detalhe));

      if (!cicloLimpo) return invalido('Informe o ciclo ou campanha do catálogo (ex.: "Ciclo 17/2026").');
      if (!Array.isArray(itens) || itens.length === 0) return invalido('O catálogo não tem nenhum produto.');
      if (itens.length > MAX_ITENS) return invalido(`O catálogo pode ter no máximo ${MAX_ITENS} produtos por vez.`);
      for (const [i, it] of itens.entries()) {
        if (!it?.nome?.trim() || !Number.isInteger(it.precoVendaCentavos) || it.precoVendaCentavos <= 0) {
          return invalido(`Produto ${i + 1}: nome e preço positivo em centavos são obrigatórios.`);
        }
      }

      const marca = await request.tenantPrisma.marca.findUnique({ where: { id: request.params.id } });
      if (!marca) {
        return reply.status(404).type('application/problem+json').send(
          createProblemDetails(404, 'MARCA_NAO_ENCONTRADA', 'Marca Não Encontrada', 'A marca não existe ou não pertence a esta operação.')
        );
      }

      const existentes = await request.tenantPrisma.produto.findMany({ where: { marca_id: marca.id } });
      const acoes = planejarImportacaoCatalogo(
        existentes.map((p) => ({
          id: p.id,
          nome: p.nome,
          variante: p.variante,
          codigoBarras: p.codigo_barras,
          precoVendaCentavos: p.preco_venda_centavos
        })),
        itens
      );

      const resumo = {
        ciclo: cicloLimpo,
        novos: acoes.filter((a) => a.tipo === 'CRIAR').length,
        precos_alterados: acoes.filter((a) => a.tipo === 'ATUALIZAR_PRECO').length,
        sem_mudanca: acoes.filter((a) => a.tipo === 'SEM_MUDANCA').length,
        acoes: acoes.map((a) => ({
          tipo: a.tipo,
          nome: a.linha.nome,
          variante: a.linha.variante,
          codigo_barras: a.linha.codigoBarras,
          preco_venda_centavos: a.linha.precoVendaCentavos,
          preco_anterior_centavos: a.tipo === 'ATUALIZAR_PRECO' ? a.precoAnteriorCentavos : null
        }))
      };

      if (simular) return reply.status(200).send({ ...resumo, aplicado: false });

      const porId = new Map(existentes.map((p) => [p.id, p]));
      const agora = new Date();

      await fastify.prisma.$transaction(async (tx) => {
        for (const acao of acoes) {
          const { linha } = acao;
          if (acao.tipo === 'CRIAR') {
            const novo = new Produto({
              operacaoId: session.operacaoId,
              marcaId: marca.id,
              nome: linha.nome,
              variante: linha.variante,
              codigoBarras: linha.codigoBarras,
              precoVendaCentavos: linha.precoVendaCentavos,
              percentualDescontoMarca: marca.percentual_padrao
            });
            await tx.produto.create({
              data: {
                id: novo.id,
                operacao_id: session.operacaoId,
                marca_id: marca.id,
                nome: novo.nome,
                variante: novo.variante,
                codigo_barras: novo.codigoBarras,
                preco_venda_centavos: novo.precoVendaCentavos,
                custo_centavos: novo.custoCentavos,
                proveniencia_custo: novo.provenienciaCusto,
                ciclo_catalogo: cicloLimpo
              }
            });
            continue;
          }

          const atual = porId.get(acao.produtoId)!;
          if (acao.tipo === 'SEM_MUDANCA') {
            await tx.produto.updateMany({
              where: { id: atual.id, operacao_id: session.operacaoId },
              data: { ciclo_catalogo: cicloLimpo, codigo_barras: atual.codigo_barras ?? linha.codigoBarras }
            });
            continue;
          }

          // Preço novo: custo informado manualmente é mantido; estimativa é recalculada pelo percentual da marca.
          const custoManual = atual.proveniencia_custo === 'INFORMADO_MANUAL' ? atual.custo_centavos : null;
          const atualizado = new Produto({
            id: atual.id,
            operacaoId: session.operacaoId,
            marcaId: marca.id,
            nome: atual.nome,
            variante: atual.variante,
            codigoBarras: atual.codigo_barras ?? linha.codigoBarras,
            precoVendaCentavos: linha.precoVendaCentavos,
            custoManualCentavos: custoManual,
            percentualDescontoMarca: custoManual === null ? marca.percentual_padrao : null
          });
          await tx.produto.updateMany({
            where: { id: atual.id, operacao_id: session.operacaoId },
            data: {
              preco_venda_centavos: atualizado.precoVendaCentavos,
              custo_centavos: atualizado.custoCentavos,
              proveniencia_custo: atualizado.provenienciaCusto,
              codigo_barras: atualizado.codigoBarras,
              ciclo_catalogo: cicloLimpo
            }
          });
        }

        await tx.marca.updateMany({
          where: { id: marca.id, operacao_id: session.operacaoId },
          data: { catalogo_ciclo: cicloLimpo, catalogo_atualizado_em: agora }
        });

        await tx.registroAuditoria.create({
          data: {
            id: gerarUuidV7(),
            operacao_id: session.operacaoId,
            operador_id: session.operadorId,
            operador_nome: session.operadorNome,
            acao: 'IMPORTAR_CATALOGO_MARCA',
            detalhes: `Catálogo ${cicloLimpo} da marca ${marca.nome}: ${resumo.novos} novos, ${resumo.precos_alterados} preços alterados, ${resumo.sem_mudanca} sem mudança.`,
            criado_em: agora
          }
        });
      });

      return reply.status(200).send({ ...resumo, aplicado: true });
    }
  );
};
