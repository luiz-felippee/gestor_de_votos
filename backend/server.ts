import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { initWhatsApp, getWhatsAppStatus, sendWhatsAppMessage } from './whatsapp';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient, type PerfilAcesso, type StatusEleitor } from '@prisma/client';

const prisma = new PrismaClient();
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
app.use(express.json());

// Limite de cadastros públicos por IP (anti-spam/robô): 8 por minuto
const cadastroLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitos cadastros em sequência. Aguarde um minuto e tente de novo.',
  },
});

// --- Tempo real (Socket.io) ---
const io = new SocketServer(httpServer, { cors: { origin: CORS_ORIGIN } });
function notificarMudanca() {
  io.emit('eleitores:changed');
}

// --- Tipos e autenticação ---
interface TokenPayload {
  id: string;
  nome: string;
  role: PerfilAcesso;
  cabo_id: string | null;
}
interface AuthedRequest extends Request {
  user?: TokenPayload;
}

function assinarToken(u: { id: string; nome: string; role: PerfilAcesso; cabo_id: string | null }) {
  return jwt.sign(u, JWT_SECRET, { expiresIn: '7d' });
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET) as TokenPayload;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão inválida.' });
  }
}

function requireRole(...roles: PerfilAcesso[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação.' });
    }
    next();
  };
}

const wrap =
  (handler: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) =>
    handler(req as AuthedRequest, res).catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    });

// --- Saúde ---
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- Autenticação ---
app.post(
  '/api/auth/login',
  wrap(async (req, res) => {
    const { email, senha } = req.body ?? {};
    if (!email || !senha) return res.status(400).json({ error: 'Informe e-mail e senha.' });

    const usuario = await prisma.usuario.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }
    const token = assinarToken(usuario);
    res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, role: usuario.role, cabo_id: usuario.cabo_id },
    });
  }),
);

app.get(
  '/api/auth/me',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ usuario: req.user });
  }),
);

// --- Cabos (leitura pública p/ o dropdown do formulário; escrita restrita) ---
app.get(
  '/api/cabos',
  wrap(async (_req, res) => {
    const cabos = await prisma.caboEleitoral.findMany({ orderBy: { nome: 'asc' } });
    res.json(cabos);
  }),
);

app.post(
  '/api/cabos',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const { nome, telefone, bairro_atuacao, cidade, meta_eleitores } = req.body ?? {};
    if (!nome || !telefone) return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    const cabo = await prisma.caboEleitoral.create({
      data: {
        nome: String(nome).trim(),
        telefone: String(telefone),
        bairro_atuacao: bairro_atuacao || null,
        cidade: cidade || null,
        meta_eleitores: Number(meta_eleitores) || 0,
      },
    });
    res.status(201).json(cabo);
  }),
);

app.put(
  '/api/cabos/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const { nome, telefone, bairro_atuacao, cidade, meta_eleitores } = req.body ?? {};
    const cabo = await prisma.caboEleitoral.update({
      where: { id: String(req.params.id) },
      data: {
        nome,
        telefone,
        bairro_atuacao: bairro_atuacao || null,
        cidade: cidade || null,
        meta_eleitores: Number(meta_eleitores) || 0,
      },
    });
    res.json(cabo);
  }),
);

app.delete(
  '/api/cabos/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    await prisma.caboEleitoral.delete({ where: { id: String(req.params.id) } });
    res.status(204).send();
  }),
);

// --- Eleitores ---
function normalizar(nome: string) {
  return nome.trim().toLowerCase();
}

// Criar: público (formulário) — com limite anti-spam por IP
app.post(
  '/api/eleitores',
  cadastroLimiter,
  wrap(async (req, res) => {
    const b = req.body ?? {};
    // Honeypot: campo invisível que só robôs preenchem. Finge sucesso e ignora.
    if (b.website) return res.status(201).json({ ok: true });
    if (!b.nome || !b.telefone || !b.local_votacao || !b.zona || !b.secao || !b.bairro || !b.cidade) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }
    try {
      const eleitor = await prisma.eleitor.create({
        data: {
          nome: String(b.nome).trim(),
          nome_busca: normalizar(String(b.nome)),
          telefone: String(b.telefone),
          local_votacao: String(b.local_votacao).trim(),
          zona: Number(b.zona),
          secao: Number(b.secao),
          bairro: String(b.bairro).trim(),
          cidade: String(b.cidade),
          cabo_id: b.cabo_id || null,
          status: (b.status as StatusEleitor) || 'ativo',
          observacoes: b.observacoes?.trim() || null,
        },
      });
      notificarMudanca();
      res.status(201).json(eleitor);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Este eleitor já foi cadastrado nesta zona e seção.' });
      }
      throw err;
    }
  }),
);

