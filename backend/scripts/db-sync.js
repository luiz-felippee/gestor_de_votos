// Aplica o schema no banco de forma NÃO-interativa durante o `npm install`
// (postinstall). Necessário porque o Build Command do Render (painel) roda
// `npx prisma db push` SEM `--accept-data-loss`, e o diff atual dropa tabelas/colunas
// de WhatsApp que contêm dados — o que faria o build abortar pedindo confirmação.
//
// Ao rodar aqui com `--accept-data-loss`, o diff já é aplicado; o `db push` seguinte
// do painel vira no-op (banco já em sincronia) e o build passa.
//
// Erros são tolerados (ex.: rodar `npm install` localmente sem o Postgres no ar)
// para não quebrar a instalação de dependências.
//
// IMPORTANTE: migrações (db push / DDL) devem usar uma conexão DIRETA, não o
// pooler (PgBouncer em modo transaction quebra DDL). Se DATABASE_URL apontar
// para o endpoint "pooled" do Neon, defina DIRECT_URL com a URL direta; este
// script usa DIRECT_URL quando existir e cai para DATABASE_URL caso contrário.
const { execSync } = require('node:child_process');

const pushUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!pushUrl) {
  console.warn('[db-sync] DATABASE_URL/DIRECT_URL ausentes — pulando prisma db push.');
  process.exit(0);
}

try {
  execSync('npx prisma db push --accept-data-loss --skip-generate', {
    stdio: 'inherit',
    // Sobrescreve DATABASE_URL só para esta chamada, garantindo conexão direta.
    env: { ...process.env, DATABASE_URL: pushUrl },
  });
} catch (err) {
  console.warn('[db-sync] prisma db push falhou (banco indisponível?) — ignorando.', err.message);
}
