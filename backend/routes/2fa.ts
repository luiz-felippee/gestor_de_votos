import { Router } from 'express';
import { generateSecret, generateURI, verify } from 'otplib';
import qrcode from 'qrcode';
import { requireAuth, wrap } from '../middlewares';
import { prisma } from '../prismaClient';

const mfaRouter = Router();

// Endpoint para gerar um secret de 2FA e devolver o QR Code
mfaRouter.post(
  '/2fa/generate',
  requireAuth,
  wrap(async (req, res) => {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user!.id },
      select: { email: true, two_factor_enabled: true }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    if (usuario.two_factor_enabled) {
      return res.status(400).json({ error: '2FA já está ativado.' });
    }

    // Gera um novo segredo
    const secret = generateSecret();

    // URI no padrão OTPAuth para leitura no Google Authenticator / Authy
    const otpauth = generateURI({ issuer: 'Gestor de Votos', label: usuario.email, secret });
    
    // Gera o QR Code em Base64
    const qrCodeUrl = await qrcode.toDataURL(otpauth);

    // Salva o segredo temporário (a pessoa precisa confirmar no próximo request)
    await prisma.usuario.update({
      where: { id: req.user!.id },
      data: { two_factor_secret: secret }
    });

    res.json({
      secret, // É útil enviar o texto caso a pessoa queira digitar no app
      qrCodeUrl
    });
  })
);

// Endpoint para verificar o token e habilitar definitivamente o 2FA
mfaRouter.post(
  '/2fa/enable',
  requireAuth,
  wrap(async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token 2FA ausente.' });

    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user!.id },
      select: { two_factor_secret: true }
    });

    if (!usuario || !usuario.two_factor_secret) {
      return res.status(400).json({ error: 'Você precisa gerar o 2FA primeiro.' });
    }

    const isValid = (await verify({
      token,
      secret: usuario.two_factor_secret,
      epochTolerance: 30,
    })).valid;

    if (!isValid) {
      return res.status(400).json({ error: 'Token inválido. Tente novamente.' });
    }

    // Validação passou, liga o 2FA!
    await prisma.usuario.update({
      where: { id: req.user!.id },
      data: { two_factor_enabled: true }
    });

    res.json({ message: 'Autenticação em duas etapas ativada com sucesso!' });
  })
);

// Endpoint para desabilitar o 2FA
mfaRouter.post(
  '/2fa/disable',
  requireAuth,
  wrap(async (req, res) => {
    const { senha } = req.body;
    if (!senha) return res.status(400).json({ error: 'A senha é obrigatória para desativar o 2FA.' });

    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user!.id }
    });

    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado.' });

    // Exige a senha atual para garantir que não foi um computador deixado aberto
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(senha, usuario.senha_hash);
    
    if (!isMatch) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    await prisma.usuario.update({
      where: { id: req.user!.id },
      data: {
        two_factor_enabled: false,
        two_factor_secret: null
      }
    });

    res.json({ message: 'Autenticação em duas etapas desativada.' });
  })
);

export default mfaRouter;
