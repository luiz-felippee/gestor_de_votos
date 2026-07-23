import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, optionalAuth, wrap, escopoCampanha, registrarLog, cadastroLimiter, requirePlanLimit } from '../middlewares';
import { cache } from '../lib/cache';
import { notificarMudanca } from '../server';

const cabosRouter = Router();

// Validação do auto-cadastro público de liderança (endpoint SEM login). Exige os
// campos e impõe teto de tamanho. foto_url pode ser URL curta OU base64 grande —
// o teto de 2MB do corpo (express.json) já limita; aqui só garantimos que veio.
const caboPublicoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome.').max(150, 'Nome longo demais.'),
  telefone: z.string().trim().min(8, 'Telefone inválido.').max(20, 'Telefone inválido.'),
  foto_url: z.string().min(1, 'A foto da liderança é obrigatória.'),
  bairro_atuacao: z.string().trim().max(150).nullish(),
  cidade: z.string().trim().max(150).nullish(),
  data_nascimento: z.string().trim().max(20).nullish(),
  cargo_candidato: z.string().trim().max(150).nullish(),
  ano_eleicao: z.string().trim().max(10).nullish(),
  campanha_slug: z.string().trim().max(120).nullish(),
  votacao: z.coerce.number().int().min(0).max(100_000_000).nullish(),
  foi_candidato: z.coerce.boolean().optional(),
}); // honeypot 'website' tratado antes; chaves extras são ignoradas

// Valida um lider_id recebido do cliente para o cabo `caboId` (null ao criar).
// Regras da hierarquia de 2 níveis:
//  - o líder tem que existir na MESMA campanha;
//  - o líder tem que ser uma LIDERANÇA (lider_id nulo) — senão criaria um 3º nível;
//  - um cabo não pode ser líder de si mesmo;
//  - um cabo que JÁ é líder de alguém não pode virar multiplicador (viraria 3 níveis).
// Retorna a mensagem de erro, ou null se estiver tudo certo.
async function validarLider(
  liderIdBruto: unknown,
  campanhaId: string | null | undefined,
  caboId: string | null,
): Promise<{ erro: string } | { liderId: string | null }> {
  if (liderIdBruto == null || liderIdBruto === '') return { liderId: null };
  const liderId = String(liderIdBruto);

  if (caboId && liderId === caboId) {
    return { erro: 'Uma liderança não pode ser multiplicadora de si mesma.' };
  }
  const lider = await prisma.caboEleitoral.findFirst({
    where: { id: liderId, ...(campanhaId ? { campanha_id: campanhaId } : {}) },
    select: { id: true, lider_id: true },
  });
  if (!lider) return { erro: 'Liderança informada não encontrada nesta campanha.' };
  if (lider.lider_id) {
    return { erro: 'Só é possível vincular a uma liderança de topo (multiplicador não tem multiplicador).' };
  }
  if (caboId) {
    const temMultiplicadores = await prisma.caboEleitoral.findFirst({
      where: { lider_id: caboId },
      select: { id: true },
    });
    if (temMultiplicadores) {
      return { erro: 'Esta liderança já tem multiplicadores, então não pode virar multiplicadora de outra.' };
    }
  }
  return { liderId };
}

// --- Cabos (leitura pública p/ o dropdown do formulário; escrita restrita) ---
cabosRouter.get(
  '/cabos',
  optionalAuth,
  wrap(async (req, res) => {
    // Logado: só os cabos da própria campanha. Público (formulário): todos.
    const where = req.user ? escopoCampanha(req) : {};
    const cabos = await prisma.caboEleitoral.findMany({
      where,
      select: {
        id: true, campanha_id: true, nome: true, telefone: true, bairro_atuacao: true,
        cidade: true, meta_eleitores: true, foi_candidato: true, cargo_candidato: true,
        ano_eleicao: true, votacao: true, data_nascimento: true, created_at: true, foto_url: true,
        lider_id: true,
        _count: { select: { eleitores: true } },
      },
      orderBy: { nome: 'asc' },
      // Sem paginação de propósito: a tela de Lideranças agrupa liderança + seus
      // multiplicadores no cliente e precisa do conjunto inteiro para somar os votos.
      // Este take é só uma trava de segurança contra payload sem limite.
      take: 1000,
    });

    // Votos diretos de cada cabo, e o total da liderança = ela + seus multiplicadores.
    // Feito em memória numa passada (a lista já está toda carregada, evita N+1).
    const votosDiretos = new Map(cabos.map((c) => [c.id, c._count.eleitores]));
    const nomePorId = new Map(cabos.map((c) => [c.id, c.nome]));
    const somaMultiplicadores = new Map<string, number>();
    for (const c of cabos) {
      if (c.lider_id) {
        somaMultiplicadores.set(c.lider_id, (somaMultiplicadores.get(c.lider_id) ?? 0) + c._count.eleitores);
      }
    }

    // Acesso público (link de cadastro compartilhado no WhatsApp, aberto em dados
    // móveis): o dropdown "quem te indicou" muda pouco, então cacheia por 60s no
    // aparelho de quem abriu o link — evita rebaixar essa lista a cada navegação
    // dentro do formulário. Autenticado NÃO cacheia (dado sensível por campanha,
    // e o hook já cacheia 5 min no cliente).
    if (!req.user) res.set('Cache-Control', 'public, max-age=60');

    // Só as fotos base64 vão pelo endpoint cacheável (nao manda o base64 na lista).
    // URLs http/legadas seguem como estavam.
    res.json(cabos.map((c) => ({
      ...c,
      foto_url: c.foto_url?.startsWith('data:') ? `/api/cabos/${c.id}/foto` : c.foto_url,
      lider_nome: c.lider_id ? nomePorId.get(c.lider_id) ?? null : null,
      votos_diretos: votosDiretos.get(c.id) ?? 0,
      // Para liderança: diretos + dos multiplicadores. Para multiplicador: só os diretos.
      votos_total: (votosDiretos.get(c.id) ?? 0) + (c.lider_id ? 0 : (somaMultiplicadores.get(c.id) ?? 0)),
    })));
  }),
);

