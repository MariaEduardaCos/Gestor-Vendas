import { PrismaClient } from '@prisma/client';

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
            return (basePrisma as any)[model].findFirst({
              where: {
                ...args.where,
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
            return (basePrisma as any)[model].findFirstOrThrow({
              where: {
                ...args.where,
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

          return query(args);
        }
      }
    }
  });
}

export type TenantPrismaClient = ReturnType<typeof createTenantPrisma>;
