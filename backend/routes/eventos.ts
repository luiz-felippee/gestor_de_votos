/**
 * Rotas de Eventos (Agenda de Reuniões).
 * Extraídas do server.ts para melhor organização.
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import {
  requireAuth, requireRole, escopoCampanha, wrap,
  type AuthedRequest,
} from '../middlewares';

const router = Router();

// --- Schemas de validação (Zod) ---
const eventoCreateSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório.').max(200),
  descricao: z.string().max(2000).nullable().optional(),
  data_hora: z.string().min(1, 'Data/hora é obrigatória.'),
  local: z.string().min(1, 'Local é obrigatório.').max(300),
  bairro: z.string().max(200).nullable().optional(),
  cidade: z.string().max(200).nullable().optional(),
});

const eventoUpdateSchema = z.object({
  titulo: z.string().min(1).max(200).optional(),
  descricao: z.string().max(2000).nullable().optional(),
  data_hora: z.string().min(1).optional(),
  local: z.string().min(1).max(300).optional(),
  bairro: z.string().max(200).nullable().optional(),
  cidade: z.string().max(200).nullable().optional(),
});

// GET /api/eventos
router.get(
  '/eventos',
  requireAuth,
  wrap(async (req, res) => {
    const eventos = await prisma.evento.findMany({
      where: escopoCampanha(req),
      orderBy: { data_hora: 'asc' },
      take: 1000, // trava de segurança contra payload sem limite (agenda cresce com o tempo)
    });
    res.json(eventos);
  })
);

// POST /api/eventos
router.post(
  '/eventos',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const parsed = eventoCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e: any) => e.message).join('; ');
      return res.status(400).json({ error: msg });
    }
    const { titulo, descricao, data_hora, local, bairro, cidade } = parsed.data;
    const evento = await prisma.evento.create({
      data: {
        campanha_id: (req as AuthedRequest).user!.campanha_id,
        titulo,
        descricao: descricao ?? null,
        data_hora: new Date(data_hora),
        local,
        bairro: bairro ?? null,
        cidade: cidade ?? null,
      }
    });
    res.status(201).json(evento);
  })
);

// PUT /api/eventos/:id
router.put(
  '/eventos/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const parsed = eventoUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e: any) => e.message).join('; ');
      return res.status(400).json({ error: msg });
    }
    const dono = await prisma.evento.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) },
      select: { id: true },
    });
    if (!dono) return res.status(404).json({ error: 'Evento não encontrado.' });
    const { titulo, descricao, data_hora, local, bairro, cidade } = parsed.data;
    const evento = await prisma.evento.update({
      where: { id: String(req.params.id) },
      data: {
        titulo,
        descricao: descricao !== undefined ? (descricao ?? null) : undefined,
        data_hora: data_hora ? new Date(data_hora) : undefined,
        local,
        bairro: bairro !== undefined ? (bairro ?? null) : undefined,
        cidade: cidade !== undefined ? (cidade ?? null) : undefined,
      }
    });
    res.json(evento);
  })
);

// DELETE /api/eventos/:id
router.delete(
  '/eventos/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const dono = await prisma.evento.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) },
      select: { id: true },
    });
    if (!dono) return res.status(404).json({ error: 'Evento não encontrado.' });
    await prisma.evento.delete({ where: { id: String(req.params.id) } });
    res.status(204).send();
  })
);

export default router;
