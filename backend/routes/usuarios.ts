import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, wrap, escopoCampanha, registrarLog } from '../middlewares';
import { PerfilAcesso } from '@prisma/client';

const usuariosRouter = Router();

const PERFIS: PerfilAcesso[] = ['admin', 'coordenador', 'cabo', 'visualizador'];
const USUARIO_PUBLICO = {
  id: true,
  nome: true,
  email: true,
  role: true,
  cabo_id: true,
  created_at: true,
  cabo: { select: { id: true, nome: true } },
} as const;

usuariosRouter.get(
  '/usuarios',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const usuarios = await prisma.usuario.findMany({
      where: escopoCampanha(req),
      select: USUARIO_PUBLICO,
      orderBy: { nome: 'asc' },
    });
    res.json(usuarios);
  }),
);

usuariosRouter.post(
  '/usuarios',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const { nome, email, senha, role, cabo_id } = req.body ?? {};
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (role && !PERFIS.includes(role as PerfilAcesso)) {
      return res.status(400).json({ error: 'Perfil inválido.' });
    }
    try {
      const usuario = await prisma.usuario.create({
        data: {
          campanha_id: req.user!.campanha_id,
          nome: String(nome).trim(),
          email: String(email).toLowerCase().trim(),
          senha_hash: await bcrypt.hash(String(senha), 10),
          role: (role as PerfilAcesso) || 'visualizador',
          cabo_id: role === 'cabo' ? cabo_id || null : null,
        },
        select: USUARIO_PUBLICO,
      });
      registrarLog(req, 'criar', 'usuario', usuario.id, usuario.email);
      res.status(201).json(usuario);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Já existe um usuário com esse e-mail.' });
      }
      throw err;
    }
  }),
);

usuariosRouter.put(
  '/usuarios/:id',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const { nome, email, senha, role, cabo_id } = req.body ?? {};
    if (role && !PERFIS.includes(role as PerfilAcesso)) {
      return res.status(400).json({ error: 'Perfil inválido.' });
    }
    const alvo = await prisma.usuario.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) },
      select: { id: true },
    });
    if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado.' });
    try {
      const usuario = await prisma.usuario.update({
        where: { id: String(req.params.id) },
        data: {
          nome,
          email: email ? String(email).toLowerCase().trim() : undefined,
          role: role as PerfilAcesso,
          cabo_id: role === 'cabo' ? cabo_id || null : null,
          senha_hash: senha ? await bcrypt.hash(String(senha), 10) : undefined,
        },
        select: USUARIO_PUBLICO,
      });
      registrarLog(req, 'editar', 'usuario', String(req.params.id), usuario.email);
      res.json(usuario);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Já existe um usuário com esse e-mail.' });
      }
      throw err;
    }
  }),
);

usuariosRouter.delete(
  '/usuarios/:id',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'Você não pode excluir o próprio usuário.' });
    }
    const alvo = await prisma.usuario.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) },
      select: { id: true },
    });
    if (!alvo) return res.status(404).json({ error: 'Usuário não encontrado.' });
    await prisma.usuario.delete({ where: { id: String(req.params.id) } });
    registrarLog(req, 'excluir', 'usuario', String(req.params.id));
    res.status(204).send();
  }),
);

export default usuariosRouter;
