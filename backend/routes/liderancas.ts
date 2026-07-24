/**
 * Painel da Liderança: dados pessoais (meta, progresso, evolução) e ranking
 * geral com tendência (subiu/desceu/manteve posição na última semana).
 *
 * Escopo (município / região / Pernambuco inteiro) filtra pela CIDADE do
 * eleitor cadastrado — não pela cidade de atuação do cabo — porque o que
 * importa pro ranking é "quem cadastrou mais gente naquela área", e um cabo
 * pode captar eleitores fora da própria cidade de atuação.
 */
import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, escopoCampanha, wrap, type AuthedRequest } from '../middlewares';
import regioesPE from '../data/regioes-pe.json';

const router = Router();

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const MAPA_REGIOES = regioesPE as Record<string, string[]>;
export const NOMES_REGIOES = Object.keys(MAPA_REGIOES);

// Inverte regiao -> [municipios] em municipio(normalizado) -> regiao, uma vez, no boot.
const REGIAO_POR_MUNICIPIO = new Map<string, string>();
for (const [regiao, municipios] of Object.entries(MAPA_REGIOES)) {
  for (const m of municipios) REGIAO_POR_MUNICIPIO.set(normalizar(m), regiao);
}

type CaboLeve = { id: string; lider_id: string | null };
type EleitorLeve = { cabo_id: string | null; cidade: string; created_at: Date };

// Soma os cadastros de cada cabo e "rola pra cima": os votos de um multiplicador
// contam também no total do líder dele (2 níveis, igual ao resto do sistema).
// `ateData`: se informado, só conta eleitores cadastrados até aquela data —
// é como a gente reconstrói o placar "de 7 dias atrás" sem precisar de uma
// tabela de histórico (o created_at do próprio eleitor já é a fonte da verdade).
function totalPorLider(cabos: CaboLeve[], eleitores: EleitorLeve[], ateData: Date | null): Map<string, number> {
  const totalPorCabo = new Map<string, number>();
  for (const e of eleitores) {
    if (!e.cabo_id) continue;
    if (ateData && e.created_at > ateData) continue;
    totalPorCabo.set(e.cabo_id, (totalPorCabo.get(e.cabo_id) || 0) + 1);
  }
  const resultado = new Map<string, number>();
  for (const c of cabos) {
    const liderId = c.lider_id ?? c.id;
    resultado.set(liderId, (resultado.get(liderId) || 0) + (totalPorCabo.get(c.id) || 0));
  }
  return resultado;
}

// GET /api/liderancas/ranking?escopo=municipio|regiao|pe&valor=<nome>
router.get(
  '/liderancas/ranking',
  requireAuth,
  wrap(async (req: AuthedRequest, res) => {
    const escopo = (req.query.escopo as string) || 'pe';
    const valor = req.query.valor ? String(req.query.valor) : null;
    const valorNorm = valor ? normalizar(valor) : null;

    const [cabos, eleitores] = await Promise.all([
      prisma.caboEleitoral.findMany({
        where: escopoCampanha(req),
        select: { id: true, nome: true, foto_url: true, lider_id: true, cidade: true },
      }),
      prisma.eleitor.findMany({
        where: { ...escopoCampanha(req), cabo_id: { not: null } },
        select: { cabo_id: true, cidade: true, created_at: true },
      }),
    ]);

    const noEscopo = (cidade: string): boolean => {
      if (escopo === 'pe' || !valorNorm) return true;
      if (!cidade) return false;
      if (escopo === 'municipio') return normalizar(cidade) === valorNorm;
      if (escopo === 'regiao') return REGIAO_POR_MUNICIPIO.get(normalizar(cidade)) === valor;
      return true;
    };

    const eleitoresNoEscopo = eleitores.filter((e) => noEscopo(e.cidade));

    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);

    const agora = totalPorLider(cabos, eleitoresNoEscopo, null);
    const antes = totalPorLider(cabos, eleitoresNoEscopo, seteDiasAtras);

    // Só líderes (topo da hierarquia) entram no ranking — o multiplicador conta
    // pro time dele, mas quem "compete" no ranking geral é a liderança.
    const lideres = cabos.filter((c) => !c.lider_id);

    // Ordena com desempate estável por posição na lista original: assim, entre
    // lideres empatados, a posição só muda de fato quando o total muda — sem
    // "ruído" de reordenação aleatória entre duas contagens de 0 e 0.
    const ordenar = (mapa: Map<string, number>) =>
      lideres
        .map((l) => ({ id: l.id, total: mapa.get(l.id) || 0 }))
        .map((r, i) => ({ ...r, _i: i }))
        .sort((a, b) => b.total - a.total || a._i - b._i);

    const rankAgora = ordenar(agora);
    const posAgora = new Map(rankAgora.map((r, i) => [r.id, i + 1]));
    const rankAntes = ordenar(antes);
    const posAntes = new Map(rankAntes.map((r, i) => [r.id, i + 1]));

    const infoPorId = new Map(lideres.map((l) => [l.id, l]));

    const ranking = rankAgora.map((r) => {
      const l = infoPorId.get(r.id)!;
      const delta = (posAntes.get(r.id) || rankAgora.length) - (posAgora.get(r.id) || 0);
      return {
        id: l.id,
        nome: l.nome,
        foto_url: l.foto_url,
        cidade: l.cidade,
        total: r.total,
        posicao: posAgora.get(r.id)!,
        tendencia: delta > 0 ? 'subiu' : delta < 0 ? 'desceu' : 'manteve',
        delta: Math.abs(delta),
        voce: l.id === req.user!.cabo_id,
      };
    });

    res.json({ ranking, regioes: NOMES_REGIOES });
  }),
);

