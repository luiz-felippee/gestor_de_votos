import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     */
    timeout: 5000
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL: local por padrão; aponte pra produção/staging com
       E2E_BASE_URL=https://gestor-de-votos.vercel.app npx playwright test */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Removendo Firefox e Webkit por padrão para economizar recursos e focar no core E2E.
    // Pode habilitar futuramente se precisar testar multi-navegador.
  ],

  /* Sobe o dev local antes dos testes — mas NÃO quando aponta pra uma URL remota
     (E2E_BASE_URL), pra permitir smoke test direto contra produção/staging. */
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev:all',
        port: 5173,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000, // 2 minutos para o servidor Node/Vite ligarem juntos
      },
});
