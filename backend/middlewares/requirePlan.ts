import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prismaClient';

export interface PlanLimits {
  maxEleitores: number;
  maxCabos: number;
}

// Limites de plano desativados: todo mundo tem acesso ilimitado, independente
// do plano contratado. Mantido em Record para não quebrar quem lê PLAN_LIMITS.
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  gratis: { maxEleitores: 9999999, maxCabos: 9999999 },
  basico: { maxEleitores: 9999999, maxCabos: 9999999 },
  pro: { maxEleitores: 9999999, maxCabos: 9999999 },
};

/**
 * Middleware para bloquear ações se a campanha ultrapassou o limite do plano.
 * Usar antes da criação de registros no backend.
 */
export const requirePlanLimit = (recurso: 'eleitores' | 'cabos') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let campanha_id = (req as Request & { user?: { campanha_id?: string | null } }).user?.campanha_id;

      // Tenta inferir a campanha para rotas públicas (ex: POST /eleitores sem auth)
      if (!campanha_id && req.body) {
        if (req.body.cabo_id) {
          const cabo = await prisma.caboEleitoral.findUnique({
            where: { id: String(req.body.cabo_id) },
            select: { campanha_id: true },
          });
          campanha_id = cabo?.campanha_id;
        } else if (req.body.campanha_slug) {
          const c = await prisma.campanha.findUnique({
            where: { slug: String(req.body.campanha_slug) },
            select: { id: true }
          });
          campanha_id = c?.id;
        }
      }

      if (!campanha_id) return next(); // Se ainda não tem, pode ser admin global criando

      const campanha = await prisma.campanha.findUnique({
        where: { id: campanha_id },
        select: { plano: true, assinatura_status: true }
      });

      if (!campanha) return res.status(404).json({ error: 'Campanha não encontrada.' });

      // Se a assinatura está cancelada/inadimplente, cai para limites do grátis
      const planoAtivo = (campanha.assinatura_status === 'ativa') ? (campanha.plano || 'gratis') : 'gratis';
      const limites = PLAN_LIMITS[planoAtivo] || PLAN_LIMITS['gratis'];

      if (recurso === 'eleitores') {
        const count = await prisma.eleitor.count({ where: { campanha_id } });
        if (count >= limites.maxEleitores) {
          return res.status(403).json({ error: `Limite do plano atingido (${limites.maxEleitores} eleitores). Faça o upgrade para continuar.` });
        }
      }

      if (recurso === 'cabos') {
        const count = await prisma.caboEleitoral.count({ where: { campanha_id } });
        if (count >= limites.maxCabos) {
          return res.status(403).json({ error: `Limite do plano atingido (${limites.maxCabos} lideranças). Faça o upgrade para continuar.` });
        }
      }

      next();
    } catch (error) {
      console.error('[requirePlanLimit Error]', error);
      res.status(500).json({ error: 'Erro ao verificar limites do plano.' });
    }
  };
};