// Listar: autenticado; perfil 'cabo' vê só os próprios
app.get(
  '/api/eleitores',
  requireAuth,
  wrap(async (req, res) => {
    const where = req.user!.role === 'cabo' ? { cabo_id: req.user!.cabo_id } : {};
    const eleitores = await prisma.eleitor.findMany({
      where,
      include: { cabo: { select: { id: true, nome: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json(eleitores);
  }),
);

// Marcar WhatsApp Enviado
app.patch(
  '/api/eleitores/:id/whatsapp',
  requireAuth,
  wrap(async (req, res) => {
    const { enviado } = req.body ?? {};
    const eleitor = await prisma.eleitor.update({
      where: { id: String(req.params.id) },
      data: { whatsapp_enviado: Boolean(enviado) }
    });
    notificarMudanca();
    res.json(eleitor);
  })
);

// Editar: admin/coordenador
app.put(
  '/api/eleitores/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const b = req.body ?? {};
    try {
      const eleitor = await prisma.eleitor.update({
        where: { id: String(req.params.id) },
        data: {
          nome: b.nome,
          nome_busca: b.nome ? normalizar(String(b.nome)) : undefined,
          telefone: b.telefone,
          local_votacao: b.local_votacao,
          zona: b.zona !== undefined ? Number(b.zona) : undefined,
          secao: b.secao !== undefined ? Number(b.secao) : undefined,
          bairro: b.bairro,
          cidade: b.cidade,
          status: b.status as StatusEleitor,
          observacoes: b.observacoes || null,
        },
      });
      notificarMudanca();
      res.json(eleitor);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Já existe um eleitor com esse nome nesta zona e seção.' });
      }
      throw err;
    }
  }),
);

// Excluir: admin
app.delete(
  '/api/eleitores/:id',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    await prisma.eleitor.delete({ where: { id: String(req.params.id) } });
    notificarMudanca();
    res.status(204).send();
  }),
);

// Anonimizar (LGPD): apaga dados pessoais, mantém estatística (zona/seção/cidade)
app.post(
  '/api/eleitores/:id/anonimizar',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const eleitor = await prisma.eleitor.update({
      where: { id: String(req.params.id) },
      data: {
        nome: '[anonimizado]',
        nome_busca: `anon-${req.params.id}`,
        telefone: '',
        observacoes: null,
        status: 'inativo',
      },
    });
    notificarMudanca();
    res.json(eleitor);
  }),
);

// Bairros distintos (público) — alimenta o autocomplete do formulário
app.get(
  '/api/bairros',
  wrap(async (_req, res) => {
    const linhas = await prisma.eleitor.findMany({
      distinct: ['bairro'],
      select: { bairro: true },
      orderBy: { bairro: 'asc' },
    });
    res.json(linhas.map((l) => l.bairro).filter(Boolean));
  }),
);

// --- Usuários (gestão de acessos — somente admin) ---
const PERFIS: PerfilAcesso[] = ['admin', 'coordenador', 'cabo', 'visualizador'];
const USUARIO_PUBLICO = {
  id: true,
  nome: true,
  email: true,
  role: true,
  cabo_id: true,
  created_at: true,
  cabo: { select: { id: true, nome: true } },
} as const;

app.get(
  '/api/usuarios',
  requireAuth,
  requireRole('admin'),
  wrap(async (_req, res) => {
    const usuarios = await prisma.usuario.findMany({
      select: USUARIO_PUBLICO,
      orderBy: { nome: 'asc' },
    });
    res.json(usuarios);
  }),
);

app.post(
  '/api/usuarios',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const { nome, email, senha, role, cabo_id } = req.body ?? {};
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }
    if (role && !PERFIS.includes(role)) {
      return res.status(400).json({ error: 'Perfil inválido.' });
    }
    try {
      const usuario = await prisma.usuario.create({
        data: {
          nome: String(nome).trim(),
          email: String(email).toLowerCase().trim(),
          senha_hash: await bcrypt.hash(String(senha), 10),
          role: (role as PerfilAcesso) || 'visualizador',
          cabo_id: role === 'cabo' ? cabo_id || null : null,
        },
        select: USUARIO_PUBLICO,
      });
      res.status(201).json(usuario);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Já existe um usuário com esse e-mail.' });
      }
      throw err;
    }
  }),
);

app.put(
  '/api/usuarios/:id',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const { nome, email, senha, role, cabo_id } = req.body ?? {};
    if (role && !PERFIS.includes(role)) {
      return res.status(400).json({ error: 'Perfil inválido.' });
    }
    try {
      const usuario = await prisma.usuario.update({
        where: { id: String(req.params.id) },
        data: {
          nome,
          email: email ? String(email).toLowerCase().trim() : undefined,
          role: role as PerfilAcesso,
          cabo_id: role === 'cabo' ? cabo_id || null : null,
          senha_hash: senha ? await bcrypt.hash(String(senha), 10) : undefined,
        },
        select: USUARIO_PUBLICO,
      });
      res.json(usuario);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Já existe um usuário com esse e-mail.' });
      }
      throw err;
    }
  }),
);

app.delete(
  '/api/usuarios/:id',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'Você não pode excluir o próprio usuário.' });
    }
    await prisma.usuario.delete({ where: { id: String(req.params.id) } });
    res.status(204).send();
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
  }
}

const PORT = Number(process.env.PORT) || 3000;
bootstrap()
  .catch((err) => console.error('Falha no bootstrap:', err.message))
  .finally(async () => {
    // Inicia o WhatsApp Interno se estiver configurado
    try {
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
