import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { rateLimit } from 'express-rate-limit'
import { query } from '../db.js'
import { assinarToken, requireAuth } from '../auth.js'
import { wrap } from '../utils.js'

export const authRouter = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
})

authRouter.post('/login', loginLimiter, wrap(async (req, res) => {
  const { email, senha } = req.body
  if (!email || !senha)
    return res.status(400).json({ error: 'Informe e-mail e senha.' })

  const { rows } = await query(
    'select * from usuarios where email = $1',
    [String(email).toLowerCase().trim()],
  )
  const usuario = rows[0]
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash)))
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' })

  const token = assinarToken(usuario)
  res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      role: usuario.role,
      cabo_id: usuario.cabo_id,
    },
  })
}))

authRouter.get('/me', requireAuth, wrap(async (req, res) => {
  res.json({ usuario: req.user })
}))
