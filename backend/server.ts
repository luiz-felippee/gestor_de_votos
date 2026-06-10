import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { initWhatsApp, getWhatsAppStatus, sendWhatsAppMessage, sendWhatsAppMediaFile } from './whatsapp';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { type PerfilAcesso, type StatusEleitor } from '@prisma/client';
import cron from 'node-cron';
import { prisma } from './prismaClient';

// Reexporta a instância única do Prisma (a mesma usada pelos routers em
// ./prismaClient) para o código que ainda importa de ./server.
export { prisma };

// Os routers são montados mais abaixo (via require), depois que os helpers
// compartilhados (wrap, requireAuth, registrarLog, etc.) já foram definidos —
// caso contrário a dependência circular entrega esses valores como undefined.
const app = express();
// Render/Netlify ficam atrás de proxy — necessário para o rate limit ler o IP real
app.set('trust proxy', 1);
const httpServer = createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const CORS_LIST = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
// '*' libera qualquer origem; caso contrário, casa exatamente com a lista.
// (a lib de CORS, ao receber um array, faz comparação exata — '*' dentro de
//  array NÃO funciona como curinga, por isso o tratamento explícito abaixo)
const CORS_ORIGIN: '*' | string[] = CORS_LIST.includes('*') ? '*' : CORS_LIST;

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json())
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

// Limite de cadastros públicos por IP (anti-spam/robô): 8 por minuto
export const cadastroLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitos cadastros em sequência. Aguarde um minuto e tente de novo.',
  },
});

// Anti força-bruta no login: 10 tentativas por IP a cada 5 minutos
export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
  },
});

// --- Tempo real (Socket.io) ---
const io = new SocketServer(httpServer, { cors: { origin: CORS_ORIGIN } });
export function notificarMudanca() {
  io.emit('eleitores:changed');
}

// --- Tipos e autenticação ---
interface TokenPayload {
  id: string;
  nome: string;
  role: PerfilAcesso;
  cabo_id: string | null;
  campanha_id: string | null;
  super_admin: boolean;
}
export interface AuthedRequest extends Request {
  user?: TokenPayload;
}

export function assinarToken(u: {
  id: string;
  nome: string;
  role: PerfilAcesso;
  cabo_id: string | null;
  campanha_id: string | null;
  super_admin: boolean;
}) {
  return jwt.sign(
    {
      id: u.id,
      nome: u.nome,
      role: u.role,
      cabo_id: u.cabo_id,
      campanha_id: u.campanha_id,
      super_admin: u.super_admin,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

// Completa tokens antigos (emitidos antes do multi-campanha) com dados do banco.
export async function completarToken(p: TokenPayload): Promise<void> {
  if (p.super_admin === undefined || p.campanha_id === undefined) {
    const u = await prisma.usuario.findUnique({
      where: { id: p.id },
      select: { campanha_id: true, super_admin: true },
    });
    p.campanha_id = u?.campanha_id ?? null;
    p.super_admin = u?.super_admin ?? false;
  }
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    await completarToken(payload);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida.' });
  }
}

export function requireRole(...roles: PerfilAcesso[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação.' });
    }
    next();
  };
}

// Só o super-admin (gerencia as campanhas/candidatos).
export function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.super_admin) {
    return res.status(403).json({ error: 'Ação exclusiva do super-admin.' });
  }
  next();
}

export function gerarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

// Auth opcional: se vier um token válido, popula req.user; senão segue (público).
export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
      await completarToken(payload);
      req.user = payload;
    } catch {
      /* token inválido → trata como público */
    }
  }
  next();
}

// Isolamento multi-campanha: super-admin enxerga tudo; os demais, só a sua campanha.
// (Para o perfil 'cabo', some-se também o filtro do próprio cabo onde fizer sentido.)
export function escopoCampanha(req: AuthedRequest): Record<string, unknown> {
  if (req.user?.super_admin) return {};
  return { campanha_id: req.user?.campanha_id ?? '__sem_campanha__' };
}

// Confere se um eleitor pertence à campanha do usuário (antes de editar/excluir).
export async function eleitorNaCampanha(req: AuthedRequest, id: string): Promise<boolean> {
  const e = await prisma.eleitor.findFirst({
    where: { id, ...escopoCampanha(req) },
    select: { id: true },
  });
  return Boolean(e);
}

export const wrap =
  (handler: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) =>
    handler(req as AuthedRequest, res).catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    });

// (PUT /api/campanhas/:id agora vive em routes/campanhas.ts)

// Registra uma ação no log de auditoria (nunca quebra a operação principal)
export function registrarLog(
  req: AuthedRequest,
  acao: string,
  entidade: string,
  entidade_id?: string,
  detalhe?: string,
) {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    null;
  prisma.logAuditoria
    .create({
      data: {
        campanha_id: req.user?.campanha_id ?? null,
        usuario_id: req.user?.id ?? null,
        usuario_nome: req.user?.nome ?? null,
        acao,
        entidade,
        entidade_id: entidade_id ?? null,
        detalhe: detalhe ?? null,
        ip,
      },
    })
    .catch((e) => console.error('Falha ao registrar log de auditoria:', e));
}

