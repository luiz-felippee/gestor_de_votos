/**
 * Configurações globais do sistema (tabela chave-valor).
 * Permite guardar segredos (ex.: chave do ImgBB) pela própria aplicação, sem
 * depender de variáveis de ambiente do servidor de hospedagem.
 */
import { Router } from 'express';
import { prisma } from '../prismaClient';
import { wrap, requireAuth, requireRole } from '../middlewares';

const router = Router();

// Cache em memória para não bater no banco a cada upload.
const cacheConfig = new Map<string, { valor: string; exp: number }>();
const TTL_MS = 60 * 1000;

/** Lê uma configuração (env tem prioridade; senão, banco com cache de 60s). */
export async function getConfig(chave: string, envVar?: string): Promise<string | null> {
  if (envVar && process.env[envVar]) return process.env[envVar] as string;

  const agora = Date.now();
  const cacheado = cacheConfig.get(chave);
  if (cacheado && cacheado.exp > agora) return cacheado.valor || null;

  const row = await prisma.configuracao.findUnique({ where: { chave } });
  const valor = row?.valor ?? '';
  cacheConfig.set(chave, { valor, exp: agora + TTL_MS });
  return valor || null;
}

/** Atalho para a chave do ImgBB (env IMGBB_API_KEY ou config 'imgbb_key'). */
export function getImgbbKey(): Promise<string | null> {
  return getConfig('imgbb_key', 'IMGBB_API_KEY');
}

// GET /api/configuracoes — status das configs (nunca devolve o segredo em texto)
router.get(
  '/configuracoes',
  requireAuth,
  requireRole('admin'),
  wrap(async (_req, res) => {
    const imgbb = await prisma.configuracao.findUnique({ where: { chave: 'imgbb_key' } });
    res.json({
      imgbb_key_set: !!imgbb?.valor || !!process.env.IMGBB_API_KEY,
      // Indica se está fixado por env (nesse caso o campo do app não sobrescreve).
      imgbb_key_via_env: !!process.env.IMGBB_API_KEY,
    });
  })
);

// POST /api/configuracoes — salva/atualiza a chave do ImgBB
router.post(
  '/configuracoes',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const { imgbb_key } = req.body as { imgbb_key?: string };

    if (typeof imgbb_key === 'string') {
      const valor = imgbb_key.trim();
      await prisma.configuracao.upsert({
        where: { chave: 'imgbb_key' },
        create: { chave: 'imgbb_key', valor },
        update: { valor },
      });
      cacheConfig.delete('imgbb_key'); // invalida o cache imediatamente
    }

    res.json({ success: true });
  })
);

export default router;
