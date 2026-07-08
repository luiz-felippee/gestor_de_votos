import { PrismaClient } from '@prisma/client';

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

export const prisma = new PrismaClient(
  process.env.DATABASE_URL ? { datasourceUrl: urlComPool(process.env.DATABASE_URL) } : undefined
);

// Middleware de Soft Delete
const SOFT_DELETE_MODELS = ['Eleitor', 'CaboEleitoral', 'Usuario', 'Evento'];

prisma.$use(async (params, next) => {
  if (params.model && SOFT_DELETE_MODELS.includes(params.model)) {
    params.args = params.args || {};
    
    if (params.action === 'findUnique' || params.action === 'findFirst') {
      params.action = 'findFirst';
      params.args.where = { ...(params.args.where || {}), deleted_at: null };
    }
    if (params.action === 'findMany') {
      params.args.where = { ...(params.args.where || {}), deleted_at: null };
    }
    if (params.action === 'update') {
      params.args.where = { ...(params.args.where || {}), deleted_at: null };
    }
    if (params.action === 'updateMany') {
      params.args.where = { ...(params.args.where || {}), deleted_at: null };
    }
    if (params.action === 'delete') {
      params.action = 'update';
      params.args['data'] = { deleted_at: new Date() };
    }
    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      if (params.args.data !== undefined) {
        params.args.data['deleted_at'] = new Date();
      } else {
        params.args['data'] = { deleted_at: new Date() };
      }
    }
  }
  return next(params);
});
