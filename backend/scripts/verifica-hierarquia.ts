// TEMPORÁRIO — prova a hierarquia liderança -> multiplicadores e a soma de votos.
import { prisma } from '../prismaClient';

const ok = (m: string) => console.log(`  OK    ${m}`);
let falhas = 0;
const falhou = (m: string) => {
  console.log(`  FALHA ${m}`);
  falhas++;
};

const eleitor = (nome: string, cid: string, caboId: string) =>
  prisma.eleitor.create({
    data: {
      nome,
      nome_busca: nome.toLowerCase(),
      campanha_id: cid,
      cabo_id: caboId,
      telefone: '81999999999',
      local_votacao: 'Escola',
      zona: 1,
      secao: 1,
      bairro: 'Centro',
      cidade: 'Recife',
    },
  });

const cabo = (nome: string, cid: string, liderId: string | null = null) =>
  prisma.caboEleitoral.create({
    data: { nome, telefone: '81988887777', campanha_id: cid, foto_url: 'x', lider_id: liderId },
  });

async function main() {
  const campanha = await prisma.campanha.findFirstOrThrow();
  const cid = campanha.id;

  const felipe = await cabo('ZZ Felipe Lider', cid);
  const ana = await cabo('ZZ Ana Mult', cid, felipe.id);
  const joao = await cabo('ZZ Joao Mult', cid, felipe.id);

  // votos: 2 diretos do Felipe, 3 da Ana, 1 do João  => total Felipe = 6
  await eleitor('ZZ v1', cid, felipe.id);
  await eleitor('ZZ v2', cid, felipe.id);
  await eleitor('ZZ v3', cid, ana.id);
  await eleitor('ZZ v4', cid, ana.id);
  await eleitor('ZZ v5', cid, ana.id);
  await eleitor('ZZ v6', cid, joao.id);

  // --- reproduz o cálculo da rota GET /cabos ---
  const cabos = await prisma.caboEleitoral.findMany({
    where: { campanha_id: cid, nome: { startsWith: 'ZZ ' } },
    select: { id: true, nome: true, lider_id: true, _count: { select: { eleitores: true } } },
  });
  const diretos = new Map(cabos.map((c) => [c.id, c._count.eleitores]));
  const soma = new Map<string, number>();
  for (const c of cabos) if (c.lider_id) soma.set(c.lider_id, (soma.get(c.lider_id) ?? 0) + c._count.eleitores);
  const total = (id: string, lider: string | null) => (diretos.get(id) ?? 0) + (lider ? 0 : (soma.get(id) ?? 0));

  if (diretos.get(felipe.id) === 2) ok('Felipe: 2 votos diretos'); else falhou(`Felipe diretos = ${diretos.get(felipe.id)} (esperado 2)`);
  if (diretos.get(ana.id) === 3) ok('Ana: 3 votos diretos'); else falhou(`Ana diretos = ${diretos.get(ana.id)}`);
  if (total(felipe.id, null) === 6) ok('Felipe TOTAL = 6 (2 + 3 da Ana + 1 do João)'); else falhou(`Felipe total = ${total(felipe.id, null)} (esperado 6)`);
  if (total(ana.id, felipe.id) === 3) ok('Ana total = 3 (multiplicador soma só os diretos)'); else falhou(`Ana total = ${total(ana.id, felipe.id)}`);

  // --- teto de 2 níveis: não pode multiplicador de multiplicador ---
  const anaRecarregada = await prisma.caboEleitoral.findUniqueOrThrow({ where: { id: ana.id }, select: { lider_id: true } });
  if (anaRecarregada.lider_id) ok('Ana é multiplicadora (tem lider_id)'); else falhou('Ana perdeu o lider_id');

  // --- promoção ao excluir a liderança ---
  await prisma.caboEleitoral.updateMany({ where: { lider_id: felipe.id }, data: { lider_id: null } });
  await prisma.caboEleitoral.delete({ where: { id: felipe.id } });
  const anaDepois = await prisma.caboEleitoral.findUniqueOrThrow({ where: { id: ana.id }, select: { lider_id: true, _count: { select: { eleitores: true } } } });
  if (anaDepois.lider_id === null) ok('excluir Felipe promoveu Ana a liderança'); else falhou('Ana continuou vinculada a um Felipe excluído');
  if (anaDepois._count.eleitores === 3) ok('Ana manteve os 3 votos após a promoção'); else falhou(`Ana ficou com ${anaDepois._count.eleitores} votos`);

  // limpeza
  await prisma.$executeRaw`DELETE FROM eleitores WHERE nome LIKE 'ZZ %'`;
  await prisma.$executeRaw`DELETE FROM cabos WHERE nome LIKE 'ZZ %'`;

  console.log(falhas === 0 ? '\nTUDO OK — hierarquia e soma corretas.' : `\n${falhas} FALHA(S).`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
