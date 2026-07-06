import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, requireRole, optionalAuth, wrap, escopoCampanha, eleitorNaCampanha, registrarLog, cadastroLimiter, requirePlanLimit } from '../middlewares';
import { notificarMudanca } from '../server';
import { StatusEleitor } from '@prisma/client';
import { cache } from '../lib/cache';

const eleitoresRouter = Router();

function normalizar(nome: string) {
  return nome.trim().toLowerCase();
}

async function geocodeAddress(bairro: string, cidade: string, endereco?: string | null): Promise<{ lat: number; lng: number } | null> {
  try {
    const q = [endereco, bairro, cidade, 'Pernambuco', 'Brasil']
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
      const phoneBase = String(b.telefone).replace(/\D/g, '');
      if (phoneBase.length >= 10) {
        const phoneMasked11 = phoneBase.length === 11 ? `(${phoneBase.substring(0, 2)}) ${phoneBase.substring(2, 7)}-${phoneBase.substring(7)}` : null;
        const phoneMasked10 = phoneBase.length === 10 ? `(${phoneBase.substring(0, 2)}) ${phoneBase.substring(2, 6)}-${phoneBase.substring(6)}` : null;
        
        const existing = await prisma.eleitor.findFirst({
          where: {
            campanha_id: campanhaId,
            OR: [
              { telefone: String(b.telefone) },
              { telefone: phoneBase },
              ...(phoneMasked11 ? [{ telefone: phoneMasked11 }] : []),
              ...(phoneMasked10 ? [{ telefone: phoneMasked10 }] : [])
            ]
          },
          select: { id: true }
        });
        
        if (existing) {
          return res.status(409).json({ error: 'Já existe um eleitor cadastrado com este telefone.' });
        }
      }

      // Cria o eleitor imediatamente (sem esperar geocode)
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
          endereco: b.endereco ? String(b.endereco).trim() : null,
          cabo_id: b.cabo_id || null,
          data_nascimento: b.data_nascimento || null,
          cpf: b.cpf ? String(b.cpf).replace(/\D/g, '') : null,
          titulo_eleitor: b.titulo_eleitor ? String(b.titulo_eleitor).replace(/\D/g, '') : null,
          lat: null,
          lng: null,
          status: (b.status as StatusEleitor) || 'ativo',
          observacoes: b.observacoes?.trim() || null,
        },
      });

      // Geocode pelo LOCAL DE VOTAÇÃO em background (fire-and-forget)
      const localVotStr = String(b.local_votacao).trim();
      geocodeAddress('', cidadeStr, localVotStr).then(coord => {
        if (coord) {
          prisma.eleitor.update({
            where: { id: eleitor.id },
            data: { lat: coord.lat, lng: coord.lng },
          }).catch(console.error);
        }
      }).catch(console.error);

      notificarMudanca(campanhaId);
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

