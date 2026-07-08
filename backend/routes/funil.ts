import { Router } from 'express';
import { prisma } from '../prismaClient';
import { wrap, requireAuth } from '../middlewares';
import { z } from 'zod';

const funilRouter = Router();
funilRouter.use(requireAuth);

// Isolamento multi-campanha
function escopoCampanha(req: any) {
  if (req.user?.super_admin) return {};
  return { campanha_id: req.user?.campanha_id ?? '__sem_campanha__' };
}

// 1. GET /funil/tarefas-hoje
// Retorna os eleitores que estão na hora de receber mensagem (data atual > data_ultimo_contato + dias_espera do template atual)
funilRouter.get(
  '/tarefas-hoje',
  wrap(async (req, res) => {
    const escopo = escopoCampanha(req);
    
    // Busca todos os templates da campanha
    const templates = await prisma.funilTemplate.findMany({
      where: escopo,
    });
    
    if (templates.length === 0) {
      return res.json({ tarefas: [] });
    }

    // Busca eleitores que estão nas etapas contempladas pelos templates
    const etapasComTemplate = templates.map(t => t.etapa_origem);
    
    const eleitores = await prisma.eleitor.findMany({
      where: {
        ...escopo,
        etapa_funil: { in: etapasComTemplate },
        status: 'ativo'
      },
      select: {
        id: true,
        nome: true,
        telefone: true,
        etapa_funil: true,
        data_ultimo_contato: true,
        created_at: true,
      }
    });

    const hoje = new Date();
    const tarefas = [];

    for (const eleitor of eleitores) {
      // Encontra o template correspondente à etapa atual do eleitor
      const template = templates.find(t => t.etapa_origem === eleitor.etapa_funil);
      if (!template) continue;

      // Base para o cálculo dos dias: último contato ou a data de criação (se nunca contatado)
      const dataBase = eleitor.data_ultimo_contato || eleitor.created_at;
      
      // Adiciona 'dias_espera' à data base
      const dataAlvo = new Date(dataBase);
      dataAlvo.setDate(dataAlvo.getDate() + template.dias_espera);

      // Se a data atual já passou ou é o dia da data alvo, virou tarefa!
      if (hoje >= dataAlvo) {
        // Substitui variáveis no texto
        const textoPersonalizado = template.texto.replace(/\{nome\}/g, eleitor.nome.split(' ')[0]);
        
        tarefas.push({
          eleitor,
          template: {
            id: template.id,
            etapa_destino: template.etapa_destino,
            texto_pronto: textoPersonalizado
          }
        });
      }
    }

    res.json({ tarefas });
  })
);

// 2. POST /funil/avancar
// Marca como enviado e avança o eleitor para a próxima etapa
funilRouter.post(
  '/avancar',
  wrap(async (req, res) => {
    const { eleitor_id, etapa_destino } = req.body;
    if (!eleitor_id || !etapa_destino) return res.status(400).json({ error: 'Dados incompletos' });

    await prisma.eleitor.updateMany({
      where: { id: eleitor_id, ...escopoCampanha(req) },
      data: {
        etapa_funil: String(etapa_destino),
        data_ultimo_contato: new Date()
      }
    });

    res.json({ success: true });
  })
);

// 3. GET /funil/templates
funilRouter.get(
  '/templates',
  wrap(async (req, res) => {
    const templates = await prisma.funilTemplate.findMany({
      where: escopoCampanha(req),
      orderBy: { created_at: 'asc' }
    });
    res.json({ templates });
  })
);

// 4. POST /funil/templates
const TemplateSchema = z.object({
  etapa_origem: z.string().min(1),
  etapa_destino: z.string().min(1),
  dias_espera: z.number().min(0),
  texto: z.string().min(1)
});

funilRouter.post(
  '/templates',
  wrap(async (req, res) => {
    const data = TemplateSchema.parse(req.body);
    const campanha_id = req.user?.campanha_id;
    if (!campanha_id && !req.user?.super_admin) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const template = await prisma.funilTemplate.create({
      data: {
        ...data,
        campanha_id: campanha_id || null
      }
    });
    res.json({ template });
  })
);

// 5. DELETE /funil/templates/:id
funilRouter.delete(
  '/templates/:id',
  wrap(async (req, res) => {
    await prisma.funilTemplate.deleteMany({
      where: { id: String(req.params.id), ...escopoCampanha(req) }
    });
    res.json({ success: true });
  })
);

export default funilRouter;
