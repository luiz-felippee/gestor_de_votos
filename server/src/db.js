import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL || ''

// Bancos hospedados (Neon, Render, etc.) exigem SSL; localhost não.
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString)
const useSSL =
  process.env.DATABASE_SSL === 'true' || (!isLocal && connectionString !== '')

export const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
})

/** Atalho para consultas. */
export function query(text, params) {
  return pool.query(text, params)
}
