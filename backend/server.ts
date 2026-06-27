/**
 * Servidor principal do Gestor de Votos.
 *
 * Responsabilidades deste arquivo:
 *  - Configuração do Express (CORS, JSON, compression, static)
 *  - Socket.io (tempo real)
 *  - Montagem dos routers
 *  - Bootstrap (admin + campanha padrão)
 *
 * Middlewares de autenticação, autorização, rate-limiting e helpers compartilhados
 * ficam em ./middlewares/index.ts — os routers importam de lá diretamente.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { prisma } from './prismaClient';
import { logger } from './lib/logger';

// Re-exporta tudo dos middlewares para que qualquer import de './server' ainda funcione.
export { prisma };
export {
  requireAuth, requireRole, requireSuperAdmin, optionalAuth,
  cadastroLimiter, loginLimiter,
  escopoCampanha, eleitorNaCampanha,
  wrap, gerarSlug, registrarLog, assinarToken, completarToken,
  requirePlanLimit,
  type AuthedRequest, type TokenPayload,
} from './middlewares';

// Importa para uso local neste arquivo
import { verificarTokenSocket } from './middlewares';

// --- App Express ---
const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);

const CORS_LIST = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const CORS_ORIGIN: '*' | string[] = CORS_LIST.includes('*') ? '*' : CORS_LIST;

app.use(cors({ origin: CORS_ORIGIN }));

// Middleware de Logging estruturado para requisições HTTP
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('Request processed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      durationMs: Date.now() - start,
      ip: req.ip,
    });
  });
  next();
});

// --- Webhooks (Stripe precisa do body cru) ---
app.use('/api/webhook', express.raw({ type: 'application/json' }), require('./routes/webhook').default);

app.use(express.json());
app.use(compression());

// --- Arquivos estáticos de uploads ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// --- Tempo real (Socket.io) ---
const io = new SocketServer(httpServer, { cors: { origin: CORS_ORIGIN } });
export function notificarMudanca(campanhaId?: string | null) {
  if (campanhaId) {
    io.to(campanhaId).emit('eleitores:changed');
  } else {
    io.emit('eleitores:changed');
  }
}

// Cada cliente entra na "sala" da sua campanha para receber eventos isolados.
// Broadcasts globais (ex: eleitores:changed) seguem via io.emit.
io.on('connection', (socket) => {
  const token = (socket.handshake.auth as { token?: string } | undefined)?.token;
  if (!token) return;
  const payload = verificarTokenSocket(token);
  if (payload) socket.join(payload.campanha_id ?? 'global');
});

// --- Routers ---
app.use('/api/auth', require('./routes/auth').default);
app.use('/api/dashboard', require('./routes/dashboard').default);
app.use('/api', require('./routes/cabos').default);
app.use('/api', require('./routes/usuarios').default);
app.use('/api', require('./routes/campanhas').default);
app.use('/api', require('./routes/eleitores').default);
app.use('/api', require('./routes/billing').default);
app.use('/api', require('./routes/eventos').default);
app.use('/api', require('./routes/auditoria').default);
app.use('/api', require('./routes/upload').default);
app.use('/api/auth', require('./routes/2fa').default);

// --- Saúde ---
// Retorna estatísticas detalhadas de uso de memória, latência de banco e uptime.
app.get('/api/health', async (_req, res) => {
  const startDb = Date.now();
  let dbStatus = 'ok';
  let dbLatencyMs = 0;
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startDb;
  } catch (err: any) {
    dbStatus = 'acordando';
  }

  const memory = process.memoryUsage();
  const uptime = process.uptime();
  const cpu = process.cpuUsage();

  res.json({
    ok: true,
    version: '2026-06-27-features',
    runtime: 'node-dist',
    db: {
      status: dbStatus,
      latencyMs: dbLatencyMs > 0 ? dbLatencyMs : undefined,
    },
    uptimeSeconds: Math.floor(uptime),
    memoryUsageMB: {
      rss: Math.round(memory.rss / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      external: Math.round(memory.external / 1024 / 1024),
    },
    cpuUsage: {
      user: cpu.user,
      system: cpu.system,
    }
  });
});

// --- Bootstrap: cria/atualiza admin + campanha padrão ---
// Remove caracteres de controle, zero-width, BOM e no-break-space, depois apara espaços.
// Necessário porque copy-paste no painel do Render às vezes injeta caracteres invisíveis.
function sanitizeSenha(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 32 || c === 127 || (c >= 0x200B && c <= 0x200D) || c === 0xFEFF || c === 0xA0) continue;
    out += ch;
  }
  return out.trim();
}

async function bootstrap() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const email = ADMIN_EMAIL.toLowerCase().trim();
    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (!existe) {
      // Só na CRIAÇÃO usamos a senha do env (sanitizada contra lixo de copy-paste).
      const senha_hash = await bcrypt.hash(sanitizeSenha(ADMIN_PASSWORD), 10);
      await prisma.usuario.create({
        data: { nome: ADMIN_NAME || 'Administrador', email, senha_hash, role: 'admin', super_admin: true },
      });
      console.log(`✓ Admin criado: ${email}`);
    } else {
      // Admin já existe: PRESERVA a senha atual (não sobrescreve com o env, que pode estar
      // errado). Garante apenas role/super_admin. Troca de senha é feita dentro do app.
      await prisma.usuario.update({
        where: { email },
        data: { role: 'admin', super_admin: true },
      });
      console.log(`✓ Admin já existe: ${email} (senha preservada)`);
    }
  } else {
    logger.warn('ADMIN_EMAIL/ADMIN_PASSWORD não definidos — nenhum admin foi criado.');
  }

  // Multi-campanha: garante uma campanha padrão e adota os dados sem dono
  let campanhaPadrao = await prisma.campanha.findFirst();
  if (!campanhaPadrao) {
    campanhaPadrao = await prisma.campanha.create({
      data: { nome: 'Campanha Principal', slug: 'principal', plano: 'pro' },
    });
    logger.info('Campanha padrão criada', { campanhaId: campanhaPadrao.id });
  }
  const cid = campanhaPadrao.id;

  // A campanha principal (do dono) tem acesso total.
  // Novas campanhas criadas pelo painel nascem 'gratis' (modelo SaaS preservado).
  if (campanhaPadrao.plano === 'gratis') {
    await prisma.campanha.update({ where: { id: cid }, data: { plano: 'pro' } });
    logger.info('Campanha principal promovida ao plano pro.');
  }
  const [e, c, u, ev, lg] = await Promise.all([
    prisma.eleitor.updateMany({ where: { campanha_id: null }, data: { campanha_id: cid } }),
    prisma.caboEleitoral.updateMany({ where: { campanha_id: null }, data: { campanha_id: cid } }),
    prisma.usuario.updateMany({ where: { campanha_id: null }, data: { campanha_id: cid } }),
    prisma.evento.updateMany({ where: { campanha_id: null }, data: { campanha_id: cid } }),
    prisma.logAuditoria.updateMany({ where: { campanha_id: null }, data: { campanha_id: cid } }),
  ]);
  if (e.count + c.count + u.count + ev.count + lg.count > 0) {
    logger.info('Backfill de campanha executado', {
      eleitores: e.count,
      cabos: c.count,
      usuarios: u.count,
      eventos: ev.count,
      logs: lg.count,
    });
  }
}

// --- Inicialização ---
const PORT = Number(process.env.PORT) || 3000;
bootstrap()
  .then(async () => {
    httpServer.listen(PORT, () => {
      logger.info('Servidor iniciado com sucesso', { port: PORT });
    });
  })
  .catch((err) => {
    logger.error('Falha ao iniciar servidor', err);
    process.exit(1);
  });
