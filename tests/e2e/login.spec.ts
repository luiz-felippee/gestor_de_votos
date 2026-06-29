import { test, expect } from '@playwright/test';

test.describe('Autenticação de Usuários', () => {
  
  test('Deve exibir erro ao tentar login com credenciais incorretas', async ({ page }) => {
    // Acessa a raiz da aplicação, que vai redirecionar ou mostrar a tela de login
    await page.goto('/login');

    // Valida se a logo/texto da plataforma apareceu
    await expect(page.locator('text=Gestor de Votos').first()).toBeVisible();

    // Preenche o formulário de login com dados falsos
    await page.fill('input[type="email"]', 'teste_inexistente@example.com');
    await page.fill('input[type="password"]', 'senha_errada_123');

    // Clica no botão de entrar
    await page.click('button[type="submit"]');

    // Aguarda o alerta vermelho aparecer na tela (pode ser API ou Falha de Rede local)
    const errorBox = page.locator('.text-red-800, .text-red-600');
    await expect(errorBox.first()).toBeVisible({ timeout: 10000 });
  });
  
  // Exemplo de como testar a rota protegida
  test('Deve bloquear o acesso ao Dashboard sem login', async ({ page }) => {
    await page.goto('/');
    
    // Como o usuário não tem token, o sistema deve forçá-lo para a tela /login
    await expect(page).toHaveURL(/\/login/);
  });

});
