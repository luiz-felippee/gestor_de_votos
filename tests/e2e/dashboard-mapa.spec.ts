import { test, expect } from '@playwright/test'

/**
 * Teste de fumaça do painel + mapa.
 *
 * Guarda a REGRESSÃO que nos custou horas: um CSS de anti-gap deixou os tiles
 * do Leaflet com width/height = 0px — eles carregavam mas ficavam invisíveis,
 * e o mapa virava um retângulo preto/vazio. "Carregou 200" não é "apareceu":
 * aqui a gente mede o tamanho renderizado do tile.
 *
 * Precisa de uma conta válida — passe por variável de ambiente (nunca hardcode):
 *   E2E_EMAIL=... E2E_SENHA=... npx playwright test dashboard-mapa
 * Sem as variáveis, o teste é pulado (não quebra o CI de quem não configurou).
 */
const EMAIL = process.env.E2E_EMAIL
const SENHA = process.env.E2E_SENHA

test.describe('Painel + Mapa (fumaça)', () => {
  test.skip(!EMAIL || !SENHA, 'Defina E2E_EMAIL e E2E_SENHA para rodar o teste autenticado.')

  test('após login, o painel carrega e o MAPA renderiza (tiles com tamanho > 0)', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', EMAIL!)
    await page.fill('input[type="password"]', SENHA!)
    await page.click('button[type="submit"]')

    // Chegou no painel (fora do /login) e o título aparece
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 })
    await expect(page.locator('text=Mapa de Força')).toBeVisible({ timeout: 20000 })

    // Fecha o onboarding "Primeiros Passos" se aparecer (conta nova)
    for (let i = 0; i < 4; i++) {
      const av = page.getByRole('button', { name: /Avançar|Começar|Concluir/ }).first()
      if (await av.count()) { await av.click().catch(() => {}) ; await page.waitForTimeout(400) }
    }

    // O mapa é lazy — traz pra viewport e espera um tile carregar
    await page.locator('text=Mapa de Força').scrollIntoViewIfNeeded()
    const tile = page.locator('.leaflet-tile-pane img.leaflet-tile-loaded').first()
    await expect(tile).toBeVisible({ timeout: 20000 })

    // A REGRESSÃO: o tile precisa ter tamanho real (>0). Antes ficava 0px.
    const box = await tile.boundingBox()
    expect(box, 'o tile do mapa não tem caixa de layout').not.toBeNull()
    expect(box!.width, 'tile com largura 0 → mapa invisível (regressão do CSS de anti-gap)').toBeGreaterThan(10)
    expect(box!.height).toBeGreaterThan(10)
  })
})
