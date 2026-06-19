/**
 * Servidor principal do Gestor de Votos.
 *
 * Responsabilidades deste arquivo:
 *  - Configuração do Express (CORS, JSON, compression, static, multer)
 *  - Socket.io (tempo real)
 *  - Montagem dos routers
 *  - Rotas inline que dependem do `io` (WhatsApp, eventos, auditoria, upload)
 *  - Bootstrap (admin + campanha padrão)
 *  - Cron jobs (aniversários)
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
import { initWhatsApp, getWhatsAppStatus, sendWhatsAppMessage, sendWhatsAppMediaFile } from './whatsapp';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import cron from 'node-cron';
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
  verificarTokenSocket, requirePlanLimit,
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

// Cada cliente entra na "sala" da sua campanha para receber eventos isolados
// (mensagens do WhatsApp, QR Code, status). Broadcasts globais seguem via io.emit.
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
app.use('/api', require('./routes/funis').default);

// --- Saúde ---
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, version: '2026-06-18-funnels', runtime: 'node-dist' }),
);

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

// --- Configurações do WhatsApp ---
app.get(
  '/api/whatsapp/config',
  requireAuth,
  wrap(async (req, res) => {
    let config = await prisma.configuracaoWhatsApp.findFirst({
      where: { campanha_id: req.user!.campanha_id ?? 'global' }
    });
    res.json(config || { modo: 'nenhum' });
  })
);

app.post(
  '/api/whatsapp/config',
  requireAuth,
  wrap(async (req, res) => {
    const b = req.body ?? {};
    const campanha_id = req.user!.campanha_id ?? 'global';
    
    const dados = {
      modo: b.modo || 'nenhum',
      api_url: b.api_url,
      api_token: b.api_token,
      api_instancia_id: b.api_instancia_id,
      msg_boas_vindas: b.msg_boas_vindas ?? null,
      ativar_chatbot: b.ativar_chatbot ?? false,
      usar_ia: b.usar_ia ?? false,
      ia_prompt: b.ia_prompt ?? null,
    };
    const existente = await prisma.configuracaoWhatsApp.findFirst({ where: { campanha_id } });
    const config = existente
      ? await prisma.configuracaoWhatsApp.update({ where: { id: existente.id }, data: dados })
      : await prisma.configuracaoWhatsApp.create({ data: { campanha_id, ...dados } });
    
    if (config.modo === 'interno') {
      initWhatsApp(io, campanha_id).catch(console.error);
    }
    
    res.json(config);
  })
);

app.get(
  '/api/whatsapp/status',
  requireAuth,
  wrap(async (req, res) => {
    const campanha_id = req.user!.campanha_id ?? 'global';
    const config = await prisma.configuracaoWhatsApp.findFirst({ where: { campanha_id } });
    if (config?.modo === 'interno') {
      return res.json(getWhatsAppStatus(campanha_id));
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
  requirePlanLimit('whatsapp'),
  wrap(async (req, res) => {
    const { numero, texto, tipo = 'text', url_midia } = req.body;
    if (!numero) return res.status(400).json({ error: 'Número é obrigatório.' });
    if (tipo === 'text' && !texto) return res.status(400).json({ error: 'Texto é obrigatório.' });
    if (tipo !== 'text' && !url_midia) return res.status(400).json({ error: 'URL da mídia é obrigatória.' });

    const campanha_id = req.user!.campanha_id ?? 'global';
    const config = await prisma.configuracaoWhatsApp.findFirst({ where: { campanha_id } });
    
    if (config?.modo === 'interno') {
      await sendWhatsAppMessage(campanha_id, numero, texto || '', tipo, url_midia);
      return res.json({ success: true });
    } 
    
    if (config?.modo === 'zapi' && config.api_url && config.api_token) {
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

app.post(
  '/api/whatsapp/send-media',
  requireAuth,
  requirePlanLimit('whatsapp'),
  upload.single('arquivo'),
  wrap(async (req, res) => {
    const { numero, texto, tipo } = req.body;
    const file = req.file;
    if (!numero) return res.status(400).json({ error: 'Número é obrigatório.' });
    if (!file) return res.status(400).json({ error: 'Arquivo é obrigatório.' });

    const campanha_id = req.user!.campanha_id ?? 'global';
    const config = await prisma.configuracaoWhatsApp.findFirst({ where: { campanha_id } });

    try {
      if (config?.modo === 'interno') {
        await sendWhatsAppMediaFile(campanha_id, numero, file.path, file.mimetype, texto || '', tipo || 'image');
        return res.json({ success: true });
      }

      if (config?.modo === 'zapi' && config.api_url && config.api_token) {
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
      try { fs.unlinkSync(file.path); } catch (_) { /* ignore */ }
    }
  })
);

