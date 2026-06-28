/**
 * Validação rigorosa de ambiente (Fail-Fast).
 * O servidor NÃO deve iniciar se as chaves críticas não estiverem presentes.
 */
import 'dotenv/config';

export const config = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

// Verificações rigorosas:
const missing: string[] = [];

if (!config.DATABASE_URL) missing.push('DATABASE_URL');
if (!config.JWT_SECRET) missing.push('JWT_SECRET');

if (missing.length > 0) {
  console.error('❌ ERRO CRÍTICO DE INICIALIZAÇÃO: Variáveis de ambiente obrigatórias ausentes:');
  missing.forEach((v) => console.error(`   - ${v}`));
  console.error('O servidor não pode iniciar sem essas chaves. Verifique seu arquivo .env.');
  process.exit(1);
}

// Stripe é "opcional" dependendo se o cara usa a versão free ou paga, mas vamos dar warning
if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
  console.warn('⚠️  AVISO: Chaves do Stripe (STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET) não configuradas. Pagamentos e assinaturas falharão.');
}
