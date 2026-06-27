import { Router } from 'express';
import Stripe from 'stripe';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, wrap } from '../middlewares';

const billingRouter = Router();

// Configure a chave na Vercel / Render / .env local
// @ts-ignore
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2025-02-24.acacia',
} as any);

// ID do preço no Stripe (ex: price_12345)
// Em produção, isso deve vir do banco ou do .env dependendo do plano escolhido.
const STRIPE_PRICE_BASICO = process.env.STRIPE_PRICE_BASICO || 'price_mock_basico';
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO || 'price_mock_pro';

// 1. Criar Checkout Session (quando o usuário clica em "Assinar")
billingRouter.post(
  '/billing/checkout',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const { planoId } = req.body; // 'basico' ou 'pro'
    const campanha_id = req.user!.campanha_id;

    if (!campanha_id) return res.status(400).json({ error: 'Você precisa estar em uma campanha.' });

    const campanha = await prisma.campanha.findUnique({
      where: { id: campanha_id },
    });

    if (!campanha) return res.status(404).json({ error: 'Campanha não encontrada.' });

    const priceId = planoId === 'pro' ? STRIPE_PRICE_PRO : STRIPE_PRICE_BASICO;

    // URL de retorno pro frontend
    const originUrl = req.headers.origin || 'http://localhost:5173';

    // Cria sessão do Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer: campanha.stripe_customer_id || undefined,
      client_reference_id: campanha.id, // O ID da campanha, útil no webhook
      success_url: `${originUrl}/assinatura?success=true`,
      cancel_url: `${originUrl}/assinatura?canceled=true`,
      metadata: {
        campanha_id: campanha.id,
        plano: planoId
      }
    });

    res.json({ url: session.url });
  })
);

// 2. Portal do Cliente (para cancelar ou mudar cartão)
billingRouter.post(
  '/billing/portal',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const campanha_id = req.user!.campanha_id;
    if (!campanha_id) return res.status(400).json({ error: 'Campanha inválida' });

    const campanha = await prisma.campanha.findUnique({ where: { id: campanha_id } });
    if (!campanha?.stripe_customer_id) {
      return res.status(400).json({ error: 'Você ainda não possui assinatura.' });
    }

    const originUrl = req.headers.origin || 'http://localhost:5173';
    
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: campanha.stripe_customer_id,
      return_url: `${originUrl}/assinatura`,
    });

    res.json({ url: portalSession.url });
  })
);

export default billingRouter;
