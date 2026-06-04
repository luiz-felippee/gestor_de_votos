import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { PrismaClient, type PerfilAcesso, type StatusEleitor } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json());

// --- Tempo real (Socket.io) ---
const io = new SocketServer(httpServer, { cors: { origin: CORS_ORIGINS } });
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
      where: { id: req.params.id },
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
    await prisma.caboEleitoral.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// --- Eleitores ---
function normalizar(nome: string) {
  return nome.trim().toLowerCase();
}

// Criar: público (formulário)
app.post(
  '/api/eleitores',
  wrap(async (req, res) => {
    const b = req.body ?? {};
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

// Editar: admin/coordenador
app.put(
  '/api/eleitores/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const b = req.body ?? {};
    try {
      const eleitor = await prisma.eleitor.update({
        where: { id: req.params.id },
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
    await prisma.eleitor.delete({ where: { id: req.params.id } });
    notificarMudanca();
    res.status(204).send();
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
        where: { id: req.params.id },
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
    await prisma.usuario.delete({ where: { id: req.params.id } });
    res.status(204).send();
  }),
);

// --- Inicialização: cria/atualiza o admin a partir das variáveis de ambiente ---
async function bootstrap() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const senha_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const email = ADMIN_EMAIL.toLowerCase().trim();
    await prisma.usuario.upsert({
      where: { email },
      update: { senha_hash, role: 'admin' },
      create: { nome: ADMIN_NAME || 'Administrador', email, senha_hash, role: 'admin' },
    });
    console.log(`✓ Admin garantido: ${email}`);
  }
}

const PORT = Number(process.env.PORT) || 3000;
bootstrap()
  .catch((err) => console.error('Falha no bootstrap:', err.message))
  .finally(() => {
    httpServer.listen(PORT, () => {
      console.log(`✓ API do Gestor de Votos rodando na porta ${PORT}`);
    });
  });
