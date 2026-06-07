import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { initWhatsApp, getWhatsAppStatus, sendWhatsAppMessage, sendWhatsAppMediaFile } from './whatsapp';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient, type PerfilAcesso, type StatusEleitor } from '@prisma/client';
import cron from 'node-cron';

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

// --- Upload de mídias (multer) ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

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
const cadastroLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitos cadastros em sequência. Aguarde um minuto e tente de novo.',
  },
});

// Anti força-bruta no login: 10 tentativas por IP a cada 5 minutos
const loginLimiter = rateLimit({
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
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, version: '2026-06-07-compilado', runtime: 'node-dist' }),
);

// --- Autenticação ---
app.post(
  '/api/auth/login',
  loginLimiter,
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
    const { nome, telefone, bairro_atuacao, cidade, meta_eleitores, foi_candidato, cargo_candidato, ano_eleicao, votacao } = req.body ?? {};
    if (!nome || !telefone) return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    const cabo = await prisma.caboEleitoral.create({
      data: {
        nome: String(nome).trim(),
        telefone: String(telefone),
        bairro_atuacao: bairro_atuacao || null,
        cidade: cidade || null,
        meta_eleitores: Number(meta_eleitores) || 0,
        data_nascimento: req.body.data_nascimento || null,
        foi_candidato: Boolean(foi_candidato),
        cargo_candidato: cargo_candidato || null,
        ano_eleicao: ano_eleicao || null,
        votacao: votacao ? Number(votacao) : null,
      },
    });
    res.status(201).json(cabo);
  }),
);

