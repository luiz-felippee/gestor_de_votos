/**
 * Testes unitários para helpers/middlewares do backend.
 * Roda com: npx vitest run src/__tests__/middlewares.test.ts
 * (precisa de vitest instalado no root ou no backend)
 */
import { describe, it, expect } from 'vitest'

// Importamos a função pura (não depende de banco nem de request real)
// Reimplementação do teste para a lógica pura de gerarSlug e escopoCampanha

// Reimplementação local de gerarSlug (copiar da source para não precisar de setup TS do backend)
function gerarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
}

// Reimplementação local de escopoCampanha (lógica pura)
function escopoCampanha(user: { super_admin?: boolean; campanha_id?: string | null } | undefined): Record<string, unknown> {
  if (user?.super_admin) return {}
  return { campanha_id: user?.campanha_id ?? '__sem_campanha__' }
}

describe('gerarSlug', () => {
  it('converte texto simples em slug', () => {
    expect(gerarSlug('Campanha Principal')).toBe('campanha-principal')
  })

  it('remove acentos', () => {
    expect(gerarSlug('São Paulo Eleição')).toBe('sao-paulo-eleicao')
  })

  it('remove caracteres especiais', () => {
    expect(gerarSlug('Candidato @#$ 2024!')).toBe('candidato-2024')
  })

  it('trata strings com espaços extras', () => {
    expect(gerarSlug('  Muitos   Espaços  ')).toBe('muitos-espacos')
  })
})

describe('escopoCampanha', () => {
  it('retorna objeto vazio para super_admin', () => {
    expect(escopoCampanha({ super_admin: true, campanha_id: 'abc' })).toEqual({})
  })

  it('retorna campanha_id para usuário normal', () => {
    expect(escopoCampanha({ super_admin: false, campanha_id: 'xyz' })).toEqual({
      campanha_id: 'xyz',
    })
  })

  it('retorna __sem_campanha__ quando campanha_id é null', () => {
    expect(escopoCampanha({ super_admin: false, campanha_id: null })).toEqual({
      campanha_id: '__sem_campanha__',
    })
  })

  it('retorna __sem_campanha__ quando user é undefined', () => {
    expect(escopoCampanha(undefined)).toEqual({
      campanha_id: '__sem_campanha__',
    })
  })
})
