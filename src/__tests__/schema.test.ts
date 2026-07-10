import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Configuração do Banco de Dados e Esquema Prisma', () => {
  it('deve possuir o índice composto de campanha_id e created_at no modelo LogAuditoria', () => {
    const schemaPath = path.join(__dirname, '..', '..', 'backend', 'prisma', 'schema.prisma')
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8')
    
    // Verifica se existe a definição do modelo LogAuditoria com o índice correto
    expect(schemaContent).toContain('model LogAuditoria')
    expect(schemaContent).toContain('@@index([campanha_id, created_at])')
  })

  it('deve possuir os índices de busca essenciais para a tabela de eleitores', () => {
    const schemaPath = path.join(__dirname, '..', '..', 'backend', 'prisma', 'schema.prisma')
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8')
    
    expect(schemaContent).toContain('@@index([campanha_id, created_at])')
    expect(schemaContent).toContain('@@index([campanha_id, cabo_id])')
    expect(schemaContent).toContain('@@index([cidade])')
    expect(schemaContent).toContain('@@index([bairro])')
  })
})