// Foto da liderança servida como imagem cacheável (evita base64 gigante nas listas)
cabosRouter.get(
  '/cabos/:id/foto',
  wrap(async (req, res) => {
    const id = String(req.params.id);
    const chave = `foto_${id}`;
    let item = cache.get<{ mime: string; buf: Buffer; etag: string }>(chave);
    if (!item) {
      const cabo = await prisma.caboEleitoral.findUnique({ where: { id }, select: { foto_url: true } });
      const m = (cabo?.foto_url || '').match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (!m) return res.status(404).end();
      const buf = Buffer.from(m[2], 'base64');
      const etag = 'W/"' + crypto.createHash('sha1').update(buf).digest('base64').slice(0, 22) + '"';
      item = { mime: m[1], buf, etag };
      cache.set(chave, item, 3600);
    }
    res.set('ETag', item.etag);
    res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=86400');
    if (req.headers['if-none-match'] === item.etag) return res.status(304).end();
    res.set('Content-Type', item.mime);
    res.send(item.buf);
  }),
);

cabosRouter.post(
  '/cabos',
  requireAuth,
  requireRole('admin', 'coordenador'),
  requirePlanLimit('cabos'),
  wrap(async (req, res) => {
    const { nome, telefone, bairro_atuacao, cidade, meta_eleitores, foi_candidato, cargo_candidato, ano_eleicao, votacao, foto_url, lider_id } = req.body ?? {};
    if (!nome || !telefone) return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    if (!foto_url) return res.status(400).json({ error: 'A foto da liderança é obrigatória.' });
    const lider = await validarLider(lider_id, req.user!.campanha_id, null);
    if ('erro' in lider) return res.status(400).json({ error: lider.erro });
    const cabo = await prisma.caboEleitoral.create({
      data: {
        campanha_id: req.user!.campanha_id,
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
        foto_url: foto_url || null,
        lider_id: lider.liderId,
      },
    });
    registrarLog(req, 'criar', 'cabo', cabo.id, cabo.nome);
    res.status(201).json(cabo);
  }),
);

// Criar Cabo (Público - para auto-cadastro)
cabosRouter.post(
  '/cabos-public',
  cadastroLimiter,
  requirePlanLimit('cabos'),
  wrap(async (req, res) => {
    const b = req.body ?? {};
    if (b.website) return res.status(201).json({ ok: true }); // honeypot

    const parsed = caboPublicoSchema.safeParse(b);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' });
    }
    // A liderança entra na campanha do link (slug) ou, na falta, na campanha principal
    const campanha = b.campanha_slug
      ? await prisma.campanha.findUnique({ where: { slug: String(b.campanha_slug) } })
      : await prisma.campanha.findFirst({ orderBy: { created_at: 'asc' } });
    const cabo = await prisma.caboEleitoral.create({
      data: {
        campanha_id: campanha?.id ?? null,
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
        foto_url: b.foto_url || null,
      },
    });
    res.status(201).json(cabo);
  }),
);

cabosRouter.put(
  '/cabos/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const { nome, telefone, bairro_atuacao, cidade, meta_eleitores, foi_candidato, cargo_candidato, ano_eleicao, votacao, foto_url, lider_id } = req.body ?? {};
    if (!foto_url) return res.status(400).json({ error: 'A foto da liderança é obrigatória.' });
    // Garante que o cabo pertence à campanha do usuário (isolamento)
    const dono = await prisma.caboEleitoral.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) },
      select: { id: true },
    });
    if (!dono) return res.status(404).json({ error: 'Cabo não encontrado.' });
    const lider = await validarLider(lider_id, req.user!.campanha_id, String(req.params.id));
    if ('erro' in lider) return res.status(400).json({ error: lider.erro });
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
        foto_url: foto_url || null,
        lider_id: lider.liderId,
      },
    });
    cache.invalidateByPrefix(`foto_${String(req.params.id)}`); // foto pode ter mudado
    registrarLog(req, 'editar', 'cabo', String(req.params.id), cabo.nome);
    res.json(cabo);
  }),
);

cabosRouter.delete(
  '/cabos/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const caboId = String(req.params.id);
    const dono = await prisma.caboEleitoral.findFirst({
      where: { id: caboId, ...escopoCampanha(req) },
      select: { id: true, nome: true },
    });
    if (!dono) return res.status(404).json({ error: 'Cabo não encontrado.' });

    const excluirEleitores = req.query.excluirEleitores === 'true';
    if (excluirEleitores) {
      await prisma.eleitor.deleteMany({
        where: { cabo_id: caboId, ...escopoCampanha(req) },
      });
    }

    // Promove os multiplicadores desta liderança a lideranças (mantendo os eleitores
    // deles). Feito à mão porque o soft delete é um UPDATE — o onDelete: SetNull do
    // banco não dispara, e sem isto eles apontariam para uma liderança já invisível.
    await prisma.caboEleitoral.updateMany({
      where: { lider_id: caboId },
      data: { lider_id: null },
    });

    await prisma.caboEleitoral.delete({ where: { id: caboId } });
    registrarLog(
      req,
      'excluir',
      'cabo',
      caboId,
      `Liderança ${dono.nome} excluída. Eleitores associados também excluídos? ${excluirEleitores ? 'Sim' : 'Não'}`
    );
    notificarMudanca(req.user?.campanha_id);
    res.status(204).send();
  }),
);

export default cabosRouter;
