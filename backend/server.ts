/**
 * Servidor principal do Gestor de Votos.
 *
 * Responsabilidades deste arquivo:
 *  - Configuração do Express (CORS, JSON, compression, static, multer)
 *  - Socket.io (tempo real)
 *  - Montagem dos routers
 *  - Rotas inline que dependem do `io` (eventos, auditoria, upload)
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
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { prisma } from './prismaClient';

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
import {
  requireAuth, requireRole,
  escopoCampanha, wrap,
  verificarTokenSocket,
  type AuthedRequest,
} from './middlewares';

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

// --- Webhooks (Stripe precisa do body cru) ---
app.use('/api/webhook', express.raw({ type: 'application/json' }), require('./routes/webhook').default);

app.use(express.json());
app.use(compression());

// --- Upload de mídias (multer) ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    }
  }),
  limits: { fileSize: 64 * 1024 * 1024 } // 64 MB max
});

// --- Tempo real (Socket.io) ---
const io = new SocketServer(httpServer, { cors: { origin: CORS_ORIGIN } });
export function notificarMudanca() {
  io.emit('eleitores:changed');
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

// --- Saúde ---
// Toca o banco (SELECT 1) para manter o Neon (free, scale-to-zero) acordado
// junto com o Render. Retorna ok mesmo se o banco estiver acordando.
app.get('/api/health', async (_req, res) => {
  let db = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = 'acordando';
  }
  res.json({ ok: true, version: '2026-06-26-final', runtime: 'node-dist', db });
});

// --- Upload Genérico (autenticado + validação de tipo) ---
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
app.post('/api/upload', requireAuth, upload.single('foto'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }
  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
    try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
    return res.status(400).json({ error: 'Tipo de arquivo não permitido. Envie apenas imagens (JPG, PNG, WebP, GIF).' });
  }
  res.json({ url: `/uploads/${req.file.filename}` });
});

// --- Log de auditoria (somente admin) ---
app.get(
  '/api/auditoria',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const logs = await prisma.logAuditoria.findMany({
      where: escopoCampanha(req),
      orderBy: { created_at: 'desc' },
      take: 300,
    });
    res.json(logs);
  }),
);

// --- Eventos (Agenda de Reuniões) ---
app.get(
  '/api/eventos',
  requireAuth,
  wrap(async (req, res) => {
    const eventos = await prisma.evento.findMany({
      where: escopoCampanha(req),
      orderBy: { data_hora: 'asc' },
    });
    res.json(eventos);
  })
);

app.post(
  '/api/eventos',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const { titulo, descricao, data_hora, local, bairro, cidade } = req.body ?? {};
    if (!titulo || !data_hora || !local) {
      return res.status(400).json({ error: 'Título, data/hora e local são obrigatórios.' });
    }
    const evento = await prisma.evento.create({
      data: {
        campanha_id: (req as AuthedRequest).user!.campanha_id,
        titulo: String(titulo),
        descricao: descricao ? String(descricao) : null,
        data_hora: new Date(data_hora),
        local: String(local),
        bairro: bairro ? String(bairro) : null,
        cidade: cidade ? String(cidade) : null,
      }
    });
    res.status(201).json(evento);
  })
);

app.put(
  '/api/eventos/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const { titulo, descricao, data_hora, local, bairro, cidade } = req.body ?? {};
    const dono = await prisma.evento.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) },
      select: { id: true },
    });
    if (!dono) return res.status(404).json({ error: 'Evento não encontrado.' });
    const evento = await prisma.evento.update({
      where: { id: String(req.params.id) },
      data: {
        titulo: titulo ? String(titulo) : undefined,
        descricao: descricao !== undefined ? String(descricao) : undefined,
        data_hora: data_hora ? new Date(data_hora) : undefined,
        local: local ? String(local) : undefined,
        bairro: bairro !== undefined ? String(bairro) : undefined,
        cidade: cidade !== undefined ? String(cidade) : undefined,
      }
    });
    res.json(evento);
  })
);

app.delete(
  '/api/eventos/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const dono = await prisma.evento.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) },
      select: { id: true },
    });
    if (!dono) return res.status(404).json({ error: 'Evento não encontrado.' });
    await prisma.evento.delete({ where: { id: String(req.params.id) } });
    res.status(204).send();
  })
);

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
    console.warn('⚠️ ADMIN_EMAIL/ADMIN_PASSWORD não definidos — nenhum admin foi criado.');
  }

  // Multi-campanha: garante uma campanha padrão e adota os dados sem dono
  let campanhaPadrao = await prisma.campanha.findFirst();
  if (!campanhaPadrao) {
    campanhaPadrao = await prisma.campanha.create({
      data: { nome: 'Campanha Principal', slug: 'principal', plano: 'pro' },
    });
    console.log('✓ Campanha padrão criada:', campanhaPadrao.id);
  }
  const cid = campanhaPadrao.id;

  // A campanha principal (do dono) tem acesso total.
  // Novas campanhas criadas pelo painel nascem 'gratis' (modelo SaaS preservado).
  if (campanhaPadrao.plano === 'gratis') {
    await prisma.campanha.update({ where: { id: cid }, data: { plano: 'pro' } });
    console.log('✓ Campanha principal promovida ao plano pro.');
  }
  const [e, c, u, ev, lg] = await Promise.all([
    prisma.eleitor.updateMany({ where: { campanha_id: null }, data: { campanha_id: cid } }),
    prisma.caboEleitoral.updateMany({ where: { campanha_id: null }, data: { campanha_id: cid } }),
    prisma.usuario.updateMany({ where: { campanha_id: null }, data: { campanha_id: cid } }),
    prisma.evento.updateMany({ where: { campanha_id: null }, data: { campanha_id: cid } }),
    prisma.logAuditoria.updateMany({ where: { campanha_id: null }, data: { campanha_id: cid } }),
  ]);
  if (e.count + c.count + u.count + ev.count + lg.count > 0) {
    console.log(
      `✓ Backfill de campanha: eleitores=${e.count} cabos=${c.count} usuarios=${u.count} eventos=${ev.count} logs=${lg.count}`,
    );
  }
}

// --- Inicialização ---
const PORT = Number(process.env.PORT) || 3000;
bootstrap()
  .then(async () => {
    httpServer.listen(PORT, () => {
      console.log(`✓ API do Gestor de Votos rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Falha crítica na inicialização do backend:', err.message);
    process.exit(1);
  });
