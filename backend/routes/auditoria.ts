/**
 * Rota de Auditoria (somente admin).
 * Extraída do server.ts para melhor organização.
 */
import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, escopoCampanha, wrap } from '../middlewares';

const router = Router();

// GET /api/auditoria
router.get(
  '/auditoria',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const logs = await prisma.logAuditoria.findMany({
      where: escopoCampanha(req),
      orderBy: { created_at: 'desc' },
      take: 300,
    });
    res.json(logs);
  }),
);

export default router;
