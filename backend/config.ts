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

// Após a checagem acima, estas chaves estão GARANTIDAMENTE presentes — reexporta com
// tipo `string` pra que o resto do código não precise do fallback inseguro
// `process.env.JWT_SECRET || 'dev-secret'` (que deixaria qualquer um forjar tokens).
export const JWT_SECRET: string = config.JWT_SECRET as string;
export const DATABASE_URL: string = config.DATABASE_URL as string;

// Aviso se o segredo do JWT parece um placeholder de dev indo pra produção: token
// forjável se vazar. Não derruba o boot (o dev local usa um), só alerta bem alto.
if (process.env.NODE_ENV === 'production' && (JWT_SECRET.length < 32 || /dev|troque|secret|changeme/i.test(JWT_SECRET))) {
  console.warn('⚠️  ATENÇÃO: JWT_SECRET parece fraco/placeholder em PRODUÇÃO. Gere um segredo aleatório longo (ex.: openssl rand -hex 32).');
}

// Stripe é "opcional" dependendo se o cara usa a versão free ou paga, mas vamos dar warning
if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
  console.warn('⚠️  AVISO: Chaves do Stripe (STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET) não configuradas. Pagamentos e assinaturas falharão.');
}