// --- Routers (montados aqui, depois dos helpers, para evitar a dependência
//     circular: os routers importam wrap/requireAuth/etc. de ./server) ---
app.use('/api/auth', require('./routes/auth').default);
app.use('/api/dashboard', require('./routes/dashboard').default);
app.use('/api', require('./routes/cabos').default);
app.use('/api', require('./routes/usuarios').default);
app.use('/api', require('./routes/campanhas').default);
app.use('/api', require('./routes/eleitores').default);

// --- Saúde ---
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, version: '2026-06-10-routers2', runtime: 'node-dist' }),
);

// --- Upload Genérico ---
app.post('/api/upload', upload.single('foto'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
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

// --- Configurações do WhatsApp ---
app.get(
  '/api/config/whatsapp',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    let config = await prisma.configuracaoWhatsApp.findUnique({ where: { id: 'singleton' } });
    if (!config) {
      config = await prisma.configuracaoWhatsApp.create({
        data: { id: 'singleton', modo: 'nenhum' }
      });
    }
    res.json(config);
  })
);

app.put(
  '/api/config/whatsapp',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const b = req.body ?? {};
    const config = await prisma.configuracaoWhatsApp.upsert({
      where: { id: 'singleton' },
      update: {
        modo: b.modo,
        api_url: b.api_url,
        api_token: b.api_token,
        api_instancia_id: b.api_instancia_id
      },
      create: {
        id: 'singleton',
        modo: b.modo || 'nenhum',
        api_url: b.api_url,
        api_token: b.api_token,
        api_instancia_id: b.api_instancia_id
      }
    });
    
    // Se mudou para modo interno, inicializa
    if (config.modo === 'interno') {
      initWhatsApp(io).catch(console.error);
    }
    
    res.json(config);
  })
);

app.get(
  '/api/whatsapp/status',
  requireAuth,
  wrap(async (req, res) => {
    const config = await prisma.configuracaoWhatsApp.findUnique({ where: { id: 'singleton' } });
    if (config?.modo === 'interno') {
      return res.json(getWhatsAppStatus());
    }
    if (config?.modo === 'zapi' || config?.modo === 'evolution') {
      return res.json({ status: 'conectado', tipo: 'externo' });
    }
    res.json({ status: 'desconectado' });
  })
);

