import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, wrap, escopoCampanha } from '../middlewares';

const dashboardRouter = Router();

dashboardRouter.get(
  '/stats',
  requireAuth,
  wrap(async (req, res) => {
    const filtroCidade = req.query.cidade as string;
    const filtroDias = req.query.dias as string;
    const whereBase = {
      ...escopoCampanha(req),
      ...(req.user!.role === 'cabo' ? { cabo_id: req.user!.cabo_id } : {}),
    };

    // Filtro temporal opcional
    let whereData = { ...whereBase };
    if (filtroDias) {
      const dias = parseInt(filtroDias, 10);
      if (!isNaN(dias)) {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - dias);
        whereData = {
          ...whereData,
          // @ts-ignore
          created_at: { gte: dataLimite },
        };
      }
    }

    const whereFiltrado = filtroCidade ? { ...whereData, cidade: filtroCidade } : whereData;
    const whereCidadeSemDias = filtroCidade ? { ...whereBase, cidade: filtroCidade } : whereBase;

    // Executa TODAS as queries de agregação em paralelo — nenhuma puxa todos os registros
    const [
      totalEleitores,
      cidadesAgg,
      bairrosAgg,
      locaisAgg,
      diasAgg,
      cabos,
      cabosCountAgg,
      campanhaAtual,
      aniversariantesRaw,
    ] = await Promise.all([
      // 1. Total de eleitores (COUNT, não findMany)
      prisma.eleitor.count({ where: whereFiltrado }),

      // 2. Agrupamento por cidade
      prisma.eleitor.groupBy({
        by: ['cidade'],
        where: whereFiltrado,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // 3. Agrupamento por bairro (todos — o top 10 é definido após normalizar/somar)
      prisma.eleitor.groupBy({
        by: ['bairro'],
        where: { ...whereFiltrado, bairro: { not: '' } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // 4. Agrupamento por local de votação (com zona, bairro, cidade)
      prisma.eleitor.groupBy({
        by: ['local_votacao', 'zona', 'bairro', 'cidade'],
        where: { ...whereFiltrado, local_votacao: { not: '' } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),

      // 5. Cadastros por dia (agrupado pela data do created_at)
      (async () => {
        const { Prisma } = await import('@prisma/client');
        const conditions: ReturnType<typeof Prisma.sql>[] = [];
        if (!req.user!.super_admin && req.user!.campanha_id) {
          conditions.push(Prisma.sql`AND campanha_id = ${req.user!.campanha_id}`);
        }
        if (req.user!.role === 'cabo' && req.user!.cabo_id) {
          conditions.push(Prisma.sql`AND cabo_id = ${req.user!.cabo_id}`);
        }
        if (filtroCidade) {
          conditions.push(Prisma.sql`AND cidade = ${filtroCidade}`);
        }
        if (filtroDias) {
          const dias = parseInt(filtroDias, 10);
          if (!isNaN(dias)) {
            conditions.push(Prisma.sql`AND created_at >= NOW() - INTERVAL '${Prisma.raw(dias.toString())} days'`);
          }
        }
        const whereClause = conditions.length > 0
          ? Prisma.sql`${Prisma.join(conditions, ' ')}`
          : Prisma.empty;
        return prisma.$queryRaw<Array<{ dia: string; total: bigint }>>`
          SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS dia, COUNT(*)::bigint AS total
          FROM eleitores
          WHERE 1=1 ${whereClause}
          GROUP BY dia ORDER BY dia
        `;
      })().catch(() => [] as Array<{ dia: string; total: bigint }>),

      // 6. Lista de cabos (leve — só id, nome, meta)
      prisma.caboEleitoral.findMany({
        where: escopoCampanha(req),
        select: { id: true, nome: true, meta_eleitores: true, foto_url: true },
      }),

      // 7. Contagem de eleitores por cabo
      prisma.eleitor.groupBy({
        by: ['cabo_id'],
        where: { ...whereFiltrado, cabo_id: { not: null } },
        _count: { id: true },
      }),

      // 8. Campanha atual
      req.user?.campanha_id
        ? prisma.campanha.findUnique({ where: { id: req.user.campanha_id } })
        : Promise.resolve(null),

      // 9. Aniversariantes — busca apenas quem tem data_nascimento com o mês atual ou próximo
      (async () => {
        const hoje = new Date();
        const mesAtual = hoje.getMonth() + 1;
        const mesProx = (mesAtual % 12) + 1;
        const mesAtualStr = String(mesAtual).padStart(2, '0');
        const mesProxStr = String(mesProx).padStart(2, '0');

        return prisma.eleitor.findMany({
          where: {
            ...whereCidadeSemDias,
            data_nascimento: { not: null },
            OR: [
              { data_nascimento: { contains: `-${mesAtualStr}-` } },
              { data_nascimento: { contains: `-${mesProxStr}-` } },
            ],
          },
          select: {
            id: true,
            nome: true,
            telefone: true,
            data_nascimento: true,
            bairro: true,
            cidade: true,
          },
        });
      })(),
    ]);

    // --- Processar resultados (tudo já vem agregado do banco) ---

    const porCidade = cidadesAgg
      .filter(c => c.cidade)
      .map(c => ({ label: c.cidade, total: c._count.id }));

    const porBairro = bairrosAgg
      .filter(b => b.bairro)
      .map(b => {
        const bNorm = b.bairro.trim().toLowerCase().replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        return { label: bNorm, total: b._count.id };
      });

    // Locais de votação com agrupamento dos "Outros"
    let porLocalVotacao = locaisAgg
      .filter(l => l.local_votacao)
      .map(l => ({
        label: `${l.local_votacao} (Z${l.zona}) - ${l.bairro || ''}, ${l.cidade || ''}`,
        total: l._count.id,
      }));
    if (porLocalVotacao.length > 8) {
      const top7 = porLocalVotacao.slice(0, 7);
      const outrosTotal = porLocalVotacao.slice(7).reduce((acc, curr) => acc + curr.total, 0);
      porLocalVotacao = [...top7, { label: 'Outros locais', total: outrosTotal }];
    }

    // Cadastros por dia — fallback seguro (a query raw retorna bigint)
    let porDia: { label: string; total: number }[] = [];
    try {
      porDia = (diasAgg as Array<{ dia: string; total: bigint }>).map(d => ({
        label: d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7),
        total: Number(d.total),
      }));
    } catch {
      porDia = [];
    }

    // Montar mapa de contagem por cabo
    const mapCabosCount = new Map<string, number>();
    for (const g of cabosCountAgg) {
      if (g.cabo_id) mapCabosCount.set(g.cabo_id, g._count.id);
    }

    const rankingOriginal = cabos.map(c => ({
      id: c.id,
      nome: c.nome,
      meta: c.meta_eleitores || 0,
      total: mapCabosCount.get(c.id) || 0,
      foto_url: c.foto_url,
    })).sort((a, b) => b.total - a.total);

    const ranking = filtroCidade
      ? rankingOriginal.filter(r => r.total > 0)
      : rankingOriginal;

    // Aniversariantes: calcular diffDias
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const diaAtual = hoje.getDate();
    const aniversariantes: Array<{
      id: string; nome: string; telefone: string | null;
      data_nascimento: string; diffDias: number;
      bairro: string | null; cidade: string | null;
    }> = [];

    for (const e of aniversariantesRaw) {
      if (!e.data_nascimento) continue;
      const parts = e.data_nascimento.split('-');
      if (parts.length !== 3) continue;
      const mes = parseInt(parts[1], 10);
      const dia = parseInt(parts[2], 10);
      let diffDias: number;
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
          cidade: e.cidade,
        });
      }
    }
    aniversariantes.sort((a, b) => a.diffDias - b.diffDias);

    const cidadesTodasCount = cidadesAgg.filter(c => c.cidade).length;
    const bairrosTodosCount = bairrosAgg.filter(b => b.bairro).length;
    const cabosAtivosCount = filtroCidade ? mapCabosCount.size : cabos.length;

    res.json({
      campanha: campanhaAtual,
      kpis: {
        totalEleitores,
        totalCidades: cidadesTodasCount,
        totalBairros: bairrosTodosCount,
        totalCabos: cabosAtivosCount,
      },
      porCidade,
      porBairro,
      porLocalVotacao,
      porDia,
      ranking,
      aniversariantes: aniversariantes.slice(0, 10),
    });
  })
);

export default dashboardRouter;

