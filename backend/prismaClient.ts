import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

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
