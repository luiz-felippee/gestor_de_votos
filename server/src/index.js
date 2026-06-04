import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import { z } from 'zod'

import { pool } from './db.js'

// Import das Rotas
import { authRouter } from './routes/auth.js'
import { cabosRouter } from './routes/cabos.js'
import { eleitoresRouterConfig } from './routes/eleitores.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const httpServer = createServer(app)

// Aceita uma ou mais origens separadas por vírgula (front local + Netlify).
const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
app.use(cors({ origin: CORS_ORIGINS }))
app.use(express.json())

// ----------------------------------------------------------------------------
// Socket.io
// ----------------------------------------------------------------------------
const io = new SocketServer(httpServer, { cors: { origin: CORS_ORIGINS } })

// ----------------------------------------------------------------------------
// Saúde
// ----------------------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ----------------------------------------------------------------------------
// Rotas
// ----------------------------------------------------------------------------
app.use('/api/auth', authRouter)
app.use('/api/cabos', cabosRouter)
app.use('/api/eleitores', eleitoresRouterConfig(io))

// Tratamento central de erros (incluindo Zod)
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    })
  }

  console.error(err)
  res.status(500).json({ error: 'Erro interno do servidor.' })
})

// ----------------------------------------------------------------------------
// Inicialização
// ----------------------------------------------------------------------------
async function bootstrap() {
  if (process.env.AUTO_MIGRATE === 'true') {
    const sql = readFileSync(join(__dirname, '..', 'schema.sql'), 'utf8')
    await pool.query(sql)
    console.log('✓ Schema aplicado (AUTO_MIGRATE).')
  }

  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10)
    await pool.query(
      `insert into usuarios (nome, email, senha_hash, role)
       values ($1, $2, $3, 'admin')
       on conflict (email) do update
         set senha_hash = excluded.senha_hash, role = 'admin'`,
      [ADMIN_NAME || 'Administrador', ADMIN_EMAIL.toLowerCase().trim(), hash],
    )
    console.log(`✓ Admin garantido: ${ADMIN_EMAIL}`)
  }
}

const PORT = process.env.PORT || 3001
bootstrap()
  .catch((err) => console.error('Falha no bootstrap:', err.message))
  .finally(() => {
    httpServer.listen(PORT, () => {
      console.log(`✓ API do Gestor de Votos rodando na porta ${PORT}`)
    })
  })
