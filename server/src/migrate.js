import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const sql = readFileSync(join(__dirname, '..', 'schema.sql'), 'utf8')
  await pool.query(sql)
  console.log('✓ Schema aplicado com sucesso.')
  await pool.end()
}

migrate().catch((err) => {
  console.error('Erro na migração:', err.message)
  process.exit(1)
})
