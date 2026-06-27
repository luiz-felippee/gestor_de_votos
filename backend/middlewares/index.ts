/**
 * Middlewares compartilhados: autenticação, autorização, rate-limiting,
 * helpers de escopo multi-campanha e log de auditoria.
 *
 * Extraídos do server.ts para eliminar a dependência circular
 * (os routers importavam de ./server que por sua vez importava os routers).
 */
import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { type PerfilAcesso } from '@prisma/client';
import { prisma } from '../prismaClient';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// --- Tipos e autenticação ---
export interface TokenPayload {
  id: string;
  nome: string;
  role: PerfilAcesso;
  cabo_id: string | null;
  campanha_id: string | null;
  super_admin: boolean;
  token_version: number;
}
export interface AuthedRequest extends Request {
  user?: TokenPayload;
}

/** Verifica um token JWT do handshake do Socket.io. Retorna o payload ou null. */
export function verificarTokenSocket(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function assinarToken(u: {
  id: string;
  nome: string;
  role: PerfilAcesso;
  cabo_id: string | null;
  campanha_id: string | null;
  super_admin: boolean;
  token_version: number;
}) {
  return jwt.sign(
    {
      id: u.id,
      nome: u.nome,
      role: u.role,
      cabo_id: u.cabo_id,
      campanha_id: u.campanha_id,
      super_admin: u.super_admin,
      token_version: u.token_version,
    },
    JWT_SECRET,
    { expiresIn: '7d' },
  );
}

// Cache para evitar query ao banco em toda requisição autenticada.
const _tokenCache = new Map<string, { campanha_id: string | null; super_admin: boolean; token_version: number; ts: number }>();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export async function completarToken(p: TokenPayload): Promise<void> {
  // Sempre validamos o banco caso não esteja no cache (para token_version)
  const cached = _tokenCache.get(p.id);
  if (cached && Date.now() - cached.ts < TOKEN_CACHE_TTL) {
    p.campanha_id = cached.campanha_id;
    p.super_admin = cached.super_admin;
    
    // Validação estrita de versão do token em cache
    if (cached.token_version !== p.token_version) {
      throw new Error('Token version mismatch');
    }
    return;
  }
  
  const u = await prisma.usuario.findUnique({
    where: { id: p.id, deleted_at: null },
    select: { campanha_id: true, super_admin: true, token_version: true },
  });
  
  if (!u || u.token_version !== p.token_version) {
    throw new Error('Token version mismatch');
  }

  p.campanha_id = u.campanha_id ?? null;
  p.super_admin = u.super_admin ?? false;
  _tokenCache.set(p.id, { 
    campanha_id: p.campanha_id, 
    super_admin: p.super_admin, 
    token_version: u.token_version,
    ts: Date.now() 
  });
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });

  // 1) Validação do token (401 = token realmente inválido/expirado → desloga)
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return res.status(401).json({ error: 'Sessão inválida.' });
  }

  // 2) Enriquecer com dados do banco. Se o BANCO falhar (ex.: Neon acordando),
  //    NÃO é falha de autenticação — devolve 503 (o front NÃO desloga em 503).
  try {
    await completarToken(payload);
  } catch (err: any) {
    if (err.message === 'Token version mismatch') {
      return res.status(401).json({ error: 'Sessão revogada ou expirada.' });
    }
    return res.status(503).json({ error: 'Banco indisponível no momento. Tente novamente.' });
  }

  req.user = payload;
  next();
}

export function requireRole(...roles: PerfilAcesso[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação.' });
    }
    next();
  };
}

export * from './requirePlan';

// Só o super-admin (gerencia as campanhas/candidatos).
export function requireSuperAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.super_admin) {
    return res.status(403).json({ error: 'Ação exclusiva do super-admin.' });
  }
  next();
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

// --- Rate Limiters ---

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

// --- Helpers de escopo multi-campanha ---

// Isolamento multi-campanha: super-admin enxerga tudo; os demais, só a sua campanha.
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

// --- Helpers gerais ---

export const wrap =
  (handler: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response) =>
    handler(req as AuthedRequest, res).catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    });

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
