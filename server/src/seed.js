import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from './db.js'

// Uso: node src/seed.js "Nome" email@exemplo.com senha [role]
// role padrão: admin
const [, , nome, email, senha, role = 'admin'] = process.argv

async function seed() {
  if (!nome || !email || !senha) {
    console.log(
      'Uso: npm run seed -- "Seu Nome" seu@email.com suaSenha [admin|coordenador|cabo|visualizador]',
    )
    process.exit(1)
  }

  const hash = await bcrypt.hash(senha, 10)
  await pool.query(
    `insert into usuarios (nome, email, senha_hash, role)
     values ($1, $2, $3, $4)
     on conflict (email) do update
       set nome = excluded.nome, senha_hash = excluded.senha_hash, role = excluded.role`,
    [nome, email.toLowerCase().trim(), hash, role],
  )

  console.log(`✓ Usuário "${email}" criado/atualizado como ${role}.`)
  await pool.end()
}

seed().catch((err) => {
  console.error('Erro no seed:', err.message)
  process.exit(1)
})
