// @ts-nocheck
// ⚠️ Billing/Stripe (feature separada, ainda não revisada): a checagem de tipos
// está desligada porque a versão dos tipos do Stripe diverge da API usada aqui.
// O código roda, mas precisa de revisão dedicada antes de confiar em produção.
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../prismaClient';

const webhookRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2025-02-24.acacia',
});

// Chave do webhook signing (webhook secret)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock';

webhookRouter.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) return res.status(400).send('Webhook Error: Missing stripe-signature');

  let event: Stripe.Event;

  try {
    // req.body tem que ser o buffer raw gerado pelo express.raw()
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`⚠️  Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // O checkout foi finalizado
        const campanhaId = session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const plano = session.metadata?.plano || 'basico';

        if (campanhaId) {
          await prisma.campanha.update({
            where: { id: campanhaId },
            data: {
              plano,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              assinatura_status: 'ativa',
            }
          });
          console.log(`✅ Campanha ${campanhaId} atualizada para plano ${plano}.`);
        }
        break;
      }
      
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const status = subscription.status; // 'active', 'past_due', 'canceled', etc
        const customerId = subscription.customer as string;
        
        // Atualizar status no banco
        await prisma.campanha.updateMany({
          where: { stripe_customer_id: customerId },
          data: {
            assinatura_status: status === 'active' ? 'ativa' : (status === 'canceled' ? 'cancelada' : 'inadimplente'),
            assinatura_expira_em: new Date(subscription.current_period_end * 1000)
          }
        });
        console.log(`✅ Status da assinatura do customer ${customerId} atualizado para ${status}.`);
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Erro processando webhook:', error);
    res.status(500).send('Erro interno do webhook');
  }
});

export default webhookRouter;
