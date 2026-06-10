import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prismaClient';
import { assinarToken, wrap, loginLimiter, requireAuth } from '../server';

const authRouter = Router();

// --- Autenticação ---
authRouter.post(
  '/login',
  loginLimiter,
  wrap(async (req, res) => {
    const { email, senha } = req.body ?? {};
    if (!email || !senha) return res.status(400).json({ error: 'Informe e-mail e senha.' });

    const usuario = await prisma.usuario.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }
    const token = assinarToken(usuario);
    let campanha_nome: string | null = null;
    if (usuario.campanha_id) {
      const c = await prisma.campanha.findUnique({
        where: { id: usuario.campanha_id },
        select: { nome: true },
      });
      campanha_nome = c?.nome ?? null;
    }
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        role: usuario.role,
        cabo_id: usuario.cabo_id,
        campanha_id: usuario.campanha_id,
        campanha_nome,
        super_admin: usuario.super_admin,
      },
    });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    const u = await prisma.usuario.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        cabo_id: true,
        campanha_id: true,
        super_admin: true,
        cabo: { select: { id: true, nome: true } },
      },
    });
    if (!u) return res.status(404).json({ error: 'Usuário não encontrado.' });

    let campanha_nome: string | null = null;
    if (u.campanha_id) {
      const c = await prisma.campanha.findUnique({
        where: { id: u.campanha_id },
        select: { nome: true },
      });
      campanha_nome = c?.nome ?? null;
    }
    res.json({
      id: u.id,
      nome: u.nome,
      email: u.email,
      role: u.role,
      cabo_id: u.cabo_id,
      campanha_id: u.campanha_id,
      campanha_nome,
      super_admin: u.super_admin,
      cabo: u.cabo,
    });
  })
);

export default authRouter;