// --- CRM WhatsApp: lista de conversas e histórico ---
// Lista de conversas: agrupa por número, traz a última mensagem e quantas não lidas.
app.get(
  '/api/whatsapp/chats',
  requireAuth,
  wrap(async (req, res) => {
    const campanha_id = req.user!.campanha_id ?? 'global';
    const grupos = await prisma.mensagemWhatsApp.groupBy({
      by: ['numero'],
      where: { campanha_id },
      _max: { created_at: true },
    });

    const chats = await Promise.all(
      grupos.map(async (g) => {
        const [ultima, naoLidas] = await Promise.all([
          prisma.mensagemWhatsApp.findFirst({
            where: { campanha_id, numero: g.numero },
            orderBy: { created_at: 'desc' },
          }),
          prisma.mensagemWhatsApp.count({
            where: { campanha_id, numero: g.numero, is_from_me: false, lida: false },
          }),
        ]);
        return {
          numero: g.numero,
          ultima_mensagem: ultima?.texto ?? '',
          data: ultima?.created_at ?? g._max.created_at,
          nao_lidas: naoLidas,
        };
      }),
    );

    chats.sort((a, b) => new Date(b.data as Date).getTime() - new Date(a.data as Date).getTime());
    res.json(chats);
  }),
);

// Histórico de um número + marca as recebidas como lidas.
app.get(
  '/api/whatsapp/chats/:numero',
  requireAuth,
  wrap(async (req, res) => {
    const campanha_id = req.user!.campanha_id ?? 'global';
    const numero = String(req.params.numero);

    const mensagens = await prisma.mensagemWhatsApp.findMany({
      where: { campanha_id, numero },
      orderBy: { created_at: 'asc' },
      take: 500,
    });

    await prisma.mensagemWhatsApp.updateMany({
      where: { campanha_id, numero, is_from_me: false, lida: false },
      data: { lida: true },
    });

    res.json(mensagens);
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
async function bootstrap() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const email = ADMIN_EMAIL.toLowerCase().trim();
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
    await prisma.usuario.updateMany({ where: { email }, data: { super_admin: true } });
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

  // A campanha principal (do dono) tem acesso total — inclusive WhatsApp.
  // Novas campanhas criadas pelo painel nascem 'gratis' (modelo SaaS preservado).
  if (campanhaPadrao.plano === 'gratis') {
    await prisma.campanha.update({ where: { id: cid }, data: { plano: 'pro' } });
    console.log('✓ Campanha principal promovida ao plano pro (WhatsApp liberado).');
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

// --- Automação de Aniversários ---
function startCronJobs() {
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Iniciando rotina de aniversários...');
    try {
      const hoje = new Date();
      const dia = hoje.getDate().toString().padStart(2, '0');
      const mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
      const prefixoData = `${dia}/${mes}`;

      const aniversariantes = await prisma.eleitor.findMany({
        where: {
          data_nascimento: { startsWith: prefixoData },
          status: 'ativo'
        }
      });

      console.log(`[CRON] Encontrados ${aniversariantes.length} aniversariantes hoje (${prefixoData}).`);

      for (let i = 0; i < aniversariantes.length; i++) {
        const eleitor = aniversariantes[i];
        if (!eleitor.telefone || !eleitor.campanha_id) continue;

        const numero = eleitor.telefone.replace(/\D/g, '');
        const primeiroNome = eleitor.nome.split(' ')[0];
        const texto = `Olá ${primeiroNome}! O Sistema Gestor de Votos te deseja um feliz aniversário! Que seu dia seja muito especial. 🎉🎂`;

        try {
          await sendWhatsAppMessage(eleitor.campanha_id, numero, texto, 'text');
          console.log(`[CRON] Mensagem enviada para ${primeiroNome} (${numero})`);
        } catch (err) {
          console.error(`[CRON] Falha ao enviar para ${numero}:`, err);
        }

        if (i < aniversariantes.length - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    } catch (err) {
      console.error('[CRON] Erro na rotina de aniversários:', err);
    }
  });

  // Funis de Automação do WhatsApp (Roda a cada hora)
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Verificando Funis de WhatsApp pendentes...');
    try {
      const pendentes = await prisma.eleitorFunil.findMany({
        where: { concluido: false, proxima_execucao: { lte: new Date() } },
        include: {
          funil: true,
          etapa_atual: true,
          eleitor: { select: { nome: true, telefone: true, campanha_id: true } }
        }
      });

      for (const item of pendentes) {
        if (!item.eleitor.telefone || !item.eleitor.campanha_id || !item.etapa_atual) continue;

        const numero = item.eleitor.telefone.replace(/\D/g, '');
        const texto = item.etapa_atual.mensagem_texto.replace(/\{\{nome\}\}/g, item.eleitor.nome.split(' ')[0]);
        
        try {
          if (item.etapa_atual.tipo_midia !== 'text' && item.etapa_atual.mensagem_midia_url) {
            // Em um sistema real, faríamos o download da URL e enviaríamos o arquivo,
            // ou passaríamos a URL para sendWhatsAppMessage se for a Z-API.
            // Para simplificar, enviaremos apenas o link no texto para o Robô Interno, ou chamamos sendWhatsAppMessage
            await sendWhatsAppMessage(item.eleitor.campanha_id, numero, texto, item.etapa_atual.tipo_midia, item.etapa_atual.mensagem_midia_url);
          } else {
            await sendWhatsAppMessage(item.eleitor.campanha_id, numero, texto, 'text');
          }

          // Avançar para a próxima etapa
          const proximaEtapa = await prisma.funilEtapa.findFirst({
            where: { funil_id: item.funil_id, ordem: { gt: item.etapa_atual.ordem } },
            orderBy: { ordem: 'asc' }
          });

          if (proximaEtapa) {
            await prisma.eleitorFunil.update({
              where: { id: item.id },
              data: {
                etapa_atual_id: proximaEtapa.id,
                proxima_execucao: new Date(Date.now() + proximaEtapa.dias_espera * 24 * 60 * 60 * 1000)
              }
            });
          } else {
            await prisma.eleitorFunil.update({
              where: { id: item.id },
              data: { concluido: true, proxima_execucao: null }
            });
          }

          // Sleep to avoid rate limits
          await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
          console.error(`[CRON Funil] Erro enviando para ${numero}:`, err);
        }
      }
    } catch (err) {
      console.error('[CRON Funil] Erro na rotina de funis:', err);
    }
  });

  console.log('✓ Cron jobs agendados.');
}

// --- Inicialização ---
const PORT = Number(process.env.PORT) || 3000;
bootstrap()
  .catch((err) => console.error('Falha no bootstrap:', err.message))
  .finally(async () => {
    try {
      startCronJobs();
      // Restaurar sessões internas na inicialização
      prisma.configuracaoWhatsApp.findMany({ where: { modo: 'interno' } })
        .then(configs => {
          for (const config of configs) {
            if (config.campanha_id) {
               initWhatsApp(io, config.campanha_id).catch(err => {
                 console.error(`Erro ao iniciar WhatsApp para campanha ${config.campanha_id}:`, err);
               });
            }
          }
        })
        .catch(console.error);
    } catch (e) {
      console.error("Erro ao verificar config do whatsapp na inicialização", e);
    }

    httpServer.listen(PORT, () => {
      console.log(`✓ API do Gestor de Votos rodando na porta ${PORT}`);
    });
  });
