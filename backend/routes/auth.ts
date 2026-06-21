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

// --- Login com Google (Google Identity Services) ---
authRouter.post(
  '/google',
  loginLimiter,
  wrap(async (req, res) => {
    const { credential } = req.body ?? {};
    if (!credential) return res.status(400).json({ error: 'Token do Google ausente.' });

    // Valida o ID token diretamente no Google (verifica assinatura e expiração)
    let payload: any;
    try {
      const r = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(credential))}`,
      );
      if (!r.ok) throw new Error('invalid');
      payload = await r.json();
    } catch {
      return res.status(401).json({ error: 'Não foi possível validar o login do Google.' });
    }

    // Garante que o token foi emitido para ESTE app e que o e-mail é verificado
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (clientId && payload.aud !== clientId) {
      return res.status(401).json({ error: 'Login do Google não corresponde a este aplicativo.' });
    }
    if (String(payload.email_verified) !== 'true') {
      return res.status(401).json({ error: 'E-mail do Google não verificado.' });
    }

    const email = String(payload.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'O Google não retornou um e-mail.' });

    // Só permite entrar quem já é usuário cadastrado (segurança da base)
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      return res.status(403).json({
        error: 'Este e-mail não tem acesso. Peça ao administrador para cadastrá-lo.',
      });
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
  }),
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
// --- Recuperação de Senha ---
import crypto from 'crypto';
import { enviarEmail, templateResetSenha } from '../lib/email';

authRouter.post(
  '/esqueci-senha',
  wrap(async (req, res) => {
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ error: 'Informe seu e-mail.' });

    const usuario = await prisma.usuario.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });

    if (!usuario) {
      // Retorna sucesso de qualquer forma por segurança (para não enumerar emails válidos)
      return res.json({ message: 'Se o e-mail existir, um link de recuperação foi enviado.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + 1000 * 60 * 60); // 1 hora de validade

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        reset_token: token,
        reset_token_expires: expiraEm,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/resetar-senha?token=${token}`;

    // Envia o e-mail real (Resend). Sem RESEND_API_KEY, o helper apenas loga (dev).
    await enviarEmail({
      to: usuario.email,
      subject: 'Redefinir sua senha — Gestor de Votos',
      html: templateResetSenha(usuario.nome, resetLink),
    });
    console.log(`🔗 [reset-senha] ${usuario.email} -> ${resetLink}`);

    res.json({ message: 'Se o e-mail existir, um link de recuperação foi enviado.' });
  })
);

authRouter.post(
  '/resetar-senha',
  wrap(async (req, res) => {
    const { token, senha } = req.body ?? {};
    if (!token || !senha) return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });

    const usuario = await prisma.usuario.findFirst({
      where: {
        reset_token: String(token),
        reset_token_expires: { gt: new Date() }, // O token não pode ter expirado
      },
    });

    if (!usuario) {
      return res.status(400).json({ error: 'Token inválido ou expirado.' });
    }

    const novaSenhaHash = await bcrypt.hash(String(senha), 10);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senha_hash: novaSenhaHash,
        reset_token: null, // Limpa o token para não ser reutilizado
        reset_token_expires: null,
      },
    });

    res.json({ message: 'Senha alterada com sucesso! Faça login com a nova senha.' });
  })
);
export default authRouter;
