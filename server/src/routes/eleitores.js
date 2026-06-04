import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { requireAuth, requireRole } from '../auth.js'
import { wrap } from '../utils.js'
import { CIDADES } from '../constants.js'

export function eleitoresRouterConfig(io) {
  const router = Router()

  function notificarMudanca() {
    io.emit('eleitores:changed')
  }

  const eleitorSchema = z.object({
    nome: z.string().min(1, 'Nome é obrigatório').trim(),
    telefone: z.string().min(1, 'Telefone é obrigatório').trim(),
    local_votacao: z.string().min(1, 'Local de votação é obrigatório').trim(),
    zona: z.coerce.number().int().positive('Zona deve ser um número válido'),
    secao: z.coerce.number().int().positive('Seção deve ser um número válido'),
    bairro: z.string().min(1, 'Bairro é obrigatório').trim(),
    cidade: z.enum(CIDADES, { errorMap: () => ({ message: 'Cidade inválida.' }) }),
    cabo_id: z.string().uuid('ID do cabo inválido').optional().nullable(),
    observacoes: z.string().trim().optional().nullable(),
    status: z.enum(['ativo', 'inativo', 'pendente']).optional().default('ativo')
  })

  router.post('/', wrap(async (req, res) => {
    const data = eleitorSchema.parse(req.body)

    try {
      const { rows } = await query(
        `insert into eleitores
           (nome, telefone, local_votacao, zona, secao, bairro, cidade, cabo_id, observacoes, status)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
        [
          data.nome, data.telefone, data.local_votacao, data.zona, data.secao,
          data.bairro, data.cidade, data.cabo_id || null, data.observacoes || null, data.status
        ],
      )
      notificarMudanca()
      res.status(201).json(rows[0])
    } catch (err) {
      if (err.code === '23505') {
        return res
          .status(409)
          .json({ error: 'Este eleitor já foi cadastrado nesta zona e seção.' })
      }
      throw err
    }
  }))

  router.get('/', requireAuth, wrap(async (req, res) => {
    const base = `
      select e.*, c.nome as cabo_nome
      from eleitores e
      left join cabos_eleitorais c on c.id = e.cabo_id`
    
    if (req.user.role === 'cabo') {
      const { rows } = await query(
        `${base} where e.cabo_id = $1 order by e.created_at desc`,
        [req.user.cabo_id],
      )
      return res.json(rows.map(formatarEleitor))
    }
    const { rows } = await query(`${base} order by e.created_at desc`)
    res.json(rows.map(formatarEleitor))
  }))

  router.put('/:id', requireAuth, requireRole('admin', 'coordenador'), wrap(async (req, res) => {
    const data = eleitorSchema.parse(req.body)

    const { rows } = await query(
      `update eleitores set
         nome=$1, telefone=$2, local_votacao=$3, zona=$4, secao=$5,
         bairro=$6, cidade=$7, status=$8, observacoes=$9, cabo_id=$10
       where id=$11 returning *`,
      [
        data.nome, data.telefone, data.local_votacao, data.zona, data.secao,
        data.bairro, data.cidade, data.status, data.observacoes || null, data.cabo_id || null, req.params.id,
      ],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Eleitor não encontrado.' })
    notificarMudanca()
    res.json(rows[0])
  }))

  router.delete('/:id', requireAuth, requireRole('admin'), wrap(async (req, res) => {
    await query('delete from eleitores where id = $1', [req.params.id])
    notificarMudanca()
    res.status(204).end()
  }))

  function formatarEleitor(row) {
    const { cabo_nome, ...rest } = row
    return { ...rest, cabo: rest.cabo_id ? { id: rest.cabo_id, nome: cabo_nome } : null }
  }

  return router
}
