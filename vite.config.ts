import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
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
