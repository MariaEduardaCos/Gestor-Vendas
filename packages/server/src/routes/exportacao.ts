import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import {
  centavosParaReais,
  createProblemDetails,
  dataHoraLocal,
  gerarCsv,
  gerarUuidV7,
  hojeNoFuso,
  type ColunaCsv
} from '@consultorasync/core';
import { resumoCobrancaDaConta } from './cobranca.js';

/**
 * Exportação dos dados da operação (NFR-009): planilhas CSV para o Excel e uma cópia
 * completa em JSON. Tudo passa pelo tenantPrisma, então cada revendedora só baixa o que é dela.
 */

const SITUACAO_COBRANCA: Record<string, string> = {
  QUITADA: 'Quitada',
  SEM_VENCIMENTO: 'Sem vencimento',
  ATRASADA: 'Atrasada',
  EM_DIA: 'Em dia'
};

const STATUS_ENTREGA: Record<string, string> = {
  AGUARDANDO_FABRICA: 'Aguardando a marca',
  RESERVADO_PRESENTE: 'Reservado (em casa)',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
  CANCELADO_FALTA_FABRICA: 'Cancelado (falta na marca)'
};

const FORMA_PAGAMENTO: Record<string, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'Pix',
  CARTAO: 'Cartão',
  CREDITO_CARTEIRA: 'Crédito da cliente'
};

const rotulo = (mapa: Record<string, string>, valor: string) => mapa[valor] ?? valor;

type Tenant = FastifyRequest['tenantPrisma'];

interface Planilha {
  titulo: string;
  gerar: (db: Tenant) => Promise<string>;
}

