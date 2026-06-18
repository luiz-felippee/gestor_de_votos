import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, optionalAuth, wrap, escopoCampanha, registrarLog, cadastroLimiter, requirePlanLimit } from '../middlewares';

const cabosRouter = Router();

// --- Cabos (leitura pública p/ o dropdown do formulário; escrita restrita) ---
cabosRouter.get(
  '/cabos',
  optionalAuth,
  wrap(async (req, res) => {
    // Logado: só os cabos da própria campanha. Público (formulário): todos.
    const where = req.user ? escopoCampanha(req) : {};
    const cabos = await prisma.caboEleitoral.findMany({
      where,
      orderBy: { nome: 'asc' },
    });
    res.json(cabos);
  }),
);

cabosRouter.post(
  '/cabos',
  requireAuth,
  requireRole('admin', 'coordenador'),
  requirePlanLimit('cabos'),
  wrap(async (req, res) => {
    const { nome, telefone, bairro_atuacao, cidade, meta_eleitores, foi_candidato, cargo_candidato, ano_eleicao, votacao, foto_url } = req.body ?? {};
    if (!nome || !telefone) return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    if (!foto_url) return res.status(400).json({ error: 'A foto da liderança é obrigatória.' });
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
    if (!b.nome || !b.telefone) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios.' });
    }
    if (!b.foto_url) {
      return res.status(400).json({ error: 'A foto da liderança é obrigatória.' });
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
    const { nome, telefone, bairro_atuacao, cidade, meta_eleitores, foi_candidato, cargo_candidato, ano_eleicao, votacao, foto_url } = req.body ?? {};
    if (!foto_url) return res.status(400).json({ error: 'A foto da liderança é obrigatória.' });
    // Garante que o cabo pertence à campanha do usuário (isolamento)
    const dono = await prisma.caboEleitoral.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) },
      select: { id: true },
    });
    if (!dono) return res.status(404).json({ error: 'Cabo não encontrado.' });
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
      },
    });
    registrarLog(req, 'editar', 'cabo', String(req.params.id), cabo.nome);
    res.json(cabo);
  }),
);

cabosRouter.delete(
  '/cabos/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const dono = await prisma.caboEleitoral.findFirst({
      where: { id: String(req.params.id), ...escopoCampanha(req) },
      select: { id: true },
    });
    if (!dono) return res.status(404).json({ error: 'Cabo não encontrado.' });
    await prisma.caboEleitoral.delete({ where: { id: String(req.params.id) } });
    registrarLog(req, 'excluir', 'cabo', String(req.params.id));
    res.status(204).send();
  }),
);

export default cabosRouter;
