import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev-secret'

export function assinarToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nome: usuario.nome,
      role: usuario.role,
      cabo_id: usuario.cabo_id,
    },
    SECRET,
    { expiresIn: '7d' },
  )
}

export function verificarToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch {
    return null
  }
}

/** Middleware: exige usuário autenticado (Bearer token). */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const payload = token && verificarToken(token)
  if (!payload) return res.status(401).json({ error: 'Não autenticado.' })
  req.user = payload
  next()
}

/** Middleware: exige um dos perfis informados. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação.' })
    }
    next()
  }
}
