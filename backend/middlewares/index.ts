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
// Segredo já validado no boot (config.ts derruba o servidor se faltar). Importar daqui
// elimina o antigo fallback `process.env.JWT_SECRET || 'dev-secret'`, que permitiria
// forjar tokens de admin caso a env sumisse.
import { JWT_SECRET } from '../config';

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
    { expiresIn: '30d' },
  );
}

// Cache para evitar query ao banco em toda requisição autenticada.
const _tokenCache = new Map<string, { campanha_id: string | null; super_admin: boolean; token_version: number; ts: number }>();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Descarta a entrada em cache de um usuário. Deve ser chamada SEMPRE que o acesso
// dele mudar (exclusão, troca de papel/campanha, revogação de sessão, troca de senha):
// sem isso, o cache continua liberando o acesso antigo por até TOKEN_CACHE_TTL.
export function invalidarTokenCache(userId: string): void {
  _tokenCache.delete(userId);
}

// Para operações em massa (ex.: excluir uma campanha inteira), onde não temos os ids
// dos usuários afetados em mãos. É raro e o custo é só um re-fetch por usuário ativo.
export function limparTokenCache(): void {
  _tokenCache.clear();
}

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

// Anti força-bruta no login.
//
// Antes era um limite único de 10 tentativas por IP. O problema: uma sede de campanha
// sai toda por um único IP (NAT). Meia dúzia de pessoas errando a senha travava o login
// de TODO MUNDO no escritório — e justo no dia da eleição isso é um desastre.
//
// Agora são duas camadas, e nenhuma delas conta o login que deu certo
// (skipSuccessfulRequests), então quem acerta a senha nunca queima a cota de ninguém:
//  - por IP: teto alto, só para conter varredura em massa vinda de uma origem;
//  - por conta: teto baixo, que é o que de fato protege a senha de um usuário —
//    e vale mesmo que o atacante troque de IP a cada tentativa.
const MENSAGEM_LIMITE = {
  error: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
};

// Chaveia pela conta alvo (e-mail no /login e /esqueci-senha, userId no /login-2fa).
// Sem isso a cota seria do IP, e trocar de IP contornaria o limite.
function chaveDaConta(req: Request): string {
  const body = req.body as { email?: unknown; userId?: unknown } | undefined;
  const alvo = body?.email ?? body?.userId;
  if (typeof alvo === 'string' && alvo.trim()) return `conta:${alvo.toLowerCase().trim()}`;
  return `ip:${req.ip}`;
}

export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: MENSAGEM_LIMITE,
});

// Chaveado pela conta alvo (e-mail no /login, userId no /login-2fa), não pelo IP.
// Sem e-mail no corpo, cai de volta no IP.
export const loginContaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 8,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: MENSAGEM_LIMITE,
  keyGenerator: chaveDaConta,
});

// O /esqueci-senha responde 200 SEMPRE (de propósito, para não revelar quais e-mails
// existem). Por isso ele não pode usar o limiter acima: com skipSuccessfulRequests o
// contador nunca subiria e a proteção seria nenhuma. Aqui toda requisição conta —
// senão dá para disparar e-mails de reset sem parar na caixa de uma pessoa.
export const esqueciSenhaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitos pedidos de recuperação. Aguarde alguns minutos e tente de novo.',
  },
  keyGenerator: chaveDaConta,
});

// Chaveia pelo usuário autenticado (token válido) em vez do IP: sem isso, todo mundo
// atrás do mesmo NAT (ex.: a sede da campanha) dividia uma única cota de 300 req/min,
// e uso normal de um punhado de pessoas já derrubava a API para o escritório inteiro.
// Cai para o IP só quando não há token válido (tráfego anônimo, ex.: cadastro público).
function chaveDoUsuarioOuIp(req: Request): string {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
      return `user:${payload.id}`;
    } catch {
      /* token inválido/expirado → cai pro IP */
    }
  }
  return `ip:${req.ip}`;
}

// Proteção geral (DDoS/scrape) para toda a API: 300 requisições por minuto,
// por usuário autenticado (ou por IP quando anônimo).
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: chaveDoUsuarioOuIp,
  message: { error: 'Muitas requisições, por favor tente novamente em 1 minuto.' },
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
