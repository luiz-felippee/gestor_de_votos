import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { wrap } from '../utils.js'

export const cabosRouter = Router()

const caboSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').trim(),
  telefone: z.string().min(1, 'Telefone é obrigatório').trim(),
  bairro_atuacao: z.string().trim().optional().nullable(),
  cidade: z.string().trim().optional().nullable(),
  meta_eleitores: z.coerce.number().int().nonnegative().optional().default(0),
})

cabosRouter.get('/', wrap(async (_req, res) => {
  const { rows } = await query('select * from cabos_eleitorais order by nome')
  res.json(rows)
}))

cabosRouter.post('/', requireAuth, requireRole('admin', 'coordenador'), wrap(async (req, res) => {
  const data = caboSchema.parse(req.body)
  const { rows } = await query(
    `insert into cabos_eleitorais (nome, telefone, bairro_atuacao, cidade, meta_eleitores)
     values ($1, $2, $3, $4, $5) returning *`,
    [data.nome, data.telefone, data.bairro_atuacao || null, data.cidade || null, data.meta_eleitores],
  )
  res.status(201).json(rows[0])
}))

cabosRouter.put('/:id', requireAuth, requireRole('admin', 'coordenador'), wrap(async (req, res) => {
  const data = caboSchema.parse(req.body)
  const { rows } = await query(
    `update cabos_eleitorais
       set nome = $1, telefone = $2, bairro_atuacao = $3,
           cidade = $4, meta_eleitores = $5
     where id = $6 returning *`,
    [data.nome, data.telefone, data.bairro_atuacao || null, data.cidade || null, data.meta_eleitores, req.params.id],
  )
  if (!rows[0]) return res.status(404).json({ error: 'Cabo não encontrado.' })
  res.json(rows[0])
}))

cabosRouter.delete('/:id', requireAuth, requireRole('admin', 'coordenador'), wrap(async (req, res) => {
  await query('delete from cabos_eleitorais where id = $1', [req.params.id])
  res.status(204).end()
}))
