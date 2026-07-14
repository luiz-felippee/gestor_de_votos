// Prova que o soft delete continua soft depois da migração $use -> $extends.
// Falha ruidosamente se algum delete virar exclusão real de dados.
import { prisma } from '../prismaClient';

const ok = (m: string) => console.log(`  OK    ${m}`);
let falhas = 0;
const falhou = (m: string) => {
  console.log(`  FALHA ${m}`);
  falhas++;
};

const baseEleitor = (nome: string, cid: string) => ({
  nome,
  nome_busca: nome.toLowerCase(),
  campanha_id: cid,
  telefone: '81999999999',
  local_votacao: 'Escola Teste',
  zona: 1,
  secao: 1,
  bairro: 'Centro',
  cidade: 'Recife',
});

async function main() {
  const campanha = await prisma.campanha.findFirstOrThrow();
  const cid = campanha.id;

  // --- delete() em modelo com soft delete ---
  const e1 = await prisma.eleitor.create({ data: baseEleitor('ZZ SoftDelete 1', cid) });
  await prisma.eleitor.delete({ where: { id: e1.id } });

  const cru = await prisma.$queryRaw<Array<{ id: string; deleted_at: Date | null }>>`
    SELECT id, deleted_at FROM eleitores WHERE id = ${e1.id}
  `;
  if (cru.length === 1) ok('delete(): a linha AINDA EXISTE no banco');
  else falhou('delete(): a linha SUMIU — virou exclusão real!');
  if (cru[0]?.deleted_at) ok('delete(): deleted_at foi carimbado');
  else falhou('delete(): deleted_at continua nulo');

  // --- as leituras devem ignorar o excluído ---
  if ((await prisma.eleitor.findUnique({ where: { id: e1.id } })) === null)
    ok('findUnique() não retorna o excluído');
  else falhou('findUnique() retornou registro excluído');

  const lista = await prisma.eleitor.findMany({ where: { campanha_id: cid } });
  if (!lista.some((e) => e.id === e1.id)) ok('findMany() não lista o excluído');
  else falhou('findMany() listou registro excluído');

  // --- deleteMany() ---
  const e2 = await prisma.eleitor.create({ data: baseEleitor('ZZ SoftDelete 2', cid) });
  await prisma.eleitor.deleteMany({ where: { id: e2.id } });
  const cru2 = await prisma.$queryRaw<Array<{ deleted_at: Date | null }>>`
    SELECT deleted_at FROM eleitores WHERE id = ${e2.id}
  `;
  if (cru2.length === 1 && cru2[0].deleted_at) ok('deleteMany(): virou soft delete');
  else falhou('deleteMany(): APAGOU a linha de verdade!');

  // --- modelo SEM soft delete deve continuar apagando de verdade ---
  const t = await prisma.funilTemplate.create({
    data: {
      campanha_id: cid,
      etapa_origem: 'novo',
      etapa_destino: 'contato_1',
      dias_espera: 1,
      texto: 'ZZ teste',
    },
  });
  await prisma.funilTemplate.delete({ where: { id: t.id } });
  const cru3 = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM funil_templates WHERE id = ${t.id}
  `;
  if (cru3.length === 0) ok('modelo sem soft delete: delete() ainda apaga de verdade');
  else falhou('modelo sem soft delete deixou de apagar');

  await prisma.$executeRaw`DELETE FROM eleitores WHERE nome LIKE 'ZZ SoftDelete%'`;

  console.log(falhas === 0 ? '\nTUDO OK — soft delete preservado.' : `\n${falhas} FALHA(S).`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