app.post(
  '/api/whatsapp/send',
  requireAuth,
  wrap(async (req, res) => {
    const { numero, texto, tipo = 'text', url_midia } = req.body;
    if (!numero) return res.status(400).json({ error: 'Número é obrigatório.' });
    if (tipo === 'text' && !texto) return res.status(400).json({ error: 'Texto é obrigatório.' });
    if (tipo !== 'text' && !url_midia) return res.status(400).json({ error: 'URL da mídia é obrigatória.' });

    const config = await prisma.configuracaoWhatsApp.findUnique({ where: { id: 'singleton' } });
    
    if (config?.modo === 'interno') {
      await sendWhatsAppMessage(numero, texto || '', tipo, url_midia);
      return res.json({ success: true });
    } 
    
    if (config?.modo === 'zapi' && config.api_url && config.api_token) {
      // Simulação de envio Z-API
      let endpoint = '/send-text';
      let body: any = { phone: `55${numero}` };
      
      if (tipo === 'image') {
        endpoint = '/send-image';
        body.image = url_midia;
        if (texto) body.caption = texto;
      } else if (tipo === 'video') {
        endpoint = '/send-video';
        body.video = url_midia;
        if (texto) body.caption = texto;
      } else if (tipo === 'audio') {
        endpoint = '/send-audio';
        body.audio = url_midia;
      } else {
        body.message = texto;
      }

      const response = await fetch(`${config.api_url}${endpoint}`, {
        method: 'POST',
        headers: { 'Client-Token': config.api_token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error("Erro na API Externa Z-API");
      return res.json({ success: true });
    }

    res.status(400).json({ error: 'Nenhuma configuração de WhatsApp ativa.' });
  })
);

// --- Upload de arquivo real (foto/vídeo/áudio do computador) ---
app.post(
  '/api/whatsapp/send-media',
  requireAuth,
  upload.single('arquivo'),
  wrap(async (req, res) => {
    const { numero, texto, tipo } = req.body;
    const file = req.file;
    if (!numero) return res.status(400).json({ error: 'Número é obrigatório.' });
    if (!file) return res.status(400).json({ error: 'Arquivo é obrigatório.' });

    const config = await prisma.configuracaoWhatsApp.findUnique({ where: { id: 'singleton' } });

    try {
      if (config?.modo === 'interno') {
        await sendWhatsAppMediaFile(numero, file.path, file.mimetype, texto || '', tipo || 'image');
        return res.json({ success: true });
      }

      if (config?.modo === 'zapi' && config.api_url && config.api_token) {
        // Z-API aceita base64
        const fileBuffer = fs.readFileSync(file.path);
        const base64 = fileBuffer.toString('base64');
        let endpoint = '/send-image';
        const body: any = { phone: `55${numero}` };

        if (tipo === 'image') {
          endpoint = '/send-image';
          body.image = `data:${file.mimetype};base64,${base64}`;
          if (texto) body.caption = texto;
        } else if (tipo === 'video') {
          endpoint = '/send-video';
          body.video = `data:${file.mimetype};base64,${base64}`;
          if (texto) body.caption = texto;
        } else if (tipo === 'audio') {
          endpoint = '/send-audio';
          body.audio = `data:${file.mimetype};base64,${base64}`;
        } else {
          body.message = texto;
          endpoint = '/send-text';
        }

        const response = await fetch(`${config.api_url}${endpoint}`, {
          method: 'POST',
          headers: { 'Client-Token': config.api_token, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error('Erro na API Externa Z-API');
        return res.json({ success: true });
      }

      res.status(400).json({ error: 'Nenhuma configuração de WhatsApp ativa.' });
    } finally {
      // Limpa o arquivo temporário
      try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
    }
  })
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
        campanha_id: req.user!.campanha_id,
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

// --- Inicialização: cria/atualiza o admin a partir das variáveis de ambiente ---
async function bootstrap() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const email = ADMIN_EMAIL.toLowerCase().trim();
    // Cria o admin só se ainda não existir — assim a senha definida pelo próprio
    // usuário (na tela de Usuários) NÃO é sobrescrita a cada deploy.
    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (!existe) {
      const senha_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await prisma.usuario.create({
        data: { nome: ADMIN_NAME || 'Administrador', email, senha_hash, role: 'admin' },
      });
      console.log(`✓ Admin criado: ${email}`);
    } else {
      console.log(`✓ Admin já existe: ${email} (senha preservada)`);
    }
    // O admin definido por env vira super-admin (gerencia as campanhas)
    await prisma.usuario.updateMany({ where: { email }, data: { super_admin: true } });
  }

  // --- Multi-campanha: garante uma campanha padrão e adota os dados sem dono ---
  let campanhaPadrao = await prisma.campanha.findFirst();
  if (!campanhaPadrao) {
    campanhaPadrao = await prisma.campanha.create({
      data: { nome: 'Campanha Principal', slug: 'principal' },
    });
    console.log('✓ Campanha padrão criada:', campanhaPadrao.id);
  }
  const cid = campanhaPadrao.id;
  // Backfill: tudo que ainda não tem campanha vai para a campanha padrão
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

// --- Automação de Aniversários ---
function startCronJobs() {
  // Roda todos os dias às 09:00 (hora local do servidor)
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Iniciando rotina de aniversários...');
    try {
      // Data atual no formato DD/MM
      const hoje = new Date();
      const dia = hoje.getDate().toString().padStart(2, '0');
      const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
      const prefixoData = `${dia}/${mes}`;

      const aniversariantes = await prisma.eleitor.findMany({
        where: {
          data_nascimento: {
            startsWith: prefixoData
          },
          status: 'ativo'
        }
      });

      console.log(`[CRON] Encontrados ${aniversariantes.length} aniversariantes hoje (${prefixoData}).`);

      // Verifica configuração de WhatsApp (exemplo lógico)
      const config = await prisma.configuracaoWhatsApp.findUnique({ where: { id: 'singleton' } });
      
      if (!config || config.modo === 'nenhum') {
        console.log('[CRON] WhatsApp não configurado. Nenhuma mensagem será enviada.');
        return;
      }

      for (let i = 0; i < aniversariantes.length; i++) {
        const eleitor = aniversariantes[i];
        if (!eleitor.telefone) continue;

        const numero = eleitor.telefone.replace(/\D/g, '');
        const primeiroNome = eleitor.nome.split(' ')[0];
        const texto = `Olá ${primeiroNome}! O Sistema Gestor de Votos te deseja um feliz aniversário! Que seu dia seja muito especial. 🎉🎂`;

        try {
          await sendWhatsAppMessage(numero, texto, 'text');
          console.log(`[CRON] Mensagem enviada para ${primeiroNome} (${numero})`);
        } catch (err) {
          console.error(`[CRON] Falha ao enviar para ${numero}:`, err);
        }

        // Delay para não tomar ban
        if (i < aniversariantes.length - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    } catch (err) {
      console.error('[CRON] Erro na rotina de aniversários:', err);
    }
  });
  console.log('✓ Cron jobs agendados.');
}

const PORT = Number(process.env.PORT) || 3000;
bootstrap()
  .catch((err) => console.error('Falha no bootstrap:', err.message))
  .finally(async () => {
    // Inicia o WhatsApp Interno se estiver configurado
    try {
      startCronJobs();
      const config = await prisma.configuracaoWhatsApp.findUnique({ where: { id: 'singleton' } });
      if (config?.modo === 'interno') {
        initWhatsApp(io).catch(console.error);
      }
    } catch (e) {
      console.error("Erro ao verificar config do whatsapp na inicialização", e);
    }

    httpServer.listen(PORT, () => {
      console.log(`✓ API do Gestor de Votos rodando na porta ${PORT}`);
    });
  });
