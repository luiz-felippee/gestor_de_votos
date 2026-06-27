/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  plugins: [
    react(),
    VitePWA({
      // Service Worker auto-destrutivo: limpa o cache antigo e se remove do
      // navegador. Resolve a "tela azul em branco" causada por cache preso de
      // deploys anteriores. (Pode reativar o PWA depois, configurado com cuidado.)
      selfDestroying: true,
      registerType: 'autoUpdate',
      manifest: {
        name: 'Gestor de Votos',
        short_name: 'Gestor de Votos',
        description: 'Plataforma Premium de Gestão de Campanhas',
        theme_color: '#4f46e5',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/1041/1041916.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