// GET /api/liderancas/meu-painel — dados pessoais de quem está logado como cabo.
router.get(
  '/liderancas/meu-painel',
  requireAuth,
  wrap(async (req: AuthedRequest, res) => {
    const caboId = req.user!.cabo_id;
    if (!caboId) {
      return res.status(400).json({ error: 'Este usuário não está vinculado a uma liderança.' });
    }

    const cabo = await prisma.caboEleitoral.findUnique({
      where: { id: caboId },
      select: { id: true, nome: true, foto_url: true, meta_eleitores: true, cidade: true, lider_id: true },
    });
    if (!cabo) return res.status(404).json({ error: 'Liderança não encontrada.' });

    const multiplicadores = await prisma.caboEleitoral.findMany({
      where: { lider_id: caboId },
      select: { id: true },
    });
    const idsEquipe = [caboId, ...multiplicadores.map((m) => m.id)];

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - 6);
    inicioSemana.setHours(0, 0, 0, 0);
    const inicio14 = new Date();
    inicio14.setDate(inicio14.getDate() - 13);
    inicio14.setHours(0, 0, 0, 0);

    const [totalDireto, totalEquipe, cadastrosHoje, cadastrosSemana, eleitores14dias, campanha] = await Promise.all([
      prisma.eleitor.count({ where: { cabo_id: caboId } }),
      prisma.eleitor.count({ where: { cabo_id: { in: idsEquipe } } }),
      prisma.eleitor.count({ where: { cabo_id: { in: idsEquipe }, created_at: { gte: hoje } } }),
      prisma.eleitor.count({ where: { cabo_id: { in: idsEquipe }, created_at: { gte: inicioSemana } } }),
      prisma.eleitor.findMany({
        where: { cabo_id: { in: idsEquipe }, created_at: { gte: inicio14 } },
        select: { created_at: true },
      }),
      // Nome do político e número de urna — pro card "seu link de cadastro" da
      // liderança (ela não tem acesso à tela de Campanhas pra ver isso sozinha).
      req.user!.campanha_id
        ? prisma.campanha.findUnique({
            where: { id: req.user!.campanha_id },
            select: { nome: true, numero_urna: true },
          })
        : Promise.resolve(null),
    ]);

    // Série de 14 dias com zero nos dias sem cadastro (pro gráfico não "pular" datas).
    const porDia = new Map<string, number>();
    for (const e of eleitores14dias) {
      const chave = e.created_at.toISOString().slice(0, 10);
      porDia.set(chave, (porDia.get(chave) || 0) + 1);
    }
    const evolucao: { data: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const chave = d.toISOString().slice(0, 10);
      evolucao.push({ data: chave, total: porDia.get(chave) || 0 });
    }

    res.json({
      nome: cabo.nome,
      foto_url: cabo.foto_url,
      cidade: cabo.cidade,
      meta_eleitores: cabo.meta_eleitores,
      candidato_nome: campanha?.nome ?? null,
      numero_urna: campanha?.numero_urna ?? null,
      eh_lider: !cabo.lider_id,
      tamanho_equipe: multiplicadores.length,
      total_direto: totalDireto,
      total_equipe: totalEquipe,
      cadastros_hoje: cadastrosHoje,
      cadastros_semana: cadastrosSemana,
      evolucao,
    });
  }),
);

export default router;
