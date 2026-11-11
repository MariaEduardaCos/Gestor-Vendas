import { PrismaClient } from '@prisma/client';

function flattenCompoundKeys(where: any): any {
  if (!where || typeof where !== 'object') return where;
  let flattened: any = { ...where };
  for (const key of Object.keys(flattened)) {
    if (
      typeof flattened[key] === 'object' &&
      flattened[key] !== null &&
      !Array.isArray(flattened[key]) &&
      !(flattened[key] instanceof Date)
    ) {
      const nested = flattened[key];
      delete flattened[key];
      flattened = { ...flattened, ...nested };
    }
  }
  return flattened;
}

/**
 * Cria uma instância do Prisma Client com extensão mandatória para isolamento multi-inquilino.
 * Todas as leituras (findMany, findFirst, findUnique, findFirstOrThrow, findUniqueOrThrow, count)
 * e mutações (create, createMany, update, updateMany, delete, deleteMany, upsert)
 * são automaticamente interceptadas para filtrar ou vincular operacao_id.
 * Impede terminantemente vazamento de dados mesmo quando identificadores primários são fornecidos (FR-002, NFR-002).
 */
export function createTenantPrisma(basePrisma: PrismaClient, operacaoId: string) {
  if (!operacaoId || operacaoId.trim() === '') {
    throw new Error('operacaoId é obrigatório para instanciar o TenantPrismaClient.');
  }

  const normalizedOperacaoId = operacaoId.trim();

  return basePrisma.$extends({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (model !== 'Operacao') {
            args.where = { ...(args.where || {}), operacao_id: normalizedOperacaoId };
          } else {
            args.where = { ...(args.where || {}), id: normalizedOperacaoId };
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (model !== 'Operacao') {
            args.where = { ...(args.where || {}), operacao_id: normalizedOperacaoId };
          } else {
            args.where = { ...(args.where || {}), id: normalizedOperacaoId };
          }
          return query(args);
        },
        async findFirstOrThrow({ model, args, query }) {
          if (model !== 'Operacao') {
            args.where = { ...(args.where || {}), operacao_id: normalizedOperacaoId };
          } else {
            args.where = { ...(args.where || {}), id: normalizedOperacaoId };
          }
          return query(args);
        },
        async findUnique({ model, args, query }) {
          if (model !== 'Operacao') {
            // Em SQLite/Prisma, findUnique requer campo @unique.
            // Para garantir isolamento de inquilino mesmo conhecendo o ID,
            // redirecionamos para findFirst com cláusula obrigatória operacao_id.
            const whereClause = flattenCompoundKeys(args.where);
            return (basePrisma as any)[model].findFirst({
              where: {
                ...whereClause,
                operacao_id: normalizedOperacaoId
              },
              include: (args as any).include,
              select: (args as any).select
            });
          } else {
            // Para a entidade Operacao em si, se o ID consultado for de outra operacao, não retorna nada
            if (args.where && (args.where as any).id && (args.where as any).id !== normalizedOperacaoId) {
              return null;
            }
            return query(args);
          }
        },
        async findUniqueOrThrow({ model, args, query }) {
          if (model !== 'Operacao') {
            const whereClause = flattenCompoundKeys(args.where);
            return (basePrisma as any)[model].findFirstOrThrow({
              where: {
                ...whereClause,
                operacao_id: normalizedOperacaoId
              },
              include: (args as any).include,
              select: (args as any).select
            });
          } else {
            if (args.where && (args.where as any).id && (args.where as any).id !== normalizedOperacaoId) {
              throw new Error(`Operação '${(args.where as any).id}' não encontrada ou não autorizada.`);
            }
            return query(args);
          }
        },
        async count({ model, args, query }) {
          if (model !== 'Operacao') {
            args.where = { ...(args.where || {}), operacao_id: normalizedOperacaoId };
          } else {
            args.where = { ...(args.where || {}), id: normalizedOperacaoId };
          }
          return query(args);
        },
        async create({ model, args, query }) {
          if (model !== 'Operacao') {
            args.data = { ...(args.data as any), operacao_id: normalizedOperacaoId };
          }
          if (model === 'EstoqueItem') {
            const data = args.data as any;
            const p = data.presentes ?? 0;
            const r = data.reservados ?? 0;
            const pe = data.pronta_entrega ?? 0;
            if (!Number.isInteger(p) || p < 0 || !Number.isInteger(r) || r < 0 || !Number.isInteger(pe) || pe < 0 || p !== r + pe || p < r) {
              throw new Error('A regra de conservação de estoque foi violada: Presentes deve ser igual a Reservados + ProntaEntrega (AD-3).');
            }
          }
          if (model === 'MovimentacaoEstoque') {
            const data = args.data as any;
            if (data.tipo === 'ESTOQUE_INICIAL' && data.compra_id !== null && data.compra_id !== undefined) {
              throw new Error('Lançamento de estoque inicial não pode possuir vínculo com compra da marca (FR-013).');
            }
          }
          return query(args);
        },
        async createMany({ model, args, query }) {
          if (model !== 'Operacao') {
            if (Array.isArray(args.data)) {
              args.data = args.data.map((item: any) => ({
                ...item,
                operacao_id: normalizedOperacaoId
              }));
            } else {
              args.data = { ...(args.data as any), operacao_id: normalizedOperacaoId };
            }
          }
          return query(args);
        },
        async update({ model, args, query }) {
          if (model === 'Operacao') {
            if (args.where && (args.where as any).id && (args.where as any).id !== normalizedOperacaoId) {
              throw new Error(`Não é permitido modificar uma operação diferente de '${normalizedOperacaoId}'.`);
            }
            return query(args);
          }

          // Impede reatribuição de tenant
          if ((args.data as any)?.operacao_id !== undefined) {
            (args.data as any).operacao_id = normalizedOperacaoId;
          }

          const existing = await (basePrisma as any)[model].findFirst({
            where: { ...args.where, operacao_id: normalizedOperacaoId }
          });
          if (!existing) {
            throw new Error(`Registro não encontrado ou não pertence à operação '${normalizedOperacaoId}'.`);
          }

          if (model === 'EstoqueItem') {
            const data = args.data as any;
            const p = data.presentes !== undefined ? data.presentes : existing.presentes;
            const r = data.reservados !== undefined ? data.reservados : existing.reservados;
            const pe = data.pronta_entrega !== undefined ? data.pronta_entrega : existing.pronta_entrega;
            if (!Number.isInteger(p) || p < 0 || !Number.isInteger(r) || r < 0 || !Number.isInteger(pe) || pe < 0 || p !== r + pe || p < r) {
              throw new Error('A regra de conservação de estoque foi violada: Presentes deve ser igual a Reservados + ProntaEntrega (AD-3).');
            }
          }

          return query(args);
        },
        async updateMany({ model, args, query }) {
          if (model === 'Operacao') {
            args.where = { ...(args.where || {}), id: normalizedOperacaoId };
            return query(args);
          }

          // Impede reatribuição de tenant
          if ((args.data as any)?.operacao_id !== undefined) {
            (args.data as any).operacao_id = normalizedOperacaoId;
          }

          args.where = { ...(args.where || {}), operacao_id: normalizedOperacaoId };
          return query(args);
        },
        async delete({ model, args, query }) {
          if (model === 'Operacao') {
            if (args.where && (args.where as any).id && (args.where as any).id !== normalizedOperacaoId) {
              throw new Error(`Não é permitido excluir uma operação diferente de '${normalizedOperacaoId}'.`);
            }
            return query(args);
          }

          const existing = await (basePrisma as any)[model].findFirst({
            where: { ...args.where, operacao_id: normalizedOperacaoId }
          });
          if (!existing) {
            throw new Error(`Registro não encontrado ou não pertence à operação '${normalizedOperacaoId}'.`);
          }

          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (model === 'Operacao') {
            args.where = { ...(args.where || {}), id: normalizedOperacaoId };
            return query(args);
          }

          args.where = { ...(args.where || {}), operacao_id: normalizedOperacaoId };
          return query(args);
        },
        async upsert({ model, args, query }) {
          if (model === 'Operacao') {
            if (args.where && (args.where as any).id && (args.where as any).id !== normalizedOperacaoId) {
              throw new Error(`Não é permitido realizar upsert em operação diferente de '${normalizedOperacaoId}'.`);
            }
            return query(args);
          }

          args.create = { ...(args.create as any), operacao_id: normalizedOperacaoId };
          if ((args.update as any)?.operacao_id !== undefined) {
            (args.update as any).operacao_id = normalizedOperacaoId;
          }

          const existingOther = await (basePrisma as any)[model].findFirst({
            where: { ...args.where, NOT: { operacao_id: normalizedOperacaoId } }
          });
          if (existingOther) {
            throw new Error(`Registro não pertence à operação '${normalizedOperacaoId}'.`);
          }

          if (model === 'EstoqueItem') {
            const createData = args.create as any;
            const cp = createData.presentes ?? 0;
            const cr = createData.reservados ?? 0;
            const cpe = createData.pronta_entrega ?? 0;
            if (!Number.isInteger(cp) || cp < 0 || !Number.isInteger(cr) || cr < 0 || !Number.isInteger(cpe) || cpe < 0 || cp !== cr + cpe || cp < cr) {
              throw new Error('A regra de conservação de estoque foi violada: Presentes deve ser igual a Reservados + ProntaEntrega (AD-3).');
            }

            const existingSelf = await (basePrisma as any)[model].findFirst({
              where: { ...args.where, operacao_id: normalizedOperacaoId }
            });
            const updateData = args.update as any;
            const up = updateData.presentes !== undefined ? updateData.presentes : existingSelf?.presentes ?? cp;
            const ur = updateData.reservados !== undefined ? updateData.reservados : existingSelf?.reservados ?? cr;
            const upe = updateData.pronta_entrega !== undefined ? updateData.pronta_entrega : existingSelf?.pronta_entrega ?? cpe;
            if (!Number.isInteger(up) || up < 0 || !Number.isInteger(ur) || ur < 0 || !Number.isInteger(upe) || upe < 0 || up !== ur + upe || up < ur) {
              throw new Error('A regra de conservação de estoque foi violada: Presentes deve ser igual a Reservados + ProntaEntrega (AD-3).');
            }
          }

          return query(args);
        }
      }
    }
  });
}

export type TenantPrismaClient = ReturnType<typeof createTenantPrisma>;
