import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, optionalAuth, wrap, escopoCampanha, eleitorNaCampanha, registrarLog, cadastroLimiter, requirePlanLimit } from '../middlewares';
import { notificarMudanca } from '../server';
import { StatusEleitor } from '@prisma/client';
import { sendWhatsAppMessage } from '../whatsapp';

const eleitoresRouter = Router();

function normalizar(nome: string) {
  return nome.trim().toLowerCase();
}

async function geocodeAddress(bairro: string, cidade: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = [bairro, cidade, 'Pernambuco', 'Brasil']
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .join(', ');
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

// Criar: público (formulário) — com limite anti-spam por IP e verificação de plano
eleitoresRouter.post(
  '/eleitores',
  cadastroLimiter,
  requirePlanLimit('eleitores'),
  wrap(async (req, res) => {
    const b = req.body ?? {};
    // Honeypot: campo invisível que só robôs preenchem. Finge sucesso e ignora.
    if (b.website) return res.status(201).json({ ok: true });
    if (!b.nome || !b.telefone || !b.local_votacao || !b.zona || !b.secao || !b.bairro || !b.cidade) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }
    const bairroStr = String(b.bairro).trim();
    const cidadeStr = String(b.cidade).trim();

    // O eleitor herda a campanha do cabo que o indicou (isolamento)
    // Se não tiver cabo, herda do slug da URL
    let campanhaId: string | null = null;
    if (b.cabo_id) {
      const cabo = await prisma.caboEleitoral.findUnique({
        where: { id: String(b.cabo_id) },
        select: { campanha_id: true },
      });
      campanhaId = cabo?.campanha_id ?? null;
    } else if (b.campanha_slug) {
      const campanha = await prisma.campanha.findUnique({
        where: { slug: String(b.campanha_slug) },
        select: { id: true },
      });
      campanhaId = campanha?.id ?? null;
    }

    try {
      const coord = await geocodeAddress(bairroStr, cidadeStr);

      const eleitor = await prisma.eleitor.create({
        data: {
          campanha_id: campanhaId,
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

      // Disparar Boas-Vindas se ativado
      if (campanhaId && b.telefone) {
        prisma.configuracaoWhatsApp.findUnique({
          where: { campanha_id: campanhaId }
        }).then((config) => {
          if (config && config.msg_boas_vindas) {
            // Pode haver variáveis de substituição, ex: {{nome}}
            const texto = config.msg_boas_vindas.replace(/\{\{nome\}\}/g, String(b.nome).trim());
            sendWhatsAppMessage(campanhaId, String(b.telefone), texto).catch((err) => {
               console.error('Falha silenciosa ao enviar boas vindas:', err.message);
            });
          }
        }).catch(console.error);
      }

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
// Suporta paginação (?page=1&limit=50), busca (?busca=) e filtros (?cidade=&bairro=&status=&cabo_id=&zona=)
eleitoresRouter.get(
  '/eleitores',
  requireAuth,
  wrap(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...escopoCampanha(req),
      ...(req.user!.role === 'cabo' ? { cabo_id: req.user!.cabo_id } : {}),
    };

    // Filtros opcionais
    if (req.query.cidade) where.cidade = String(req.query.cidade);
    if (req.query.bairro) where.bairro = String(req.query.bairro);
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.cabo_id) where.cabo_id = String(req.query.cabo_id);
    if (req.query.zona) where.zona = Number(req.query.zona);

    // Busca textual (nome ou telefone)
    if (req.query.busca) {
      const termo = String(req.query.busca).toLowerCase().trim();
      where.OR = [
        { nome_busca: { contains: termo } },
        { telefone: { contains: termo } },
      ];
    }

    const [eleitores, total] = await Promise.all([
      prisma.eleitor.findMany({
        where,
        include: { cabo: { select: { id: true, nome: true } } },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.eleitor.count({ where }),
    ]);

    res.json({
      data: eleitores,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  }),
);

// Marcar WhatsApp Enviado
eleitoresRouter.patch(
  '/eleitores/:id/whatsapp',
  requireAuth,
  wrap(async (req, res) => {
    const { enviado } = req.body ?? {};
    if (!(await eleitorNaCampanha(req, String(req.params.id))))
      return res.status(404).json({ error: 'Eleitor não encontrado.' });
    const eleitor = await prisma.eleitor.update({
      where: { id: String(req.params.id) },
      data: { whatsapp_enviado: Boolean(enviado) }
    });
    notificarMudanca();
    res.json(eleitor);
  })
);

// Editar: admin/coordenador
eleitoresRouter.put(
  '/eleitores/:id',
  requireAuth,
  requireRole('admin', 'coordenador'),
  wrap(async (req, res) => {
    const b = req.body ?? {};
    if (!(await eleitorNaCampanha(req, String(req.params.id))))
      return res.status(404).json({ error: 'Eleitor não encontrado.' });
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
      registrarLog(req, 'editar', 'eleitor', String(req.params.id), eleitor.nome);
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
eleitoresRouter.delete(
  '/eleitores/:id',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    if (!(await eleitorNaCampanha(req, String(req.params.id))))
      return res.status(404).json({ error: 'Eleitor não encontrado.' });
    await prisma.eleitor.delete({ where: { id: String(req.params.id) } });
    registrarLog(req, 'excluir', 'eleitor', String(req.params.id));
    notificarMudanca();
    res.status(204).send();
  }),
);

// Anonimizar (LGPD): apaga TODOS os dados pessoais, mantém apenas estatística (zona/seção/cidade)
eleitoresRouter.post(
  '/eleitores/:id/anonimizar',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    if (!(await eleitorNaCampanha(req, String(req.params.id))))
      return res.status(404).json({ error: 'Eleitor não encontrado.' });
    const eleitor = await prisma.eleitor.update({
      where: { id: String(req.params.id) },
      data: {
        nome: '[anonimizado]',
        nome_busca: `anon-${req.params.id}`,
        telefone: '',
        cpf: null,
        titulo_eleitor: null,
        data_nascimento: null,
        lat: null,
        lng: null,
        observacoes: null,
        status: 'inativo',
      },
    });
    registrarLog(req, 'anonimizar', 'eleitor', String(req.params.id));
    notificarMudanca();
    res.json(eleitor);
  }),
);

// Mutirão de geolocalização (admin): preenche lat/lng dos eleitores antigos,
// em lotes, respeitando o limite do Nominatim (1 requisição por segundo).
eleitoresRouter.post(
  '/eleitores/geocodificar',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const lote = await prisma.eleitor.findMany({
      where: { lat: null, ...escopoCampanha(req) },
      take: 15,
      select: { id: true, bairro: true, cidade: true },
    });
    let geocodificados = 0;
    for (const e of lote) {
      let coord = await geocodeAddress(e.bairro, e.cidade);
      // Se o bairro não resolver, cai para a cidade (não fica preso reprocessando)
      if (!coord && e.bairro) {
        await new Promise((r) => setTimeout(r, 1100));
        coord = await geocodeAddress('', e.cidade);
      }
      if (coord) {
        await prisma.eleitor.update({
          where: { id: e.id },
          data: { lat: coord.lat, lng: coord.lng },
        });
        geocodificados++;
      }
      await new Promise((r) => setTimeout(r, 1100)); // ~1 req/s
    }
    const restantes = await prisma.eleitor.count({
      where: { lat: null, ...escopoCampanha(req) },
    });
    if (geocodificados > 0) notificarMudanca();
    res.json({ processados: lote.length, geocodificados, restantes });
  }),
);

// Bairros distintos (público) — alimenta o autocomplete do formulário
eleitoresRouter.get(
  '/bairros',
  optionalAuth,
  wrap(async (req, res) => {
    const linhas = await prisma.eleitor.findMany({
      where: req.user ? escopoCampanha(req) : {},
      distinct: ['bairro'],
      select: { bairro: true },
      orderBy: { bairro: 'asc' },
    });
    // Cache leve: sugestões de autocomplete podem ficar ~5 min desatualizadas
    res.set('Cache-Control', 'public, max-age=300');
    res.json(linhas.map((l) => l.bairro).filter(Boolean));
  }),
);

export default eleitoresRouter;
