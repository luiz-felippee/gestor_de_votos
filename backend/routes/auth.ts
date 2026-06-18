import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prismaClient';
import { assinarToken, wrap, loginLimiter, requireAuth } from '../middlewares';

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
    let campanha_slug: string | null = null;
    if (usuario.campanha_id) {
      const c = await prisma.campanha.findUnique({
        where: { id: usuario.campanha_id },
        select: { nome: true, slug: true },
      });
      campanha_nome = c?.nome ?? null;
      campanha_slug = c?.slug ?? null;
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
        campanha_slug,
        super_admin: usuario.super_admin,
      },
    });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  wrap(async (req, res) => {
    // Query única: busca usuário + nome da campanha + cabo em um só round-trip
    const rows = await prisma.$queryRaw<Array<{
      id: string; nome: string; email: string; role: string;
      cabo_id: string | null; campanha_id: string | null;
      super_admin: boolean; campanha_nome: string | null;
      campanha_slug: string | null; cabo_nome: string | null;
    }>>`
      SELECT u.id, u.nome, u.email, u.role, u.cabo_id, u.campanha_id,
             u.super_admin,
             c.nome AS campanha_nome,
             c.slug AS campanha_slug,
             cb.nome AS cabo_nome
      FROM usuarios u
      LEFT JOIN campanhas c ON c.id = u.campanha_id
      LEFT JOIN cabos cb ON cb.id = u.cabo_id
      WHERE u.id = ${req.user!.id}
      LIMIT 1
    `;
    const u = rows[0];
    if (!u) return res.status(404).json({ error: 'Usuário não encontrado.' });

    res.json({
      usuario: {
        id: u.id,
        nome: u.nome,
        email: u.email,
        role: u.role,
        cabo_id: u.cabo_id,
        campanha_id: u.campanha_id,
        campanha_nome: u.campanha_nome,
        campanha_slug: u.campanha_slug,
        super_admin: u.super_admin,
        cabo: u.cabo_id ? { id: u.cabo_id, nome: u.cabo_nome } : null,
      },
    });
  })
);

export default authRouter;