// Importação em Lote (Bulk Import)
eleitoresRouter.post(
  '/eleitores/import',
  requireAuth,
  requireRole('admin', 'coordenador', 'cabo'),
  requirePlanLimit('eleitores'),
  wrap(async (req, res) => {
    const { eleitores } = req.body;
    if (!Array.isArray(eleitores) || eleitores.length === 0) {
      return res.status(400).json({ error: 'Array de eleitores inválido ou vazio.' });
    }

    const campanhaId: string | null = req.user!.campanha_id ?? null;

    // Pré-processa os eleitores para garantir que os campos necessários existem
    const rawData = eleitores.map((e: any) => {
      const bairroStr = String(e.bairro || 'Não informado').trim();
      const cidadeStr = String(e.cidade || 'Não informada').trim();
      const nomeStr = String(e.nome || '').trim();

      return {
        campanha_id: campanhaId,
        nome: nomeStr,
        nome_busca: nomeStr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
        telefone: String(e.telefone || '').replace(/\D/g, ''),
        local_votacao: String(e.local_votacao || 'Não informado').trim(),
        zona: Number(e.zona) || 0,
        secao: Number(e.secao) || 0,
        bairro: bairroStr,
        cidade: cidadeStr,
        endereco: e.endereco ? String(e.endereco).trim() : null,
        cabo_id: req.user!.role === 'cabo' ? req.user!.cabo_id : (e.cabo_id || null),
        data_nascimento: e.data_nascimento || null,
        cpf: e.cpf ? String(e.cpf).replace(/\D/g, '') : null,
        titulo_eleitor: e.titulo_eleitor ? String(e.titulo_eleitor).replace(/\D/g, '') : null,
        status: (e.status as StatusEleitor) || 'ativo',
        observacoes: e.observacoes?.trim() || null,
      };
    });

    // Prepara a verificação de duplicatas por telefone
    const existingDb = await prisma.eleitor.findMany({
      where: { campanha_id: campanhaId },
      select: { telefone: true }
    });
    const phoneSet = new Set<string>();
    for (const e of existingDb) {
      const d = String(e.telefone || '').replace(/\D/g, '');
      if (d) phoneSet.add(d);
    }

    const dataToInsert = rawData.filter((e: any) => {
      const digits = String(e.telefone || '').replace(/\D/g, '');
      if (!e.nome || !digits) return false; // Faltam dados
      if (phoneSet.has(digits)) return false; // Duplicado
      phoneSet.add(digits); // Adiciona para evitar dupes dentro da própria planilha
      return true;
    });

    if (dataToInsert.length === 0) {
      return res.status(400).json({ error: 'Nenhum eleitor novo encontrado. Todos já estão cadastrados ou faltam dados.' });
    }

    // Usar createMany com skipDuplicates impede quebra se o mesmo arquivo for importado 2x
    const result = await prisma.eleitor.createMany({
      data: dataToInsert,
      skipDuplicates: true,
    });

    // Invalida cache global
    notificarMudanca(campanhaId);

    // Tentativa otimista de Geocode para o primeiro de cada bairro (opcional/futuro).
    // O import em massa não fará geocode 1 a 1 imediato para evitar rate limit do Nominatim.

    res.status(201).json({ 
      message: 'Importação concluída', 
      inserted: result.count,
      totalSent: dataToInsert.length
    });
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

    // Filtro por mês de aniversário (data_nascimento no formato YYYY-MM-DD)
    if (req.query.mes_aniversario) {
      where.data_nascimento = { contains: `-${String(req.query.mes_aniversario)}-` };
    }

    // Busca textual (nome, telefone, bairro, cidade, local e cabo)
    const busca = String(req.query.busca || '').toLowerCase().trim();
    if (busca) {
      where.OR = [
        { nome_busca: { contains: busca } },
        { telefone: { contains: busca } },
        { bairro: { contains: busca, mode: 'insensitive' } },
        { cidade: { contains: busca, mode: 'insensitive' } },
        { local_votacao: { contains: busca, mode: 'insensitive' } },
        { cabo: { nome: { contains: busca, mode: 'insensitive' } } },
      ];
    }

    // Ordenação (whitelist de colunas para segurança)
    const SORT_MAP: Record<string, string> = {
      nome: 'nome_busca', telefone: 'telefone', local_votacao: 'local_votacao',
      zona: 'zona', secao: 'secao', bairro: 'bairro', cidade: 'cidade',
      status: 'status', created_at: 'created_at',
    };
    const sortField = SORT_MAP[String(req.query.sort)] || 'created_at';
    const sortDir = String(req.query.dir) === 'asc' ? 'asc' : 'desc';

    // Construção da chave de cache única para esta página e filtros
    const cid = req.user!.campanha_id || 'global';
    const cacheKey = `${cid}_eleitores_${req.user!.role}_${req.user!.cabo_id || 'no_cabo'}_p${page}_l${limit}_s${sortField}_${sortDir}_c${req.query.cidade || ''}_b${req.query.bairro || ''}_s${req.query.status || ''}_cb${req.query.cabo_id || ''}_z${req.query.zona || ''}_m${req.query.mes_aniversario || ''}_q${busca}`;
    
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const [eleitores, total] = await Promise.all([
      prisma.eleitor.findMany({
        where,
        include: { cabo: { select: { id: true, nome: true } } },
        orderBy: { [sortField]: sortDir } as any,
        skip,
        take: limit,
      }),
      prisma.eleitor.count({ where }),
    ]);

    const result = {
      data: eleitores,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    cache.set(cacheKey, result, 600); // Salva no cache por 10 min
    res.json(result);
  }),
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
      if (b.local_votacao && b.cidade) {
        coord = await geocodeAddress('', b.cidade, b.local_votacao);
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
          endereco: b.endereco !== undefined ? b.endereco : undefined,
          data_nascimento: b.data_nascimento || null,
          cpf: b.cpf ? String(b.cpf).replace(/\D/g, '') : null,
          titulo_eleitor: b.titulo_eleitor ? String(b.titulo_eleitor).replace(/\D/g, '') : null,
          ...(coord ? { lat: coord.lat, lng: coord.lng } : {}),
          status: b.status as StatusEleitor,
          observacoes: b.observacoes || null,
        },
      });
      registrarLog(req, 'editar', 'eleitor', String(req.params.id), eleitor.nome);
      notificarMudanca(req.user?.campanha_id);
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
    notificarMudanca(req.user?.campanha_id);
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
    notificarMudanca(req.user?.campanha_id);
    res.json(eleitor);
  }),
);

