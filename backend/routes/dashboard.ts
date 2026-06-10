import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, wrap, escopoCampanha } from '../server';

const dashboardRouter = Router();

dashboardRouter.get(
  '/stats',
  requireAuth,
  wrap(async (req, res) => {
    const filtroCidade = req.query.cidade as string;
    const whereBase = {
      ...escopoCampanha(req),
      ...(req.user!.role === 'cabo' ? { cabo_id: req.user!.cabo_id } : {}),
    };
    const whereFiltrado = filtroCidade ? { ...whereBase, cidade: filtroCidade } : whereBase;

    // Carrega cabos, eleitores e a campanha em paralelo
    const [cabos, eleitores, campanhaAtual] = await Promise.all([
      prisma.caboEleitoral.findMany({
        where: escopoCampanha(req),
        select: { id: true, nome: true, meta_eleitores: true },
      }),
      prisma.eleitor.findMany({
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
      }),
      req.user?.campanha_id
        ? prisma.campanha.findUnique({ where: { id: req.user.campanha_id } })
        : Promise.resolve(null),
    ]);

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

    const rankingOriginal = cabos.map(c => ({
      nome: c.nome,
      meta: c.meta_eleitores || 0,
      total: mapCabosCount.get(c.id) || 0
    })).sort((a, b) => b.total - a.total);

    const ranking = filtroCidade 
      ? rankingOriginal.filter(r => r.total > 0) 
      : rankingOriginal;

    aniversariantes.sort((a, b) => a.diffDias - b.diffDias);
    const topAniversariantes = aniversariantes.slice(0, 10);

    const cidadesTodasCount = mapCidades.size;
    const bairrosTodosCount = mapBairros.size;
    const cabosAtivosCount = filtroCidade ? mapCabosCount.size : cabos.length;

    res.json({
      campanha: campanhaAtual,
      kpis: {
        totalEleitores: totalEleitores,
        totalCidades: cidadesTodasCount,
        totalBairros: bairrosTodosCount,
        totalCabos: cabosAtivosCount
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

export default dashboardRouter;