const PLANILHAS: Record<string, Planilha> = {
  clientes: {
    titulo: 'clientes',
    async gerar(db) {
      const clientes = await db.cliente.findMany({
        orderBy: { nome: 'asc' },
        include: { contas: { select: { valor_total: true, total_pago: true } } }
      });
      type L = (typeof clientes)[number];
      const emAberto = (c: L) => c.contas.reduce((s, ct) => s + Math.max(0, ct.valor_total - ct.total_pago), 0);
      const colunas: ColunaCsv<L>[] = [
        { titulo: 'Nome', valor: (c) => c.nome },
        { titulo: 'Telefone', valor: (c) => c.telefone },
        { titulo: 'Endereço', valor: (c) => c.endereco },
        { titulo: 'Compras', valor: (c) => c.contas.length },
        { titulo: 'Em aberto (R$)', valor: (c) => centavosParaReais(emAberto(c)) },
        { titulo: 'Crédito da cliente (R$)', valor: (c) => centavosParaReais(c.saldo_credito_centavos) },
        { titulo: 'Cadastrada em', valor: (c) => dataHoraLocal(c.criado_em) }
      ];
      return gerarCsv(colunas, clientes);
    }
  },

  contas: {
    titulo: 'contas-a-receber',
    async gerar(db) {
      const contas = await db.conta.findMany({
        orderBy: { criado_em: 'desc' },
        include: { cliente: { select: { nome: true, telefone: true } }, parcelas: { select: { vencimento: true } } }
      });
      const linhas = contas.map((c) => ({ ...c, cobranca: resumoCobrancaDaConta(c, c.parcelas) }));
      type L = (typeof linhas)[number];
      const colunas: ColunaCsv<L>[] = [
        { titulo: 'Data da compra', valor: (c) => dataHoraLocal(c.criado_em) },
        { titulo: 'Cliente', valor: (c) => c.cliente.nome },
        { titulo: 'Telefone', valor: (c) => c.cliente.telefone },
        { titulo: 'Total (R$)', valor: (c) => centavosParaReais(c.valor_total) },
        { titulo: 'Pago (R$)', valor: (c) => centavosParaReais(c.total_pago) },
        { titulo: 'Saldo (R$)', valor: (c) => centavosParaReais(c.cobranca.saldo_centavos) },
        { titulo: 'Situação', valor: (c) => rotulo(SITUACAO_COBRANCA, c.cobranca.situacao) },
        { titulo: 'Vencido (R$)', valor: (c) => centavosParaReais(c.cobranca.valor_vencido_centavos) },
        { titulo: 'Dias de atraso', valor: (c) => c.cobranca.dias_atraso },
        { titulo: 'Próximo vencimento', valor: (c) => c.cobranca.proximo_vencimento },
        { titulo: 'Parcelas', valor: (c) => c.cobranca.parcelas.length },
        { titulo: 'Código da conta', valor: (c) => c.id }
      ];
      return gerarCsv(colunas, linhas);
    }
  },

  vendas: {
    titulo: 'itens-vendidos',
    async gerar(db) {
      const itens = await db.itemConta.findMany({
        orderBy: { criado_em: 'desc' },
        include: {
          conta: { select: { id: true, cliente: { select: { nome: true } } } },
          produto: { select: { nome: true, variante: true, codigo_barras: true, marca: { select: { nome: true } } } }
        }
      });
      type L = (typeof itens)[number];
      const colunas: ColunaCsv<L>[] = [
        { titulo: 'Data', valor: (i) => dataHoraLocal(i.criado_em) },
        { titulo: 'Cliente', valor: (i) => i.conta.cliente.nome },
        { titulo: 'Marca', valor: (i) => i.produto.marca?.nome },
        { titulo: 'Produto', valor: (i) => i.produto.nome },
        { titulo: 'Variante', valor: (i) => i.produto.variante },
        { titulo: 'Código de barras', valor: (i) => i.produto.codigo_barras },
        { titulo: 'Quantidade', valor: (i) => i.quantidade },
        { titulo: 'Preço unitário (R$)', valor: (i) => centavosParaReais(i.preco_unitario_centavos) },
        { titulo: 'Subtotal (R$)', valor: (i) => centavosParaReais(i.quantidade * i.preco_unitario_centavos) },
        { titulo: 'Custo unitário (R$)', valor: (i) => centavosParaReais(i.custo_unitario_centavos) },
        { titulo: 'Situação', valor: (i) => rotulo(STATUS_ENTREGA, i.status_entrega) },
        { titulo: 'Código da conta', valor: (i) => i.conta.id }
      ];
      return gerarCsv(colunas, itens);
    }
  },

  pagamentos: {
    titulo: 'pagamentos',
    async gerar(db) {
      const pagamentos = await db.pagamentoConta.findMany({
        orderBy: { data_pagamento: 'desc' },
        include: { conta: { select: { cliente: { select: { nome: true } } } } }
      });
      type L = (typeof pagamentos)[number];
      const colunas: ColunaCsv<L>[] = [
        { titulo: 'Data', valor: (p) => dataHoraLocal(p.data_pagamento) },
        { titulo: 'Cliente', valor: (p) => p.conta.cliente.nome },
        { titulo: 'Forma', valor: (p) => rotulo(FORMA_PAGAMENTO, p.forma_pagamento) },
        { titulo: 'Valor pago (R$)', valor: (p) => centavosParaReais(p.valor_pago_centavos) },
        { titulo: 'Taxa do cartão (R$)', valor: (p) => centavosParaReais(p.taxa_cartao_centavos) },
        { titulo: 'Valor líquido (R$)', valor: (p) => centavosParaReais(p.valor_liquido_centavos) },
        { titulo: 'Situação', valor: (p) => (p.status === 'ESTORNADO' ? 'Estornado' : 'Confirmado') },
        { titulo: 'Motivo do estorno', valor: (p) => p.motivo_estorno },
        { titulo: 'Registrado por', valor: (p) => p.operador_nome }
      ];
      return gerarCsv(colunas, pagamentos);
    }
  },

  estoque: {
    titulo: 'estoque-e-produtos',
    async gerar(db) {
      const produtos = await db.produto.findMany({
        orderBy: [{ nome: 'asc' }],
        include: { marca: { select: { nome: true } }, itens_estoque: true }
      });
      type L = (typeof produtos)[number];
      const est = (p: L) => p.itens_estoque[0];
      const colunas: ColunaCsv<L>[] = [
        { titulo: 'Marca', valor: (p) => p.marca?.nome },
        { titulo: 'Produto', valor: (p) => p.nome },
        { titulo: 'Variante', valor: (p) => p.variante },
        { titulo: 'Código de barras', valor: (p) => p.codigo_barras },
        { titulo: 'Preço de venda (R$)', valor: (p) => centavosParaReais(p.preco_venda_centavos) },
        { titulo: 'Custo (R$)', valor: (p) => centavosParaReais(p.custo_centavos) },
        { titulo: 'Em casa', valor: (p) => est(p)?.presentes ?? 0 },
        { titulo: 'Reservados', valor: (p) => est(p)?.reservados ?? 0 },
        { titulo: 'Pronta-entrega', valor: (p) => est(p)?.pronta_entrega ?? 0 },
        { titulo: 'Ciclo do catálogo', valor: (p) => p.ciclo_catalogo }
      ];
      return gerarCsv(colunas, produtos);
    }
  }
};