// Mutirão de geolocalização (admin): preenche lat/lng dos eleitores antigos,
// em lotes, respeitando o limite do Nominatim (1 requisição por segundo).
// Usa o LOCAL DE VOTAÇÃO como referência (não o endereço residencial).
// Cache interno evita re-geocodificar o mesmo local várias vezes.
eleitoresRouter.post(
  '/eleitores/geocodificar',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const lote = await prisma.eleitor.findMany({
      where: { lat: null, ...escopoCampanha(req) },
      take: 30, // Pode processar mais por lote graças ao cache
      select: { id: true, local_votacao: true, cidade: true },
    });

    // Cache in-memory para não geocodificar o mesmo local de votação várias vezes
    const cacheLocal = new Map<string, { lat: number; lng: number } | null>();
    let geocodificados = 0;

    for (const e of lote) {
      const chave = `${(e.local_votacao || '').toLowerCase().trim()}|${(e.cidade || '').toLowerCase().trim()}`;

      let coord: { lat: number; lng: number } | null | undefined = cacheLocal.get(chave);

      if (coord === undefined) {
        // Ainda não buscou esse local — faz o geocode
        // 1ª tentativa: local de votação + cidade
        coord = await geocodeAddress('', e.cidade, e.local_votacao);
        // 2ª tentativa: só a cidade
        if (!coord && e.local_votacao) {
          await new Promise((r) => setTimeout(r, 1100));
          coord = await geocodeAddress('', e.cidade);
        }
        cacheLocal.set(chave, coord);
        await new Promise((r) => setTimeout(r, 1100)); // ~1 req/s (Nominatim)
      }

      if (coord) {
        // Adiciona jitter leve para não empilhar todos os eleitores no mesmo pixel
        const jLat = (Math.random() - 0.5) * 0.0008;
        const jLng = (Math.random() - 0.5) * 0.0008;
        await prisma.eleitor.update({
          where: { id: e.id },
          data: { lat: coord.lat + jLat, lng: coord.lng + jLng },
        });
        geocodificados++;
      }
    }
    const restantes = await prisma.eleitor.count({
      where: { lat: null, ...escopoCampanha(req) },
    });
    if (geocodificados > 0) notificarMudanca(req.user?.campanha_id);
    res.json({ processados: lote.length, geocodificados, restantes });
  }),
);

// Regeocodificar: zera todos os lat/lng da campanha para que o mutirão
// reprocesse tudo usando o local de votação.
eleitoresRouter.post(
  '/eleitores/regeocodificar',
  requireAuth,
  requireRole('admin'),
  wrap(async (req, res) => {
    const { count } = await prisma.eleitor.updateMany({
      where: { ...escopoCampanha(req), lat: { not: null } },
      data: { lat: null, lng: null },
    });
    notificarMudanca(req.user?.campanha_id);
    res.json({ message: `${count} eleitores terão lat/lng recalculados pelo local de votação.`, resetados: count });
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