// Criar Cabo (Público - para auto-cadastro)
app.post(
  '/api/cabos-public',
  cadastroLimiter,
  wrap(async (req, res) => {
    const b = req.body ?? {};
    if (b.website) return res.status(201).json({ ok: true }); // honeypot
    if (!b.nome || !b.telefone) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    }
    const cabo = await prisma.caboEleitoral.create({
      data: {
        nome: String(b.nome).trim(),
        telefone: String(b.telefone),
        bairro_atuacao: b.bairro_atuacao ? String(b.bairro_atuacao).trim() : null,
        cidade: b.cidade ? String(b.cidade) : null,
        meta_eleitores: 0,
        data_nascimento: b.data_nascimento || null,
        foi_candidato: Boolean(b.foi_candidato),
        cargo_candidato: b.cargo_candidato || null,
        ano_eleicao: b.ano_eleicao || null,
        votacao: b.votacao ? Number(b.votacao) : null,
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
    const { nome, telefone, bairro_atuacao, cidade, meta_eleitores, foi_candidato, cargo_candidato, ano_eleicao, votacao } = req.body ?? {};
    const cabo = await prisma.caboEleitoral.update({
      where: { id: String(req.params.id) },
      data: {
        nome,
        telefone,
        bairro_atuacao: bairro_atuacao || null,
        cidade: cidade || null,
        meta_eleitores: Number(meta_eleitores) || 0,
        data_nascimento: req.body.data_nascimento || null,
        foi_candidato: Boolean(foi_candidato),
        cargo_candidato: cargo_candidato || null,
        ano_eleicao: ano_eleicao || null,
        votacao: votacao ? Number(votacao) : null,
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

async function geocodeAddress(bairro: string, cidade: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = `${bairro}, ${cidade}, Pernambuco, Brasil`;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'GestorDeVotos/1.0' }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      // Add slight random jitter (approx 100m) to avoid all markers stacking perfectly on top of each other
      const jitterLat = (Math.random() - 0.5) * 0.002;
      const jitterLng = (Math.random() - 0.5) * 0.002;
      return { lat: parseFloat(data[0].lat) + jitterLat, lng: parseFloat(data[0].lon) + jitterLng };
    }
  } catch (err) {
    console.error('Erro no geocode', err);
  }
  return null;
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
    const bairroStr = String(b.bairro).trim();
    const cidadeStr = String(b.cidade).trim();

    try {
      const coord = await geocodeAddress(bairroStr, cidadeStr);

      const eleitor = await prisma.eleitor.create({
        data: {
          nome: String(b.nome).trim(),
          nome_busca: normalizar(String(b.nome)),
          telefone: String(b.telefone),
          local_votacao: String(b.local_votacao).trim(),
          zona: Number(b.zona),
          secao: Number(b.secao),
          bairro: bairroStr,
          cidade: cidadeStr,
          cabo_id: b.cabo_id || null,
          data_nascimento: b.data_nascimento || null,
          cpf: b.cpf ? String(b.cpf).replace(/\D/g, '') : null,
          titulo_eleitor: b.titulo_eleitor ? String(b.titulo_eleitor).replace(/\D/g, '') : null,
          lat: coord?.lat || null,
          lng: coord?.lng || null,
          status: (b.status as StatusEleitor) || 'ativo',
          observacoes: b.observacoes?.trim() || null,
        },
      });
      notificarMudanca();
      res.status(201).json(eleitor);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const target = err.meta?.target as string[] | string | undefined;
        if (target?.includes('cpf')) {
          return res.status(409).json({ error: 'Este CPF já está cadastrado em nossa base.' });
        }
        if (target?.includes('titulo_eleitor')) {
          return res.status(409).json({ error: 'Este Título de Eleitor já está cadastrado.' });
        }
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

// Dashboard Stats Otimizado
app.get(
  '/api/dashboard/stats',
  requireAuth,
  wrap(async (req, res) => {
    const filtroCidade = req.query.cidade as string;
    const whereBase = req.user!.role === 'cabo' ? { cabo_id: req.user!.cabo_id } : {};
    const whereFiltrado = filtroCidade ? { ...whereBase, cidade: filtroCidade } : whereBase;

    // 1. Cabos ativos (somente admin/coordenador vêem a meta e todos cabos)
    const cabos = await prisma.caboEleitoral.findMany({ select: { id: true, nome: true, meta_eleitores: true } });

    // 2. Busca campos otimizados para cálculo na memória do backend
    const eleitores = await prisma.eleitor.findMany({
      where: whereFiltrado,
      select: {
        id: true,
        cidade: true,
        bairro: true,
        local_votacao: true,
        zona: true,
        cabo_id: true,
        created_at: true,
        data_nascimento: true,
        nome: true,
        telefone: true
      }
    });

    const totalEleitores = eleitores.length;
    
    // Aggregation maps
    const mapCidades = new Map<string, number>();
    const mapBairros = new Map<string, number>();
    const mapLocais = new Map<string, number>();
    const mapDias = new Map<string, number>();
    const mapCabosCount = new Map<string, number>();

    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const diaAtual = hoje.getDate();
    const aniversariantes = [];

    for (let i = 0; i < eleitores.length; i++) {
      const e = eleitores[i];

      // Cidade
      if (e.cidade) mapCidades.set(e.cidade, (mapCidades.get(e.cidade) || 0) + 1);

      // Bairro
      if (e.bairro) {
        const bNormalizado = e.bairro.trim().toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
        mapBairros.set(bNormalizado, (mapBairros.get(bNormalizado) || 0) + 1);
      }

      // Local
      if (e.local_votacao) {
        const loc = `${e.local_votacao} (Z${e.zona}) - ${e.bairro || ''}, ${e.cidade || ''}`;
        mapLocais.set(loc, (mapLocais.get(loc) || 0) + 1);
      }

      // Cabo count
      if (e.cabo_id) {
        mapCabosCount.set(e.cabo_id, (mapCabosCount.get(e.cabo_id) || 0) + 1);
      }

      // Dia
      const diaIso = e.created_at.toISOString().slice(0, 10);
      mapDias.set(diaIso, (mapDias.get(diaIso) || 0) + 1);

      // Aniversariantes
      if (e.data_nascimento) {
        const parts = e.data_nascimento.split('-');
        if (parts.length === 3) {
          const mes = parseInt(parts[1], 10);
          const dia = parseInt(parts[2], 10);
          let diffDias = 0;
          if (mes === mesAtual) {
            diffDias = dia - diaAtual;
          } else if (mes === (mesAtual % 12) + 1 && diaAtual > 20) {
            const diasNoMes = new Date(hoje.getFullYear(), mesAtual, 0).getDate();
            diffDias = (diasNoMes - diaAtual) + dia;
          } else {
            diffDias = -999;
          }

          if (diffDias >= 0 && diffDias <= 30) {
            aniversariantes.push({
              id: e.id,
              nome: e.nome,
              telefone: e.telefone,
              data_nascimento: e.data_nascimento,
              diffDias,
              bairro: e.bairro,
              cidade: e.cidade
            });
          }
        }
      }
    }

    // Sort and Format outputs
    const porCidade = Array.from(mapCidades.entries()).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
    const porBairro = Array.from(mapBairros.entries()).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total).slice(0, 10);
    
    let porLocalVotacaoOriginal = Array.from(mapLocais.entries()).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
    let porLocalVotacao = porLocalVotacaoOriginal;
    if (porLocalVotacaoOriginal.length > 8) {
      const top7 = porLocalVotacaoOriginal.slice(0, 7);
      const outrosTotal = porLocalVotacaoOriginal.slice(7).reduce((acc, curr) => acc + curr.total, 0);
      porLocalVotacao = [...top7, { label: 'Outros locais', total: outrosTotal }];
    }

    const porDia = Array.from(mapDias.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([dia, total]) => ({
      label: dia.slice(8, 10) + '/' + dia.slice(5, 7),
      total
    }));

    const ranking = cabos.map(c => ({
      nome: c.nome,
      meta: c.meta_eleitores || 0,
      total: mapCabosCount.get(c.id) || 0
    })).sort((a, b) => b.total - a.total);

    aniversariantes.sort((a, b) => a.diffDias - b.diffDias);
    const topAniversariantes = aniversariantes.slice(0, 10);

    const bairrosTodosCount = (await prisma.eleitor.findMany({ where: whereBase, select: { bairro: true }, distinct: ['bairro'] })).length;
    const cidadesTodasCount = (await prisma.eleitor.findMany({ where: whereBase, select: { cidade: true }, distinct: ['cidade'] })).length;

    res.json({
      kpis: {
        totalEleitores: totalEleitores,
        totalCidades: cidadesTodasCount,
        totalBairros: bairrosTodosCount,
        totalCabos: cabos.length
      },
      porCidade,
      porBairro,
      porLocalVotacao,
      porDia,
      ranking,
      aniversariantes: topAniversariantes
    });
  })
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
      let coord = undefined;
      if (b.bairro && b.cidade) {
        coord = await geocodeAddress(b.bairro, b.cidade);
      }

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
          data_nascimento: b.data_nascimento || null,
          cpf: b.cpf ? String(b.cpf).replace(/\D/g, '') : null,
          titulo_eleitor: b.titulo_eleitor ? String(b.titulo_eleitor).replace(/\D/g, '') : null,
          ...(coord ? { lat: coord.lat, lng: coord.lng } : {}),
          status: b.status as StatusEleitor,
          observacoes: b.observacoes || null,
        },
      });
      notificarMudanca();
      res.json(eleitor);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const target = err.meta?.target as string[] | string | undefined;
        if (target?.includes('cpf')) {
          return res.status(409).json({ error: 'Este CPF já está cadastrado em nossa base.' });
        }
        if (target?.includes('titulo_eleitor')) {
          return res.status(409).json({ error: 'Este Título de Eleitor já está cadastrado.' });
        }
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
