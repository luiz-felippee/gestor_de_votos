import { PrismaClient, Prisma } from '@prisma/client';

// Normaliza a connection string para uso eficiente do pool de conexões.
// Objetivo: no Render, basta colar a URL "pooled" (PgBouncer) do Neon na env
// var DATABASE_URL — os parâmetros de pool são aplicados aqui automaticamente,
// sem precisar editar a URL na mão.
//  - pooler do Neon (host com "-pooler"): exige pgbouncer=true (desativa
//    prepared statements, incompatíveis com o modo transaction do PgBouncer) e
//    aceita mais conexões simultâneas (connection_limit maior).
//  - conexão direta: mantém um pool menor para não estourar o limite do Neon.
function urlComPool(raw: string): string {
  try {
    const u = new URL(raw);
    const ehPooler = u.hostname.includes('-pooler') || u.searchParams.get('pgbouncer') === 'true';
    if (ehPooler && !u.searchParams.has('pgbouncer')) u.searchParams.set('pgbouncer', 'true');
    if (!u.searchParams.has('connection_limit')) u.searchParams.set('connection_limit', ehPooler ? '10' : '5');
    if (!u.searchParams.has('pool_timeout')) u.searchParams.set('pool_timeout', '20');
    return u.toString();
  } catch {
    // Se a URL não for parseável, usa como veio (evita quebrar o boot).
    return raw;
  }
}

const prismaBase = new PrismaClient(
  process.env.DATABASE_URL ? { datasourceUrl: urlComPool(process.env.DATABASE_URL) } : undefined
);

// --- Soft Delete ---
// Antes isto era um middleware `prisma.$use`, API deprecada e marcada para remoção.
// Agora usa Client Extensions ($extends), que é o caminho suportado.
//
// São duas metades, e as duas precisam existir:
//  1. `query`: toda leitura/atualização ganha `deleted_at: null`, para que o registro
//     excluído simplesmente não exista para o resto do sistema.
//  2. `model`: `delete`/`deleteMany` viram `update`/`updateMany` carimbando `deleted_at`.
//     Diferente do `$use`, uma extensão de `query` NÃO consegue trocar a operação — se
//     esta metade faltar, `prisma.eleitor.delete()` volta a APAGAR a linha de verdade.
//     Por isso os overrides estão declarados modelo a modelo (e não em `$allModels`):
//     assim os modelos sem soft delete seguem com o `delete` normal do Prisma.
const MODELOS_SOFT_DELETE = ['Eleitor', 'CaboEleitoral', 'Usuario', 'Evento'];

const OPERACOES_FILTRADAS = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'update',
  'updateMany',
];

// Os overrides são declarados com tipos frouxos (`any`) de propósito. Tipar isso com os
// genéricos do Prisma faz o TS instanciar tipos tão profundos que o ts-node estoura a
// memória ao subir o dev server. Como o corpo é trivial, o custo de checagem aqui é baixo.
/* eslint-disable @typescript-eslint/no-explicit-any */
function softDeleteModel() {
  return {
    async delete(this: any, args: any): Promise<any> {
      const ctx: any = Prisma.getExtensionContext(this);
      return ctx.update({ where: args?.where, data: { deleted_at: new Date() } });
    },
    async deleteMany(this: any, args?: any): Promise<any> {
      const ctx: any = Prisma.getExtensionContext(this);
      return ctx.updateMany({ where: args?.where ?? {}, data: { deleted_at: new Date() } });
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const prisma = prismaBase.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!MODELOS_SOFT_DELETE.includes(model) || !OPERACOES_FILTRADAS.includes(operation)) {
          return query(args);
        }
        const a = (args ?? {}) as { where?: Record<string, unknown> };
        a.where = { ...(a.where ?? {}), deleted_at: null };
        return query(a as typeof args);
      },
    },
  },
  model: {
    eleitor: softDeleteModel(),
    caboEleitoral: softDeleteModel(),
    usuario: softDeleteModel(),
    evento: softDeleteModel(),
  },
});
