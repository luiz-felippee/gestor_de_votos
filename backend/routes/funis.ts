import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, escopoCampanha, wrap, requirePlanLimit } from '../middlewares';

const router = Router();

// --- Funis ---

// Listar funis
router.get(
  '/funis',
  requireAuth,
  wrap(async (req, res) => {
    const funis = await prisma.funilWhatsApp.findMany({
      where: escopoCampanha(req),
      include: {
        etapas: { orderBy: { ordem: 'asc' } },
        _count: { select: { eleitores: true } }
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(funis);
  })
);

// Obter um funil
router.get(
  '/funis/:id',
  requireAuth,
  wrap(async (req, res) => {
    const funil = await prisma.funilWhatsApp.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) },
      include: { etapas: { orderBy: { ordem: 'asc' } } }
    });
    if (!funil) return res.status(404).json({ error: 'Funil não encontrado' });
    res.json(funil);
  })
);

// Criar funil
router.post(
  '/funis',
  requireAuth,
  requirePlanLimit('whatsapp'),
  wrap(async (req, res) => {
    const { nome, gatilho, ativo } = req.body;
    const funil = await prisma.funilWhatsApp.create({
      data: {
        campanha_id: req.user!.campanha_id ?? 'global',
        nome,
        gatilho: gatilho || 'novo_cadastro',
        ativo: ativo ?? true
      }
    });
    res.status(201).json(funil);
  })
);

// Atualizar funil
router.put(
  '/funis/:id',
  requireAuth,
  wrap(async (req, res) => {
    const { nome, gatilho, ativo } = req.body;
    const existe = await prisma.funilWhatsApp.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) }
    });
    if (!existe) return res.status(404).json({ error: 'Funil não encontrado' });

    const funil = await prisma.funilWhatsApp.update({
      where: { id: String(req.params.id) },
      data: {
        nome: nome !== undefined ? nome : undefined,
        gatilho: gatilho !== undefined ? gatilho : undefined,
        ativo: ativo !== undefined ? ativo : undefined,
      }
    });
    res.json(funil);
  })
);

// Excluir funil
router.delete(
  '/funis/:id',
  requireAuth,
  wrap(async (req, res) => {
    const existe = await prisma.funilWhatsApp.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) }
    });
    if (!existe) return res.status(404).json({ error: 'Funil não encontrado' });

    await prisma.funilWhatsApp.delete({ where: { id: String(req.params.id) } });
    res.status(204).send();
  })
);

// --- Etapas do Funil ---

// Criar etapa
router.post(
  '/funis/:id/etapas',
  requireAuth,
  wrap(async (req, res) => {
    const { ordem, dias_espera, mensagem_texto, mensagem_midia_url, tipo_midia } = req.body;
    const existe = await prisma.funilWhatsApp.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) }
    });
    if (!existe) return res.status(404).json({ error: 'Funil não encontrado' });

    const etapa = await prisma.funilEtapa.create({
      data: {
        funil_id: String(req.params.id),
        ordem,
        dias_espera: dias_espera || 0,
        mensagem_texto,
        mensagem_midia_url,
        tipo_midia: tipo_midia || 'text'
      }
    });
    res.status(201).json(etapa);
  })
);

// Atualizar etapa
router.put(
  '/funis/:funilId/etapas/:etapaId',
  requireAuth,
  wrap(async (req, res) => {
    const { ordem, dias_espera, mensagem_texto, mensagem_midia_url, tipo_midia } = req.body;
    const existe = await prisma.funilWhatsApp.findFirst({
      where: { id: String(req.params.funilId), ...escopoCampanha(req) }
    });
    if (!existe) return res.status(404).json({ error: 'Funil não encontrado' });

    const etapa = await prisma.funilEtapa.update({
      where: { id: String(req.params.etapaId) },
      data: {
        ordem: ordem !== undefined ? ordem : undefined,
        dias_espera: dias_espera !== undefined ? dias_espera : undefined,
        mensagem_texto: mensagem_texto !== undefined ? mensagem_texto : undefined,
        mensagem_midia_url: mensagem_midia_url !== undefined ? mensagem_midia_url : undefined,
        tipo_midia: tipo_midia !== undefined ? tipo_midia : undefined,
      }
    });
    res.json(etapa);
  })
);

// Excluir etapa
router.delete(
  '/funis/:funilId/etapas/:etapaId',
  requireAuth,
  wrap(async (req, res) => {
    const existe = await prisma.funilWhatsApp.findFirst({
      where: { id: String(req.params.funilId), ...escopoCampanha(req) }
    });
    if (!existe) return res.status(404).json({ error: 'Funil não encontrado' });

    await prisma.funilEtapa.delete({ where: { id: String(req.params.etapaId) } });
    res.status(204).send();
  })
);

export default router;
