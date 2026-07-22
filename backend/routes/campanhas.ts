import { Router } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../prismaClient';
import { requireAuth, requireSuperAdmin, wrap, gerarSlug, limparTokenCache } from '../middlewares';

const campanhasRouter = Router();

// Valida "#rgb" ou "#rrggbb": o valor vai direto para uma CSS custom property
// no front (ver cssVarsDaCor), então precisa ser garantidamente uma cor hex.
const HEX_COR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// --- Campanhas (provisionamento — somente super-admin) ---
campanhasRouter.get(
  '/campanhas',
  requireAuth,
  requireSuperAdmin,
  wrap(async (_req, res) => {
    const campanhas = await prisma.campanha.findMany({ orderBy: { created_at: 'asc' } });
    // Anexa a contagem de eleitores e usuários de cada campanha
    const comContagem = await Promise.all(
      campanhas.map(async (c) => ({
        ...c,
        total_eleitores: await prisma.eleitor.count({ where: { campanha_id: c.id } }),
        total_usuarios: await prisma.usuario.count({ where: { campanha_id: c.id } }),
      })),
    );
    res.json(comContagem);
  }),
);

// --- Rotas Públicas ---
// Busca dados básicos da campanha para montar a Landing Page ou formulários públicos
campanhasRouter.get(
  '/campanhas-public/:slug',
  wrap(async (req, res) => {
    const campanha = await prisma.campanha.findUnique({
      where: { slug: String(req.params.slug) },
      select: {
        id: true,
        nome: true,
        slug: true,
        foto_url: true,
        trajetoria: true,
        cor: true,
      },
    });
    if (!campanha) {
      return res.status(404).json({ error: 'Campanha não encontrada.' });
    }
    // Landing pública do link de cadastro (WhatsApp, dados móveis): nome/foto/trajetória
    // mudam raramente. 5 min de cache evita baixar de novo a cada navegação/refresh.
    res.set('Cache-Control', 'public, max-age=300');
    res.json(campanha);
  }),
);

// Cria uma campanha + o primeiro admin dela (login do candidato)
campanhasRouter.post(
  '/campanhas',
  requireAuth,
  requireSuperAdmin,
  wrap(async (req, res) => {
    const { nome, admin_nome, admin_email, admin_senha, foto_url, trajetoria, cor, cargo_ultima_eleicao, ano_ultima_eleicao, votos_ultima_eleicao } = req.body ?? {};
    if (!nome || !admin_email || !admin_senha) {
      return res
        .status(400)
        .json({ error: 'Nome da campanha + e-mail e senha do admin são obrigatórios.' });
    }
    if (!foto_url || !trajetoria || !trajetoria.trim()) {
      return res
        .status(400)
        .json({ error: 'A foto do candidato e toda sua trajetória são obrigatórias.' });
    }
    if (cor !== undefined && cor !== null && !HEX_COR.test(String(cor))) {
      return res.status(400).json({ error: 'Cor inválida (use um hex, ex: #4f46e5).' });
    }
    try {
      const campanha = await prisma.campanha.create({
        data: {
          nome: String(nome).trim(),
          slug: gerarSlug(String(nome)),
          foto_url: String(foto_url),
          trajetoria: String(trajetoria).trim(),
          ...(cor ? { cor: String(cor) } : {}),
          cargo_ultima_eleicao: cargo_ultima_eleicao ? String(cargo_ultima_eleicao).trim() : null,
          ano_ultima_eleicao: ano_ultima_eleicao ? String(ano_ultima_eleicao).trim() : null,
          votos_ultima_eleicao: votos_ultima_eleicao ? parseInt(votos_ultima_eleicao, 10) : null
        },
      });
      await prisma.usuario.create({
        data: {
          campanha_id: campanha.id,
          nome: admin_nome ? String(admin_nome).trim() : 'Administrador',
          email: String(admin_email).toLowerCase().trim(),
          senha_hash: await bcrypt.hash(String(admin_senha), 10),
          role: 'admin',
        },
      });
      res.status(201).json(campanha);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res
          .status(409)
          .json({ error: 'Já existe uma campanha com esse nome ou um usuário com esse e-mail.' });
      }
      throw err;
    }
  }),
);

// Atualiza dados da campanha
campanhasRouter.put(
  '/campanhas/:id',
  requireAuth,
  requireSuperAdmin,
  wrap(async (req, res) => {
    const { nome, slug, foto_url, trajetoria, cor, cargo_ultima_eleicao, ano_ultima_eleicao, votos_ultima_eleicao } = req.body ?? {};
    if (cor !== undefined && cor !== null && !HEX_COR.test(String(cor))) {
      return res.status(400).json({ error: 'Cor inválida (use um hex, ex: #4f46e5).' });
    }
    try {
      const campanha = await prisma.campanha.update({
        where: { id: String(req.params.id) },
        data: {
          // Padrão em todos os campos opcionais abaixo: campo AUSENTE do corpo (undefined)
          // não mexe no valor atual; campo presente mas vazio/null LIMPA o valor. Antes,
          // foto_url/cargo/ano/votos usavam só "valor ? ... : null" — um PUT parcial que
          // não reenviasse esses campos (ex: só trocar a cor) apagava todos eles.
          nome: nome ? String(nome).trim() : undefined,
          slug: slug ? gerarSlug(String(slug)) : undefined,
          foto_url: foto_url !== undefined ? (foto_url ? String(foto_url) : null) : undefined,
          trajetoria: trajetoria !== undefined ? (trajetoria ? String(trajetoria).trim() : null) : undefined,
          cor: cor ? String(cor) : undefined,
          cargo_ultima_eleicao: cargo_ultima_eleicao !== undefined ? (cargo_ultima_eleicao ? String(cargo_ultima_eleicao).trim() : null) : undefined,
          ano_ultima_eleicao: ano_ultima_eleicao !== undefined ? (ano_ultima_eleicao ? String(ano_ultima_eleicao).trim() : null) : undefined,
          votos_ultima_eleicao: votos_ultima_eleicao !== undefined ? (votos_ultima_eleicao ? parseInt(votos_ultima_eleicao, 10) : null) : undefined
        },
      });
      res.json(campanha);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(409).json({ error: 'Já existe uma campanha com esse slug.' });
      }
      throw err;
    }
  }),
);

// Excluir uma campanha e TODOS os dados dela (super-admin)
campanhasRouter.delete(
  '/campanhas/:id',
  requireAuth,
  requireSuperAdmin,
  wrap(async (req, res) => {
    const id = String(req.params.id);
    if (id === req.user!.campanha_id) {
      return res.status(400).json({ error: 'Você não pode excluir a sua própria campanha.' });
    }
    // Apaga os filhos antes dos pais (eleitores/usuários referenciam cabos)
    await prisma.eleitor.deleteMany({ where: { campanha_id: id } });
    await prisma.usuario.deleteMany({ where: { campanha_id: id } });
    await prisma.caboEleitoral.deleteMany({ where: { campanha_id: id } });
    await prisma.evento.deleteMany({ where: { campanha_id: id } });
    await prisma.logAuditoria.deleteMany({ where: { campanha_id: id } });
    await prisma.campanha.delete({ where: { id } });
    // Os usuários da campanha foram excluídos em massa: sem limpar o cache, eles
    // continuariam autenticando por até 5 min.
    limparTokenCache();
    res.status(204).send();
  }),
);

export default campanhasRouter;