async function registrarExportacao(request: FastifyRequest, detalhes: string) {
  const s = request.session!;
  await request.tenantPrisma.registroAuditoria.create({
    data: {
      id: gerarUuidV7(),
      operacao_id: s.operacaoId,
      operador_id: s.operadorId,
      operador_nome: s.operadorNome,
      acao: 'EXPORTAR_DADOS',
      detalhes,
      criado_em: new Date()
    }
  });
}

function anexo(reply: FastifyReply, nomeArquivo: string, tipo: string) {
  return reply
    .header('Content-Type', tipo)
    .header('Content-Disposition', `attachment; filename="${nomeArquivo}"`)
    .header('Cache-Control', 'no-store');
}

export const exportacaoRoutes: FastifyPluginAsync = async (fastify) => {
  /** Lista do que dá para exportar (a tela monta os botões a partir daqui). */
  fastify.get('/api/exportar', { preHandler: fastify.requireSession }, async () => ({
    planilhas: Object.keys(PLANILHAS),
    copia_completa: true
  }));

  fastify.get<{ Params: { tipo: string } }>(
    '/api/exportar/:tipo.csv',
    { preHandler: fastify.requireSession },
    async (request, reply) => {
      const planilha = PLANILHAS[request.params.tipo];
      if (!planilha) {
        return reply
          .status(404)
          .type('application/problem+json')
          .send(createProblemDetails(404, 'NOT_FOUND', 'Exportação inexistente', `Use uma destas: ${Object.keys(PLANILHAS).join(', ')}.`));
      }
      const csv = await planilha.gerar(request.tenantPrisma);
      await registrarExportacao(request, `Planilha ${request.params.tipo}`);
      return anexo(reply, `${planilha.titulo}-${hojeNoFuso()}.csv`, 'text/csv; charset=utf-8').send(csv);
    }
  );

  /** Cópia completa da operação em JSON (backup). PIN e dados de login ficam de fora. */
  fastify.get('/api/exportar/copia.json', { preHandler: fastify.requireSession }, async (request, reply) => {
    const db = request.tenantPrisma;
    const [
      operacao,
      operadores,
      clientes,
      marcas,
      produtos,
      estoque,
      movimentacoes,
      encomendas,
      contas,
      itensConta,
      parcelas,
      pagamentos,
      excedentes,
      comprasMarca,
      itensCompraMarca,
      auditoria
    ] = await Promise.all([
      db.operacao.findFirst({}),
      db.operador.findMany({ select: { id: true, nome: true, ativo: true, criado_em: true } }),
      db.cliente.findMany({}),
      db.marca.findMany({}),
      db.produto.findMany({}),
      db.estoqueItem.findMany({}),
      db.movimentacaoEstoque.findMany({}),
      db.encomenda.findMany({}),
      db.conta.findMany({}),
      db.itemConta.findMany({}),
      db.parcelaConta.findMany({}),
      db.pagamentoConta.findMany({}),
      db.excedentePendente.findMany({}),
      db.compraMarca.findMany({}),
      db.itemCompraMarca.findMany({}),
      db.registroAuditoria.findMany({})
    ]);

    const copia = {
      formato: 'consultorasync-copia',
      versao: 1,
      gerada_em: new Date().toISOString(),
      observacao: 'Valores em centavos (inteiros). Datas em UTC.',
      operacao,
      dados: {
        operadores,
        clientes,
        marcas,
        produtos,
        estoque,
        movimentacoes_estoque: movimentacoes,
        encomendas,
        contas,
        itens_conta: itensConta,
        parcelas_conta: parcelas,
        pagamentos,
        excedentes,
        compras_marca: comprasMarca,
        itens_compra_marca: itensCompraMarca,
        auditoria
      }
    };
    await registrarExportacao(request, 'Cópia completa (JSON)');
    return anexo(reply, `copia-consultorasync-${hojeNoFuso()}.json`, 'application/json; charset=utf-8').send(JSON.stringify(copia, null, 2));
  });
};
